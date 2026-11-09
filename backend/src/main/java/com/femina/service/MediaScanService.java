package com.femina.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.femina.common.ApiException;
import com.femina.mapper.MediaMapper;
import com.femina.model.Media;

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
                try {
                    m.setFileSize(Files.size(file));
                } catch (IOException e) {
                    m.setFileSize(0L);
                }
                result.add(m);
            }
        } catch (IOException e) {
            log.error("Failed to scan media dir: {}", mediaDir, e);
            throw ApiException.badRequest("扫描媒体目录失败: " + e.getMessage());
        }
        return result;
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
        return scanned.size();
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
