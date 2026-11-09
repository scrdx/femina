package com.femina.service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.femina.common.ApiException;
import com.femina.config.AppProperties;

import lombok.Data;

/**
 * 服务端目录浏览（只读），用于添加人物时选择媒体目录与封面图片。
 * 不会创建/修改/删除任何文件。
 */
@Service
public class FsBrowseService {

    private final AppProperties props;

    public FsBrowseService(AppProperties props) {
        this.props = props;
    }

    @Data
    public static class FsNode {
        private String name;
        private String path;
        private boolean dir;
        private boolean image;
    }

    @Data
    public static class FsListResult {
        private String current;
        private String parent;
        private String mediaRoot;
        private List<FsNode> nodes = new ArrayList<>();
    }

    /**
     * 列出目录内容。
     *
     * @param path 目录绝对路径；为空时返回根列表（配置的 mediaRoot + 文件系统盘符）
     * @param mode "dir" 只返回子目录（选媒体目录）；"image" 返回子目录 + 图片文件（选封面）
     */
    public FsListResult list(String path, String mode) {
        boolean imageMode = "image".equalsIgnoreCase(mode);
        FsListResult result = new FsListResult();
        result.setMediaRoot(StringUtils.trimToNull(props.getMediaRoot()));

        if (StringUtils.isBlank(path)) {
            result.setCurrent(null);
            List<FsNode> roots = new ArrayList<>();
            if (result.getMediaRoot() != null) {
                roots.add(node(new File(result.getMediaRoot())));
            }
            for (File root : File.listRoots()) {
                if (root.isDirectory()) {
                    roots.add(node(root));
                }
            }
            result.setNodes(roots);
            return result;
        }

        Path dir = Paths.get(path);
        if (!Files.isDirectory(dir)) {
            throw ApiException.badRequest("目录不存在: " + path);
        }
        File dirFile = dir.toFile();
        result.setCurrent(dirFile.getAbsolutePath());
        File parentFile = dirFile.getParentFile();
        result.setParent(parentFile == null ? null : parentFile.getAbsolutePath());

        File[] children = dirFile.listFiles();
        if (children == null) {
            throw ApiException.badRequest("无法读取目录（权限不足）: " + path);
        }
        List<FsNode> nodes = new ArrayList<>();
        Arrays.sort(children, Comparator
                .comparing((File f) -> !f.isDirectory())
                .thenComparing(f -> f.getName().toLowerCase()));
        for (File f : children) {
            if (f.isHidden()) {
                continue;
            }
            if (f.isDirectory()) {
                nodes.add(node(f));
            } else if (imageMode && MediaScanService.isPhoto(FilenameUtils.getExtension(f.getName()))) {
                nodes.add(node(f));
            }
        }
        result.setNodes(nodes);
        return result;
    }

    private FsNode node(File f) {
        FsNode n = new FsNode();
        n.setName(StringUtils.isBlank(f.getName()) ? f.getAbsolutePath() : f.getName());
        n.setPath(f.getAbsolutePath());
        n.setDir(f.isDirectory());
        n.setImage(!f.isDirectory() && MediaScanService.isPhoto(FilenameUtils.getExtension(f.getName())));
        return n;
    }
}
