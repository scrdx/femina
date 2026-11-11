package com.femina.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.femina.mapper.MediaMapper;
import com.femina.mapper.PersonMapper;
import com.femina.model.Media;
import com.femina.model.Person;
import com.femina.util.FilePathUtil;
import com.femina.util.ImageDims;

/**
 * 缩略图服务：为照片生成最长边 1600px 的 JPEG 副本，供图片墙/海报墙/查看器
 * 适配态展示，避免浏览器直接解码 12–24MP 原图。
 * <p>
 * 存储目录由 FEMINA_THUMB_DIR 配置；未配置时全部功能降级为直接伺服原图。
 * 只读原图、只写缩略图目录——不触碰用户媒体文件（铁律）。
 * 生成时机：扫描后后台异步、启动后全量补齐、请求时兜底同步。
 */
@Service
public class ThumbService {

    public static final int LONG_EDGE = 1600;
    private static final float QUALITY = 0.80f;

    private static final Logger log = LoggerFactory.getLogger(ThumbService.class);

    @Value("${femina.thumb-dir:}")
    private String thumbDirCfg;

    private final MediaMapper mediaMapper;
    private final PersonMapper personMapper;
    private final ScheduledExecutorService exec = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "thumb-gen");
        t.setDaemon(true);
        return t;
    });
    /** 生成中的路径，防并发重复生成 */
    private final Set<String> inflight = ConcurrentHashMap.newKeySet();

    public ThumbService(MediaMapper mediaMapper, PersonMapper personMapper) {
        this.mediaMapper = mediaMapper;
        this.personMapper = personMapper;
    }

    public boolean enabled() {
        return StringUtils.isNotBlank(thumbDirCfg);
    }

    /** 缩略图路径：thumbDir/personId/<relPath 去扩展名>.jpg */
    public Path thumbPathFor(String personId, String relPath) {
        String stem = relPath.lastIndexOf('.') > 0
                ? relPath.substring(0, relPath.lastIndexOf('.'))
                : relPath;
        return Paths.get(thumbDirCfg).resolve(personId)
                .resolve(stem.replace('/', File.separatorChar) + ".jpg");
    }

    private boolean isFresh(Path thumb, Path original) {
        return Files.exists(thumb)
                && thumb.toFile().lastModified() >= original.toFile().lastModified();
    }

    /** 确保缩略图存在且不过期；小图/失败返回 false（调用方回退原图） */
    public boolean ensure(Person person, String relPath) {
        if (!enabled() || StringUtils.isBlank(person.getMediaDir())) {
            return false;
        }
        try {
            Path original = FilePathUtil.resolveInside(Paths.get(person.getMediaDir()), relPath);
            if (!Files.isRegularFile(original)) {
                return false;
            }
            Path thumb = thumbPathFor(person.getId(), relPath);
            if (isFresh(thumb, original)) {
                return true;
            }
            return generate(original, thumb);
        } catch (Exception e) {
            log.debug("thumb ensure failed: {} {}", person.getId(), relPath, e);
            return false;
        }
    }

    private boolean generate(Path original, Path thumb) {
        if (!inflight.add(thumb.toString())) {
            return Files.exists(thumb);
        }
        try {
            int[] dims = ImageDims.read(original);
            if (dims == null || Math.max(dims[0], dims[1]) <= LONG_EDGE) {
                return false; // 小图不值得缩略，回退原图
            }
            Files.createDirectories(thumb.getParent());
            try (ImageInputStream iis = ImageIO.createImageInputStream(original.toFile())) {
                Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
                if (!readers.hasNext()) {
                    return false;
                }
                ImageReader reader = readers.next();
                try {
                    reader.setInput(iis, true, true);
                    int w = reader.getWidth(0);
                    int h = reader.getHeight(0);
                    // 子采样解码：大图不必全分辨率进内存
                    int sub = 1;
                    while (Math.max(w, h) / (sub * 2L) >= LONG_EDGE) {
                        sub *= 2;
                    }
                    ImageReadParam param = reader.getDefaultReadParam();
                    if (sub > 1) {
                        param.setSourceSubsampling(sub, sub, 0, 0);
                    }
                    BufferedImage img = reader.read(0, param);
                    int tw;
                    int th;
                    if (w >= h) {
                        tw = LONG_EDGE;
                        th = Math.max(1, (int) Math.round((double) h / w * LONG_EDGE));
                    } else {
                        th = LONG_EDGE;
                        tw = Math.max(1, (int) Math.round((double) w / h * LONG_EDGE));
                    }
                    BufferedImage out = new BufferedImage(tw, th, BufferedImage.TYPE_INT_RGB);
                    Graphics2D g = out.createGraphics();
                    try {
                        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                                RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                        g.setRenderingHint(RenderingHints.KEY_RENDERING,
                                RenderingHints.VALUE_RENDER_QUALITY);
                        g.drawImage(img, 0, 0, tw, th, null);
                    } finally {
                        g.dispose();
                    }
                    Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
                    if (!writers.hasNext()) {
                        return false;
                    }
                    ImageWriter writer = writers.next();
                    try {
                        ImageWriteParam wp = writer.getDefaultWriteParam();
                        wp.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                        wp.setCompressionQuality(QUALITY);
                        Path tmp = thumb.resolveSibling(thumb.getFileName() + ".part");
                        try (OutputStream os = Files.newOutputStream(tmp)) {
                            writer.setOutput(ImageIO.createImageOutputStream(os));
                            writer.write(null, new IIOImage(out, null, null), wp);
                        }
                        Files.move(tmp, thumb,
                                StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                    } finally {
                        writer.dispose();
                    }
                    return true;
                } finally {
                    reader.dispose();
                }
            }
        } catch (Exception e) {
            log.debug("thumb generate failed: {}", original, e);
            return false;
        } finally {
            inflight.remove(thumb.toString());
        }
    }

    /** 扫描后调用：后台为该人物补齐/刷新缩略图。延迟 1.5s 等扫描事务提交 */
    public void schedulePerson(String personId) {
        if (!enabled()) {
            return;
        }
        exec.schedule(() -> generatePerson(personId), 1500, TimeUnit.MILLISECONDS);
    }

    private void generatePerson(String personId) {
        try {
            Person p = personMapper.findById(personId);
            if (p == null) {
                return;
            }
            List<Media> medias = mediaMapper.findByPerson(personId);
            for (Media m : medias) {
                if ("PHOTO".equals(m.getType())) {
                    ensure(p, m.getRelPath());
                }
            }
        } catch (Exception e) {
            log.warn("thumb background pass failed for person {}", personId, e);
        }
    }

    /** 启动后全量补齐（存量库首次开启配置时） */
    @EventListener(ApplicationReadyEvent.class)
    public void scheduleAll() {
        if (!enabled()) {
            return;
        }
        exec.schedule(() -> {
            try {
                List<com.femina.model.dto.PersonDtos.PersonSummary> all =
                        personMapper.search(null, 0, 100_000, "created", "asc");
                int n = 0;
                for (com.femina.model.dto.PersonDtos.PersonSummary s : all) {
                    generatePerson(s.getId());
                    n++;
                }
                if (n > 0) {
                    log.info("Thumb background pass covered {} persons", n);
                }
            } catch (Exception e) {
                log.warn("thumb startup pass failed", e);
            }
        }, 1000, TimeUnit.MILLISECONDS);
    }
}
