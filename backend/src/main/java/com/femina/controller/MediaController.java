package com.femina.controller;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.femina.common.ApiException;
import com.femina.model.Person;
import com.femina.service.PersonService;
import com.femina.service.ThumbService;
import com.femina.util.FilePathUtil;

/**
 * 媒体文件流接口（只读）。
 * 支持 HTTP Range（206 Partial Content），保证视频可以拖动播放。
 * 文件路径严格限制在对应人物的 media_dir 内，防止目录穿越。
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final Logger log = LoggerFactory.getLogger(MediaController.class);
    private static final int BUFFER_SIZE = 64 * 1024;

    private static final Map<String, String> CONTENT_TYPES = new HashMap<>();

    static {
        CONTENT_TYPES.put("jpg", "image/jpeg");
        CONTENT_TYPES.put("jpeg", "image/jpeg");
        CONTENT_TYPES.put("png", "image/png");
        CONTENT_TYPES.put("gif", "image/gif");
        CONTENT_TYPES.put("webp", "image/webp");
        CONTENT_TYPES.put("bmp", "image/bmp");
        CONTENT_TYPES.put("mp4", "video/mp4");
        CONTENT_TYPES.put("m4v", "video/mp4");
        CONTENT_TYPES.put("mov", "video/quicktime");
        CONTENT_TYPES.put("webm", "video/webm");
        CONTENT_TYPES.put("mkv", "video/x-matroska");
        CONTENT_TYPES.put("avi", "video/x-msvideo");
        CONTENT_TYPES.put("ts", "video/mp2t");
        CONTENT_TYPES.put("mpg", "video/mpeg");
        CONTENT_TYPES.put("mpeg", "video/mpeg");
    }

    private final PersonService personService;
    private final ThumbService thumbService;

    public MediaController(PersonService personService, ThumbService thumbService) {
        this.personService = personService;
        this.thumbService = thumbService;
    }

    /**
     * 缩略图：未配置缩略图目录、小图、或生成失败时 302 回退原图接口，
     * 前端可无脑使用本地址。首次请求兜底同步生成，之后命中磁盘缓存。
     */
    @GetMapping("/thumb")
    public void thumb(@RequestParam String personId,
                      @RequestParam String path,
                      HttpServletRequest request,
                      HttpServletResponse response) throws IOException {
        Person person = personService.requirePerson(personId);
        String fallback = "/api/media/file?" + request.getQueryString();
        if (!thumbService.enabled() || StringUtils.isBlank(path)) {
            response.sendRedirect(fallback);
            return;
        }
        if (!thumbService.ensure(person, path)) {
            response.sendRedirect(fallback);
            return;
        }
        Path thumb = thumbService.thumbPathFor(personId, path);
        response.setContentType("image/jpeg");
        response.setContentLengthLong(Files.size(thumb));
        response.setHeader("Cache-Control", "private, max-age=3600");
        Files.copy(thumb, response.getOutputStream());
    }

    @GetMapping("/file")
    public void file(@RequestParam String personId,
                     @RequestParam String path,
                     HttpServletRequest request,
                     HttpServletResponse response) throws IOException {
        Person person = personService.requirePerson(personId);
        if (StringUtils.isBlank(person.getMediaDir())) {
            throw ApiException.notFound("该人物未设置媒体目录");
        }
        if (StringUtils.isBlank(path)) {
            throw ApiException.badRequest("path 不能为空");
        }
        Path base = Paths.get(person.getMediaDir());
        if (!Files.isDirectory(base)) {
            throw ApiException.notFound("媒体目录不存在: " + person.getMediaDir());
        }
        Path target = FilePathUtil.resolveInside(base, path);
        File file = target.toFile();
        if (!file.isFile()) {
            throw ApiException.notFound("文件不存在: " + path);
        }

        String ext = FilenameUtils.getExtension(file.getName()).toLowerCase(Locale.ROOT);
        String contentType = CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
        long fileLength = file.length();

        // 解析 Range 头
        long start = 0;
        long end = fileLength - 1;
        boolean partial = false;
        String rangeHeader = request.getHeader("Range");
        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            String rangeValue = rangeHeader.substring(6).trim();
            int dash = rangeValue.indexOf('-');
            if (dash > 0) {
                String startStr = rangeValue.substring(0, dash).trim();
                String endStr = rangeValue.substring(dash + 1).trim();
                long parsedStart = NumberUtils.toLong(startStr, -1);
                long parsedEnd = NumberUtils.toLong(endStr, -1);
                if (parsedStart >= 0 && parsedStart < fileLength) {
                    start = parsedStart;
                    end = (parsedEnd >= 0 && parsedEnd < fileLength) ? parsedEnd : fileLength - 1;
                    partial = true;
                } else if (parsedStart < 0 && parsedEnd > 0) {
                    // bytes=-N：最后 N 字节
                    start = Math.max(0, fileLength - parsedEnd);
                    end = fileLength - 1;
                    partial = true;
                }
            }
        }
        if (start > end) {
            response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
            response.setHeader("Content-Range", "bytes */" + fileLength);
            return;
        }

        long contentLength = end - start + 1;
        response.setStatus(partial ? HttpServletResponse.SC_PARTIAL_CONTENT : HttpServletResponse.SC_OK);
        response.setContentType(contentType);
        response.setHeader("Accept-Ranges", "bytes");
        response.setHeader("Content-Length", String.valueOf(contentLength));
        response.setHeader("Cache-Control", "private, max-age=86400");
        if (partial) {
            response.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + fileLength);
        }

        if ("HEAD".equalsIgnoreCase(request.getMethod())) {
            return;
        }

        // 只读方式打开文件并输出（客户端中断导致的 IO 异常属正常现象，降级为 debug）
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(start);
            OutputStream out = response.getOutputStream();
            byte[] buffer = new byte[BUFFER_SIZE];
            long remaining = contentLength;
            while (remaining > 0) {
                int toRead = (int) Math.min(buffer.length, remaining);
                int read = raf.read(buffer, 0, toRead);
                if (read <= 0) {
                    break;
                }
                out.write(buffer, 0, read);
                remaining -= read;
            }
            out.flush();
        } catch (IOException e) {
            log.debug("Client aborted or IO error while streaming {}: {}", path, e.getMessage());
        }
    }
}
