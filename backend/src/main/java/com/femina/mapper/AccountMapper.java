package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.PersonAccount;

public interface AccountMapper {

    int batchInsert(@Param("personId") String personId, @Param("list") List<PersonAccount> accounts);

    List<PersonAccount> findByPerson(@Param("personId") String personId);

    int deleteByPerson(@Param("personId") String personId);
}
