package com.femina.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Data;

/**
 * 人物见面记录。见面日期非必填（meetDate 可为 null）。
 */
@Data
public class MeetRecord {
    private Long id;
    private String personId;
    private LocalDate meetDate;
    private LocalDateTime createdAt;
}
