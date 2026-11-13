package com.femina.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
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
 * 缩略图服务：为照片生成 JPEG 副本，供图片墙/海报墙/查看器适配态展示，
 * 避免浏览器直接解码 12–24MP 原图。
 * <p>
 * 尺寸分档（{@link #normalizeEdge}）：海报墙卡片只要 640 档，详情页网格要更大档；
 * 档位写进文件名，存量无后缀文件视作 1600 档继续可用。请求的档位缺失时，
 * 优先从已有缩略图降采样（解码 1600px 比解码原图便宜一个数量级），都没有才解原图。
 * <p>
 * 存储目录由 FEMINA_THUMB_DIR 配置；未配置时全部功能降级为直接伺服原图。
 * 只读原图、只写缩略图目录——不触碰用户媒体文件（铁律）。
 * 生成时机：扫描后后台异步、启动后全量补齐、请求时兜底同步。
 */
@Service
public class ThumbService {

    public static final int LONG_EDGE = 1600;
    private static final float QUALITY = 0.80f;
    /** 允许的尺寸档位：限制缓存文件种类，避免任意像素值撑爆缩略图目录 */
    private static final int[] EDGES = {320, 480, 640, 800, 1000, 1600};

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

    /** 把任意请求值吸附到最近的档位 */
    public static int normalizeEdge(int requested) {
        int best = EDGES[0];
        for (int e : EDGES) {
            if (Math.abs(e - requested) < Math.abs(best - requested)) {
                best = e;
            }
        }
        return best;
    }

    private static String stemOf(String relPath) {
        int dot = relPath.lastIndexOf('.');
        return dot > 0 ? relPath.substring(0, dot) : relPath;
    }

    /** 缩略图路径（带档位）：thumbDir/personId/<stem>_<edge>.jpg */
    public Path thumbPathFor(String personId, String relPath, int edge) {
        return Paths.get(thumbDirCfg).resolve(personId)
                .resolve(stemOf(relPath).replace('/', File.separatorChar) + "_" + edge + ".jpg");
    }

    /** 旧版无后缀路径，等同 1600 档（存量缓存继续命中） */
    public Path thumbPathFor(String personId, String relPath) {
        return Paths.get(thumbDirCfg).resolve(personId)
                .resolve(stemOf(relPath).replace('/', File.separatorChar) + ".jpg");
    }

    private boolean isFresh(Path thumb, Path original) {
        return Files.exists(thumb)
                && thumb.toFile().lastModified() >= original.toFile().lastModified();
    }

    /** 确保缩略图存在且不过期；小图/失败返回 false（调用方回退原图） */
    public boolean ensure(Person person, String relPath) {
        return ensure(person, relPath, LONG_EDGE);
    }

    public boolean ensure(Person person, String relPath, int edge) {
        if (!enabled() || StringUtils.isBlank(person.getMediaDir())) {
            return false;
        }
        try {
            Path original = FilePathUtil.resolveInside(Paths.get(person.getMediaDir()), relPath);
            if (!Files.isRegularFile(original)) {
                return false;
            }
            Path thumb = thumbPathFor(person.getId(), relPath, edge);
            if (isFresh(thumb, original)) {
                return true;
            }
            // 存量无后缀缓存即 1600 档
            if (edge == LONG_EDGE && isFresh(thumbPathFor(person.getId(), relPath), original)) {
                return true;
            }
            // 已有其它档位的缩略图时从它降采样，避免为一个小档解码整张原图
            Path donor = findFreshDonor(person, relPath, original, edge);
            if (donor != null) {
                return derive(donor, thumb, edge);
            }
            return generate(original, thumb, edge);
        } catch (Exception e) {
            log.debug("thumb ensure failed: {} {} {}", person.getId(), relPath, edge, e);
            return false;
        }
    }

    /** 找一张除目标档位外最大的新鲜缩略图作为降采样源 */
    private Path findFreshDonor(Person person, String relPath, Path original, int edge) {
        for (int i = EDGES.length - 1; i >= 0; i--) {
            int e = EDGES[i];
            if (e == edge) {
                continue;
            }
            Path p = thumbPathFor(person.getId(), relPath, e);
            if (e == LONG_EDGE && !Files.exists(p)) {
                p = thumbPathFor(person.getId(), relPath);
            }
            if (isFresh(p, original)) {
                return p;
            }
        }
        return null;
    }

    /** 从已有缩略图降到目标档（源图不大，全量解码很便宜） */
    private boolean derive(Path donor, Path thumb, int edge) {
        if (!inflight.add(thumb.toString())) {
            return Files.exists(thumb);
        }
        try {
            BufferedImage img = ImageIO.read(donor.toFile());
            if (img == null) {
                return false;
            }
            Files.createDirectories(thumb.getParent());
            writeJpeg(scaleToEdge(img, edge), thumb);
            return true;
        } catch (Exception e) {
            log.debug("thumb derive failed: {} -> {}", donor, thumb, e);
            return false;
        } finally {
            inflight.remove(thumb.toString());
        }
    }

    private boolean generate(Path original, Path thumb, int edge) {
        if (!inflight.add(thumb.toString())) {
            return Files.exists(thumb);
        }
        try {
            byte[] bytes = renderFromOriginal(original, edge);
            if (bytes == null) {
                return false; // 小图不值得缩略，回退原图
            }
            Files.createDirectories(thumb.getParent());
            Path tmp = thumb.resolveSibling(thumb.getFileName() + ".part");
            Files.write(tmp, bytes);
            Files.move(tmp, thumb, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            return true;
        } catch (Exception e) {
            log.debug("thumb generate failed: {}", original, e);
            return false;
        } finally {
            inflight.remove(thumb.toString());
        }
    }

    /**
     * 未配置缩略图目录时的兜底：即时把原图降到目标档返回字节，不落盘。
     * 返回 null 表示小图/读不了，调用方回退原图（小图回退原图没有代价）。
     * 代价是服务端 CPU，但换来浏览器端解码成本下降两个数量级，且有 7 天浏览器缓存。
     */
    public byte[] renderOnTheFly(Person person, String relPath, int edge) {
        if (StringUtils.isBlank(person.getMediaDir())) {
            return null;
        }
        try {
            Path original = FilePathUtil.resolveInside(Paths.get(person.getMediaDir()), relPath);
            if (!Files.isRegularFile(original)) {
                return null;
            }
            return renderFromOriginal(original, edge);
        } catch (Exception e) {
            log.debug("on-the-fly render failed: {} {}", person.getId(), relPath, e);
            return null;
        }
    }

    /** 原图 → 目标档 JPEG 字节；原图本来就不大于目标档时返回 null */
    private byte[] renderFromOriginal(Path original, int edge) throws IOException {
        int[] dims = ImageDims.read(original);
        if (dims == null || Math.max(dims[0], dims[1]) <= edge) {
            return null;
        }
        try (ImageInputStream iis = ImageIO.createImageInputStream(original.toFile())) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int w = reader.getWidth(0);
                int h = reader.getHeight(0);
                // 子采样解码：大图不必全分辨率进内存
                int sub = 1;
                while (Math.max(w, h) / (sub * 2L) >= edge) {
                    sub *= 2;
                }
                ImageReadParam param = reader.getDefaultReadParam();
                if (sub > 1) {
                    param.setSourceSubsampling(sub, sub, 0, 0);
                }
                BufferedImage img = reader.read(0, param);
                return encodeJpeg(scaleToEdge(img, edge));
            } finally {
                reader.dispose();
            }
        }
    }

    /** 等比缩到最长边 edge；已经够小则原样返回 */
    private static BufferedImage scaleToEdge(BufferedImage img, int edge) {
        int w = img.getWidth();
        int h = img.getHeight();
        if (Math.max(w, h) <= edge) {
            return img;
        }
        int tw;
        int th;
        if (w >= h) {
            tw = edge;
            th = Math.max(1, (int) Math.round((double) h / w * edge));
        } else {
            th = edge;
            tw = Math.max(1, (int) Math.round((double) w / h * edge));
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
        return out;
    }

    private static byte[] encodeJpeg(BufferedImage img) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IOException("no jpeg writer");
        }
        ImageWriter writer = writers.next();
        try {
            ImageWriteParam wp = writer.getDefaultWriteParam();
            wp.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            wp.setCompressionQuality(QUALITY);
            ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
            writer.setOutput(ImageIO.createImageOutputStream(bos));
            writer.write(null, new IIOImage(img, null, null), wp);
            return bos.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    private static void writeJpeg(BufferedImage img, Path thumb) throws IOException {
        byte[] bytes = encodeJpeg(img);
        Path tmp = thumb.resolveSibling(thumb.getFileName() + ".part");
        Files.write(tmp, bytes);
        Files.move(tmp, thumb, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    // ---- 裁剪封面（person.cover_data，base64 存库）----

    /** 裁剪封面缓存：thumbDir/cover/<personId>_<edge>_<updatedMillis>.jpg，重裁剪后自动失效 */
    private Path coverCacheFor(Person person, int edge) {
        long v = person.getUpdatedAt() == null ? 0 : person.getUpdatedAt().toEpochSecond(java.time.ZoneOffset.UTC);
        return Paths.get(thumbDirCfg).resolve("cover")
                .resolve(person.getId() + "_" + edge + "_" + v + ".jpg");
    }

    /**
     * 渲染裁剪封面（按档位降采样）的字节；无裁剪封面或数据解码失败返回 null，
     * 由调用方降级到封面文件的缩略图（坏数据不该让人物连封面都显示不出来）。
     * 配置了缩略图目录时走磁盘缓存，否则每次请求即时编码（仍比塞进列表 JSON 便宜得多）。
     */
    public byte[] renderCover(Person person, int edge) throws IOException {
        String data = person.getCoverData();
        if (StringUtils.isBlank(data)) {
            return null;
        }
        Path cache = enabled() ? coverCacheFor(person, edge) : null;
        if (cache != null && Files.isRegularFile(cache)) {
            return Files.readAllBytes(cache);
        }
        BufferedImage img = decodeDataUrl(data);
        if (img == null) {
            return null;
        }
        byte[] bytes = encodeJpeg(scaleToEdge(img, edge));
        if (cache != null) {
            try {
                Files.createDirectories(cache.getParent());
                pruneCoverSiblings(cache);
                Path tmp = cache.resolveSibling(cache.getFileName() + ".part");
                Files.write(tmp, bytes);
                Files.move(tmp, cache, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (Exception e) {
                log.debug("cover cache write failed: {}", cache, e);
            }
        }
        return bytes;
    }

    /** 同一人物同一档位只留最新一份缓存，避免重裁剪后堆积 */
    private void pruneCoverSiblings(Path cache) {
        String prefix = cache.getFileName().toString();
        int cut = prefix.lastIndexOf('_');
        if (cut <= 0) {
            return;
        }
        String stem = prefix.substring(0, cut + 1);
        try (java.util.stream.Stream<Path> s = Files.list(cache.getParent())) {
            s.filter(f -> f.getFileName().toString().startsWith(stem))
                    .filter(f -> !f.equals(cache))
                    .forEach(f -> {
                        try {
                            Files.deleteIfExists(f);
                        } catch (IOException ignored) {
                            // 缓存清理失败无所谓
                        }
                    });
        } catch (IOException ignored) {
            // 同上
        }
    }

    private static BufferedImage decodeDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            return null;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
            return ImageIO.read(new ByteArrayInputStream(raw));
        } catch (Exception e) {
            return null;
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
