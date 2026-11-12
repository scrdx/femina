package com.femina.controller;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import javax.validation.Valid;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.femina.common.R;
import com.femina.model.Media;
import com.femina.model.MeetRecord;
import com.femina.model.Tag;
import com.femina.model.dto.PersonDtos.FileNode;
import com.femina.model.dto.PersonDtos.MeetForm;
import com.femina.model.dto.PersonDtos.PageResult;
import com.femina.model.dto.PersonDtos.PersonDetail;
import com.femina.model.dto.PersonDtos.PersonForm;
import com.femina.model.dto.PersonDtos.PersonSummary;
import com.femina.model.dto.PersonDtos.PinnedForm;
import com.femina.model.dto.PersonDtos.RatingForm;
import com.femina.service.PersonService;

@RestController
@RequestMapping("/api")
public class PersonController {

    private final PersonService personService;

    public PersonController(PersonService personService) {
        this.personService = personService;
    }

    @GetMapping("/persons")
    public R<PageResult<PersonSummary>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam(defaultValue = "created") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        if (page < 1) {
            page = 1;
        }
        if (size < 1 || size > 100) {
            size = 24;
        }
        return R.ok(personService.search(keyword, page, size, sortBy, sortDir));
    }

    @PostMapping("/persons")
    public R<Map<String, String>> create(@Valid @RequestBody PersonForm form) {
        String id = personService.create(form);
        return R.ok(Collections.singletonMap("id", id));
    }

    @GetMapping("/persons/{id}")
    public R<PersonDetail> detail(@PathVariable String id) {
        return R.ok(personService.detail(id));
    }

    @PutMapping("/persons/{id}")
    public R<Void> update(@PathVariable String id, @Valid @RequestBody PersonForm form) {
        personService.update(id, form);
        return R.ok();
    }

    /** 快捷打分（卡片右键菜单）：rating 取 0-5，0 表示清除评分 */
    @PutMapping("/persons/{id}/rating")
    public R<Void> rate(@PathVariable String id, @Valid @RequestBody RatingForm form) {
        personService.setRating(id, form.getRating());
        return R.ok();
    }

    /** 固定 / 取消固定：固定后在列表里恒排最前，不参与排序 */
    @PutMapping("/persons/{id}/pinned")
    public R<Void> pin(@PathVariable String id, @Valid @RequestBody PinnedForm form) {
        personService.setPinned(id, form.getPinned());
        return R.ok();
    }

    /** 删除人物档案（仅数据库记录，绝不触碰媒体文件） */
    @DeleteMapping("/persons/{id}")
    public R<Void> delete(@PathVariable String id) {
        personService.delete(id);
        return R.ok();
    }

    /** 重新扫描媒体目录，返回扫描到的文件数 */
    @PostMapping("/persons/{id}/rescan")
    public R<Map<String, Object>> rescan(@PathVariable String id) {
        int count = personService.rescan(id);
        return R.ok(Collections.singletonMap("count", (Object) count));
    }

    /** 浏览人物媒体目录（只读）：多级目录、含非媒体文件 */
    // ---- 见面记录 ----

    @GetMapping("/persons/{id}/meets")
    public R<List<MeetRecord>> meets(@PathVariable String id) {
        return R.ok(personService.listMeets(id));
    }

    @PostMapping("/persons/{id}/meets")
    public R<MeetRecord> addMeet(@PathVariable String id, @RequestBody MeetForm form) {
        return R.ok(personService.addMeet(id, form));
    }

    @DeleteMapping("/persons/{id}/meets/{meetId}")
    public R<Void> deleteMeet(@PathVariable String id, @PathVariable Long meetId) {
        personService.deleteMeet(id, meetId);
        return R.ok(null);
    }

    /** 媒体明细分页；type=PHOTO|VIDEO；sort=name|size|dims|created|modified */
    @GetMapping("/persons/{id}/media")
    public R<PageResult<Media>> media(
            @PathVariable String id,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "48") int size,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir) {
        return R.ok(personService.mediaPage(
                id, type, Math.max(1, page), Math.min(200, Math.max(1, size)), sort, dir));
    }

    @GetMapping("/persons/{id}/files")
    public R<List<FileNode>> files(@PathVariable String id,
                                   @RequestParam(required = false) String path) {
        return R.ok(personService.listFiles(id, path));
    }

    @GetMapping("/tags")
    public R<List<Tag>> tags() {
        return R.ok(personService.allTags());
    }
}
