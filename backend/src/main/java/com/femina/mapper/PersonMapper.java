package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.Person;
import com.femina.model.dto.PersonDtos.PersonSummary;

public interface PersonMapper {

    int insert(Person person);

    int update(Person person);

    Person findById(@Param("id") String id);

    int deleteById(@Param("id") String id);

    /** 关键字搜索（姓名/昵称/账号/标签），分页 + 排序（sortBy: nickname/created/updated/media） */
    List<PersonSummary> search(@Param("keyword") String keyword,
                               @Param("offset") int offset,
                               @Param("limit") int limit,
                               @Param("sortBy") String sortBy,
                               @Param("sortDir") String sortDir);

    long countSearch(@Param("keyword") String keyword);
}
