package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.Media;

public interface MediaMapper {

    int batchInsert(@Param("list") List<Media> mediaList);

    List<Media> findByPerson(@Param("personId") String personId);

    int deleteByPerson(@Param("personId") String personId);

    /** 删除 rel_path 不在给定集合内的行（重新扫描时清理已不存在的文件记录，不触碰文件本身） */
    int deleteByPersonNotInPaths(@Param("personId") String personId, @Param("paths") List<String> paths);
}
