package com.femina.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PersonAccount {
    private Long id;
    private String personId;
    private String type;
    private String value;
    private Integer sortNo;
}
