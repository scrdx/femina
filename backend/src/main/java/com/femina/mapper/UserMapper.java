package com.femina.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.femina.model.SysUser;

public interface UserMapper {

    @Select("SELECT COUNT(*) FROM sys_user")
    int countUsers();

    @Select("SELECT id, username, password_hash, display_name, avatar, created_at FROM sys_user ORDER BY id LIMIT 1")
    SysUser findAdmin();

    @Insert("INSERT INTO sys_user (username, password_hash) VALUES (#{username}, #{passwordHash})")
    int insert(@Param("username") String username, @Param("passwordHash") String passwordHash);

    @Update("UPDATE sys_user SET password_hash = #{passwordHash} WHERE id = #{id}")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);

    @Update("UPDATE sys_user SET display_name = #{displayName}, avatar = #{avatar} WHERE id = #{id}")
    int updateProfile(@Param("id") Long id, @Param("displayName") String displayName,
                      @Param("avatar") String avatar);
}
