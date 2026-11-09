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
    private LocalDateTime createdAt;
}
