package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.Media;

public interface MediaMapper {

    int batchInsert(@Param("list") List<Media> mediaList);

    List<Media> findByPerson(@Param("personId") String personId);

    /** 分页拉取某人物媒体（type 为 null 时不限类型）；sort/dir 由 Service 白名单校验 */
    List<Media> findByPersonPaged(@Param("personId") String personId, @Param("type") String type,
            @Param("offset") int offset, @Param("limit") int limit,
            @Param("sort") String sort, @Param("dir") String dir);

    long countByPerson(@Param("personId") String personId, @Param("type") String type);

    /** 元数据缺失的行（含 person.media_dir），供启动回填 */
    List<Media> findMissingMeta();

    /** 按 id 更新文件元数据（宽高/修改时间/创建时间/大小） */
    int updateMeta(Media media);

    int deleteByPerson(@Param("personId") String personId);

    /** 删除 rel_path 不在给定集合内的行（重新扫描时清理已不存在的文件记录，不触碰文件本身） */
    int deleteByPersonNotInPaths(@Param("personId") String personId, @Param("paths") List<String> paths);
}
