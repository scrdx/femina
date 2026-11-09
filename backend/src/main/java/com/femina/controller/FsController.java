package com.femina.controller;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;

import org.apache.commons.io.FilenameUtils;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.femina.common.ApiException;
import com.femina.common.R;
import com.femina.service.FsBrowseService;
import com.femina.service.FsBrowseService.FsListResult;
import com.femina.service.MediaScanService;

@RestController
@RequestMapping("/api/fs")
public class FsController {

    private final FsBrowseService fsBrowseService;

    public FsController(FsBrowseService fsBrowseService) {
        this.fsBrowseService = fsBrowseService;
    }

    /** 只读目录浏览，供选择媒体目录（mode=dir）或封面图片（mode=image） */
    @GetMapping("/list")
    public R<FsListResult> list(@RequestParam(required = false) String path,
                                @RequestParam(defaultValue = "dir") String mode) {
        return R.ok(fsBrowseService.list(path, mode));
    }

    /**
     * 只读图片预览：按绝对路径返回图片字节，供创建/编辑人物时预览封面。
     * 仅允许图片扩展名，绝不修改文件。
     */
    @GetMapping("/preview")
    public ResponseEntity<Resource> preview(@RequestParam String path) {
        if (path == null || path.trim().isEmpty()) {
            throw ApiException.badRequest("path 不能为空");
        }
        String ext = FilenameUtils.getExtension(path).toLowerCase(Locale.ROOT);
        if (!MediaScanService.isPhoto(ext)) {
            throw ApiException.badRequest("仅支持预览图片文件");
        }
        Path p = Paths.get(path).toAbsolutePath().normalize();
        File f = p.toFile();
        if (!f.isFile() || !Files.isReadable(p)) {
            throw ApiException.notFound("图片不存在或不可读");
        }
        FileSystemResource resource = new FileSystemResource(f);
        MediaType mediaType = "png".equals(ext) ? MediaType.IMAGE_PNG
                : "gif".equals(ext) ? MediaType.IMAGE_GIF
                : "webp".equals(ext) ? MediaType.parseMediaType("image/webp")
                : "bmp".equals(ext) ? MediaType.valueOf("image/bmp")
                : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(f.length())
                .header("Cache-Control", "private, max-age=3600")
                .body(resource);
    }
}
