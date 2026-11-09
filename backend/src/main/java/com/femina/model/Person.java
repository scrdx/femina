package com.femina.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Data;

@Data
public class Person {
    private String id;
    private String name;
    private String nickname;
    private LocalDate birthDate;
    private Integer birthYear;
    private Boolean birthYearOnly;
    private String hometown;
    private String education;
    private Integer heightCm;
    private BigDecimal weightKg;
    private String mediaDir;
    private String coverPath;
    /** 裁剪后的封面 base64 data URL，为空时回退 coverPath 原文件流 */
    private String coverData;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
