package com.femina.model;

import java.time.LocalDateTime;

import lombok.Data;

/**
 * 人物媒体文件的数据库记录。仅保存相对路径元数据，系统对文件只读。
 */
@Data
public class Media {
    private Long id;
    private String personId;
    private String type;      // PHOTO / VIDEO
    private String relPath;   // 相对 person.mediaDir 的路径
    private String fileName;
    private String ext;
    private Long fileSize;
    /** 图片宽高（px）；扫描/回填时写入，0 或 null 表示未知 */
    private Integer width;
    private Integer height;
    /** 文件修改时间 */
    private LocalDateTime modifiedAt;
    /** 文件创建时间（文件系统）；不支持时回退修改时间 */
    private LocalDateTime fileCreatedAt;
    /** 记录登记时间 */
    private LocalDateTime createdAt;
    /** 仅回填查询用：JOIN person 带出的媒体目录，不参与常规映射语义 */
    private String mediaDir;
}
