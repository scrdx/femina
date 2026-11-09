package com.femina.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Param;

import com.femina.model.Tag;

public interface TagMapper {

    List<Tag> findAll();

    /** INSERT IGNORE，已存在则忽略 */
    int insertIgnore(@Param("name") String name);

    Tag findByName(@Param("name") String name);

    List<Tag> findByPerson(@Param("personId") String personId);

    /** 批量查询多个人物的标签，返回带 personId 的视图 */
    List<PersonTagView> findByPersonIds(@Param("personIds") List<String> personIds);

    int attach(@Param("personId") String personId, @Param("tagId") Long tagId);

    int detachByPerson(@Param("personId") String personId);

    /** personId -> tagName 的扁平视图 */
    class PersonTagView {
        private String personId;
        private String tagName;

        public String getPersonId() { return personId; }
        public void setPersonId(String personId) { this.personId = personId; }
        public String getTagName() { return tagName; }
        public void setTagName(String tagName) { this.tagName = tagName; }
    }
}
