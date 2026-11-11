package com.femina.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.femina.common.ApiException;
import com.femina.mapper.MediaMapper;
import com.femina.model.Media;
import com.femina.util.FilePathUtil;
import com.femina.util.ImageDims;

/**
 * 扫描人物媒体目录，将图片/视频文件信息登记到数据库。
 * <p>
 * 重要：本服务对媒体文件【只读】——只遍历目录、读取文件名与大小，
 * 任何情况下都不会创建、修改、移动或删除用户的媒体文件。
 */
@Service
public class MediaScanService {

    private static final Logger log = LoggerFactory.getLogger(MediaScanService.class);

    private static final Set<String> PHOTO_EXTS = new HashSet<>(Arrays.asList(
            "jpg", "jpeg", "png", "gif", "webp", "bmp"));

    private static final Set<String> VIDEO_EXTS = new HashSet<>(Arrays.asList(
            "mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "ts", "m4v", "mpg", "mpeg", "3gp"));

    private final MediaMapper mediaMapper;

    public MediaScanService(MediaMapper mediaMapper) {
        this.mediaMapper = mediaMapper;
    }

    public static boolean isPhoto(String ext) {
        return ext != null && PHOTO_EXTS.contains(ext.toLowerCase(Locale.ROOT));
    }

    public static boolean isVideo(String ext) {
        return ext != null && VIDEO_EXTS.contains(ext.toLowerCase(Locale.ROOT));
    }

    /**
     * 扫描目录，返回媒体记录列表（不入库）。relPath 使用 '/' 分隔，跨平台一致。
     */
    public List<Media> scan(String personId, String mediaDir) {
        List<Media> result = new ArrayList<>();
        if (StringUtils.isBlank(mediaDir)) {
            return result;
        }
        Path root = Paths.get(mediaDir);
        if (!Files.isDirectory(root)) {
            throw ApiException.badRequest("媒体目录不存在: " + mediaDir);
        }
        try (Stream<Path> stream = Files.walk(root)) {
            List<Path> files = stream.filter(Files::isRegularFile).collect(Collectors.toList());
            for (Path file : files) {
                String ext = FilenameUtils.getExtension(file.getFileName().toString());
                boolean photo = isPhoto(ext);
                if (!photo && !isVideo(ext)) {
                    continue;
                }
                String relPath = root.relativize(file).toString().replace('\\', '/');
                Media m = new Media();
                m.setPersonId(personId);
                m.setType(photo ? "PHOTO" : "VIDEO");
                m.setRelPath(relPath);
                m.setFileName(file.getFileName().toString());
                m.setExt(ext.toLowerCase(Locale.ROOT));
                fillFileMeta(m, file, photo);
                result.add(m);
            }
        } catch (IOException e) {
            log.error("Failed to scan media dir: {}", mediaDir, e);
            throw ApiException.badRequest("扫描媒体目录失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 读取文件元数据（大小/修改时间/创建时间/图片宽高）。只读文件头，不解码像素。
     * 任何一项失败都留空，不让扫描整体失败。
     */
    private void fillFileMeta(Media m, Path file, boolean photo) {
        m.setFileSize(0L);
        try {
            m.setFileSize(Files.size(file));
            BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
            m.setModifiedAt(toLocalDateTime(attrs.lastModifiedTime()));
            FileTime ct = attrs.creationTime();
            // 文件系统不支持创建时间时回退修改时间：保证列收敛、不被反复回填。
            // created_at 是记录登记时间，由数据库默认值负责，这里不碰
            m.setFileCreatedAt(ct == null || ct.toMillis() <= 0
                    ? m.getModifiedAt()
                    : toLocalDateTime(ct));
        } catch (IOException e) {
            log.debug("read attrs failed: {}", file, e);
        }
        if (photo) {
            try {
                int[] dims = ImageDims.read(file);
                if (dims != null && dims[0] > 0 && dims[1] > 0) {
                    m.setWidth(dims[0]);
                    m.setHeight(dims[1]);
                }
            } catch (Exception e) {
                log.debug("read dims failed: {}", file, e);
            }
        }
    }

    private static LocalDateTime toLocalDateTime(java.nio.file.attribute.FileTime t) {
        return LocalDateTime.ofInstant(t.toInstant(), ZoneId.systemDefault());
    }

    /** 创建人物时：扫描并全部入库 */
    @Transactional
    public int scanAndSave(String personId, String mediaDir) {
        List<Media> list = scan(personId, mediaDir);
        if (!list.isEmpty()) {
            batchInsert(list);
        }
        return list.size();
    }

    /**
     * 重新扫描：新增文件入库，已不存在的文件删除对应数据库记录。
     * 再次强调：只操作数据库记录，不动任何文件。
     */
    @Transactional
    public int rescan(String personId, String mediaDir) {
        if (StringUtils.isBlank(mediaDir)) {
            mediaMapper.deleteByPerson(personId);
            return 0;
        }
        List<Media> scanned = scan(personId, mediaDir);
        List<String> paths = scanned.stream().map(Media::getRelPath).collect(Collectors.toList());
        // 清理已不存在文件的 DB 记录
        mediaMapper.deleteByPersonNotInPaths(personId, paths);
        if (!scanned.isEmpty()) {
            batchInsert(scanned); // INSERT IGNORE，已存在的行不受影响
        }
        // INSERT IGNORE 不更新存量行：文件有变化（mtime/尺寸缺失）时同步元数据
        Map<String, Media> existing = mediaMapper.findByPerson(personId).stream()
                .collect(Collectors.toMap(Media::getRelPath, Function.identity(), (a, b) -> a));
        for (Media s : scanned) {
            Media ex = existing.get(s.getRelPath());
            if (ex == null) {
                continue;
            }
            boolean mtimeChanged = ex.getModifiedAt() == null || s.getModifiedAt() == null
                    || !ex.getModifiedAt().equals(s.getModifiedAt());
            boolean dimsMissing = ex.getWidth() == null && s.getWidth() != null;
            if (mtimeChanged || dimsMissing) {
                s.setId(ex.getId());
                mediaMapper.updateMeta(s);
            }
        }
        return scanned.size();
    }

    /**
     * 回填存量行元数据（生产库新增列后为 NULL）：只读文件头与属性，不写文件。
     * 文件缺失/读不出的图片以 width=0 标记，避免被反复选中。
     */
    public int backfillMissing() {
        int updated = 0;
        // width=0（解析失败/文件缺失）的行会被再次选中：本轮内用 id 去重防循环
        Set<Long> done = new HashSet<>();
        for (int round = 0; round < 200; round++) {
            List<Media> batch = mediaMapper.findMissingMeta();
            List<Media> todo = batch.stream()
                    .filter(m -> m.getId() != null && done.add(m.getId()))
                    .collect(Collectors.toList());
            if (todo.isEmpty()) {
                break;
            }
            for (Media m : todo) {
                Media meta = probe(m);
                meta.setId(m.getId());
                mediaMapper.updateMeta(meta);
                updated++;
            }
        }
        return updated;
    }

    private Media probe(Media m) {
        Media out = new Media();
        out.setFileSize(m.getFileSize());
        out.setWidth(m.getWidth());
        out.setHeight(m.getHeight());
        out.setModifiedAt(m.getModifiedAt());
        out.setFileCreatedAt(m.getFileCreatedAt());
        boolean photo = "PHOTO".equals(m.getType());
        if (StringUtils.isNotBlank(m.getMediaDir())) {
            try {
                Path file = FilePathUtil.resolveInside(Paths.get(m.getMediaDir()), m.getRelPath());
                if (Files.exists(file)) {
                    fillFileMeta(out, file, photo);
                }
            } catch (Exception e) {
                log.debug("backfill probe failed: {} {}", m.getPersonId(), m.getRelPath(), e);
            }
        }
        if (out.getModifiedAt() == null) {
            out.setModifiedAt(out.getCreatedAt() != null ? out.getCreatedAt() : LocalDateTime.now());
        }
        if (out.getFileCreatedAt() == null) {
            out.setFileCreatedAt(out.getModifiedAt());
        }
        if (photo && out.getWidth() == null) {
            out.setWidth(0);
        }
        return out;
    }

    /** 启动后后台回填存量元数据；不阻塞启动，只读文件头 */
    @EventListener(ApplicationReadyEvent.class)
    public void scheduleBackfill() {
        Thread t = new Thread(() -> {
            try {
                int n = backfillMissing();
                if (n > 0) {
                    log.info("Media metadata backfill done: {} rows", n);
                }
            } catch (Exception e) {
                log.warn("Media metadata backfill failed: {}", e.getMessage());
            }
        }, "media-meta-backfill");
        t.setDaemon(true);
        t.start();
    }

    private void batchInsert(List<Media> list) {
        // 分批插入，避免单条 SQL 过大
        int batchSize = 500;
        for (int i = 0; i < list.size(); i += batchSize) {
            List<Media> sub = list.subList(i, Math.min(i + batchSize, list.size()));
            mediaMapper.batchInsert(sub);
        }
    }
}
