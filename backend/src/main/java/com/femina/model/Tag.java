package com.femina.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Tag {
    private Long id;
    private String name;
    /** 使用人数（findAll 统计返回；其他场景可能为 null） */
    private Long count;
}
