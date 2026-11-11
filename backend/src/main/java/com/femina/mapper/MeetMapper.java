package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.MeetRecord;

public interface MeetMapper {

    /** 日期倒序、空日期垫底、再按登记时间倒序 */
    List<MeetRecord> findByPerson(@Param("personId") String personId);

    long countByPerson(@Param("personId") String personId);

    int insert(MeetRecord record);

    /** 仅当记录属于该人物时删除，返回影响行数 */
    int deleteByIdAndPerson(@Param("id") Long id, @Param("personId") String personId);

    int deleteByPerson(@Param("personId") String personId);
}
