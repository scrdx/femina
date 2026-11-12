package com.femina.service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.femina.common.ApiException;
import com.femina.util.FilePathUtil;
import com.femina.mapper.AccountMapper;
import com.femina.mapper.MeetMapper;
import com.femina.mapper.MediaMapper;
import com.femina.mapper.PersonMapper;
import com.femina.mapper.TagMapper;
import com.femina.model.Media;
import com.femina.model.MeetRecord;
import com.femina.model.Person;
import com.femina.model.PersonAccount;
import com.femina.model.Tag;
import com.femina.model.dto.PersonDtos.AccountEntry;
import com.femina.model.dto.PersonDtos.FileNode;
import com.femina.model.dto.PersonDtos.MeetForm;
import com.femina.model.dto.PersonDtos.PageResult;
import com.femina.model.dto.PersonDtos.PersonDetail;
import com.femina.model.dto.PersonDtos.PersonForm;
import com.femina.model.dto.PersonDtos.PersonSummary;

@Service
public class PersonService {

    private final PersonMapper personMapper;
    private final AccountMapper accountMapper;
    private final TagMapper tagMapper;
    private final MediaMapper mediaMapper;
    private final MeetMapper meetMapper;
    private final MediaScanService mediaScanService;
    private final ThumbService thumbService;

    public PersonService(PersonMapper personMapper, AccountMapper accountMapper, TagMapper tagMapper,
                         MediaMapper mediaMapper, MeetMapper meetMapper, MediaScanService mediaScanService,
                         ThumbService thumbService) {
        this.personMapper = personMapper;
        this.accountMapper = accountMapper;
        this.tagMapper = tagMapper;
        this.mediaMapper = mediaMapper;
        this.meetMapper = meetMapper;
        this.mediaScanService = mediaScanService;
        this.thumbService = thumbService;
    }

    @Transactional
    public String create(PersonForm form) {
        Person person = new Person();
        person.setId(UUID.randomUUID().toString());
        applyForm(person, form);
        personMapper.insert(person);
        saveAccounts(person.getId(), form.getAccounts());
        saveTags(person.getId(), form.getTags());
        if (StringUtils.isNotBlank(form.getMediaDir())) {
            mediaScanService.scanAndSave(person.getId(), form.getMediaDir());
            thumbService.schedulePerson(person.getId());
        }
        return person.getId();
    }

    @Transactional
    public void update(String id, PersonForm form) {
        Person existing = requirePerson(id);
        String oldDir = existing.getMediaDir();
        applyForm(existing, form);
        personMapper.update(existing);
        accountMapper.deleteByPerson(id);
        saveAccounts(id, form.getAccounts());
        tagMapper.detachByPerson(id);
        saveTags(id, form.getTags());
        // 媒体目录变化时重新扫描（仅操作数据库记录，不动文件）
        if (!StringUtils.equals(StringUtils.trimToEmpty(oldDir), StringUtils.trimToEmpty(form.getMediaDir()))) {
            mediaScanService.rescan(id, form.getMediaDir());
            thumbService.schedulePerson(id);
        }
    }

    /** 快捷打分（卡片右键菜单）：rating 取 0-5，0 表示清除评分 */
    public void setRating(String id, Integer rating) {
        requirePerson(id);
        int r = rating == null ? 0 : rating;
        if (r < 0 || r > 5) {
            throw ApiException.badRequest("评分只能是 0-5，0 表示未评分");
        }
        personMapper.updateRating(id, r);
    }

    /** 固定 / 取消固定：固定后在列表里恒排最前，不参与排序 */
    public void setPinned(String id, Boolean pinned) {
        requirePerson(id);
        personMapper.updatePinned(id, Boolean.TRUE.equals(pinned));
    }

    /**
     * 删除人物档案。仅删除数据库记录（人物、账号、标签关联、媒体记录），
     * 绝不删除或修改用户的任何媒体文件。
     */
    @Transactional
    public void delete(String id) {
        requirePerson(id);
        mediaMapper.deleteByPerson(id);
        accountMapper.deleteByPerson(id);
        tagMapper.detachByPerson(id);
        meetMapper.deleteByPerson(id);
        personMapper.deleteById(id);
    }

    // ---- 见面记录 ----

    public List<MeetRecord> listMeets(String personId) {
        requirePerson(personId);
        return meetMapper.findByPerson(personId);
    }

    /** 新增见面记录；日期必填（「非必填」指人物可以没有记录，单条记录必须有日期） */
    public MeetRecord addMeet(String personId, MeetForm form) {
        requirePerson(personId);
        String raw = form == null ? null : form.getMeetDate();
        if (StringUtils.isBlank(raw)) {
            throw ApiException.badRequest("见面日期必填");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("日期格式应为 YYYY-MM-DD");
        }
        MeetRecord r = new MeetRecord();
        r.setPersonId(personId);
        r.setMeetDate(date);
        meetMapper.insert(r);
        return r;
    }

    public void deleteMeet(String personId, Long meetId) {
        requirePerson(personId);
        if (meetMapper.deleteByIdAndPerson(meetId, personId) == 0) {
            throw ApiException.badRequest("见面记录不存在");
        }
    }

    public PersonDetail detail(String id) {
        Person p = requirePerson(id);
        PersonDetail d = new PersonDetail();
        d.setId(p.getId());
        d.setName(p.getName());
        d.setNickname(p.getNickname());
        d.setBirthYearOnly(Boolean.TRUE.equals(p.getBirthYearOnly()));
        d.setBirthDate(p.getBirthDate() == null ? null : p.getBirthDate().toString());
        d.setBirthYear(p.getBirthYear());
        d.setHometown(p.getHometown());
        d.setEducation(p.getEducation());
        d.setHeightCm(p.getHeightCm());
        d.setWeightKg(p.getWeightKg());
        d.setMediaDir(p.getMediaDir());
        d.setCoverPath(p.getCoverPath());
        d.setCoverData(p.getCoverData());
        d.setRemarks(p.getRemarks());
        // 归一化：实体里理论上不会是 null（列为 NOT NULL），但存量行迁移前后仍兜底一次
        d.setRating(p.getRating() == null ? 0 : p.getRating());
        d.setPinned(Boolean.TRUE.equals(p.getPinned()));
        d.setCreatedAt(p.getCreatedAt() == null ? null : p.getCreatedAt().toString());

        d.setAccounts(accountMapper.findByPerson(id).stream().map(a -> {
            AccountEntry e = new AccountEntry();
            e.setType(a.getType());
            e.setValue(a.getValue());
            return e;
        }).collect(Collectors.toList()));

        d.setTags(tagMapper.findByPerson(id).stream().map(Tag::getName).collect(Collectors.toList()));

        d.setPhotoCount(mediaMapper.countByPerson(id, "PHOTO"));
        d.setVideoCount(mediaMapper.countByPerson(id, "VIDEO"));
        return d;
    }

    /** 媒体排序白名单（与 MediaMapper.xml 的 <choose> 一致） */
    private static final Set<String> MEDIA_SORT_FIELDS = new HashSet<>(
            Arrays.asList("name", "size", "dims", "created", "modified"));

    /** 分页拉取媒体明细（type 为 null 不限类型）；page 从 1 起；sort/dir 兜底校验 */
    public PageResult<Media> mediaPage(String id, String type, int page, int size,
            String sort, String dir) {
        String s = MEDIA_SORT_FIELDS.contains(sort) ? sort : "name";
        String d = "desc".equalsIgnoreCase(dir) ? "desc" : "asc";
        long total = mediaMapper.countByPerson(id, type);
        List<Media> items = total == 0
                ? new ArrayList<>()
                : mediaMapper.findByPersonPaged(id, type, (page - 1) * size, size, s, d);
        return new PageResult<>(items, total, page, size);
    }

    /** 允许的排序字段（与 PersonMapper.xml 中 <choose> 白名单一致） */
    private static final Set<String> SORT_FIELDS =
            new HashSet<>(Arrays.asList("nickname", "created", "updated", "media",
                    "firstMeet", "lastMeet", "rating"));

    public PageResult<PersonSummary> search(String keyword, int page, int size,
                                            String sortBy, String sortDir) {
        String kw = StringUtils.trimToNull(keyword);
        // 白名单兜底：非法值回退默认排序
        String sort = SORT_FIELDS.contains(sortBy) ? sortBy : "created";
        String dir = "asc".equalsIgnoreCase(sortDir) ? "asc" : "desc";
        long total = personMapper.countSearch(kw);
        List<PersonSummary> items = total == 0
                ? new ArrayList<>()
                : personMapper.search(kw, (page - 1) * size, size, sort, dir);
        if (!items.isEmpty()) {
            List<String> ids = items.stream().map(PersonSummary::getId).collect(Collectors.toList());
            Map<String, List<String>> tagMap = new LinkedHashMap<>();
            for (TagMapper.PersonTagView v : tagMapper.findByPersonIds(ids)) {
                tagMap.computeIfAbsent(v.getPersonId(), k -> new ArrayList<>()).add(v.getTagName());
            }
            items.forEach(s -> s.setTags(tagMap.getOrDefault(s.getId(), new ArrayList<>())));
        }
        return new PageResult<>(items, total, page, size);
    }

    /** 重新扫描某人物的媒体目录，返回扫描到的文件数 */
    @Transactional
    public int rescan(String id) {
        Person p = requirePerson(id);
        int count = mediaScanService.rescan(id, p.getMediaDir());
        thumbService.schedulePerson(id);
        return count;
    }

    public List<Tag> allTags() {
        return tagMapper.findAll();
    }

    /**
     * 浏览人物媒体目录下的内容（只读，多级目录、含非媒体文件）。
     * relPath 为相对 mediaDir 的路径，空串表示根目录；严格限制在 mediaDir 内。
     */
    public List<FileNode> listFiles(String personId, String relPath) {
        Person person = requirePerson(personId);
        if (StringUtils.isBlank(person.getMediaDir())) {
            throw ApiException.badRequest("该人物未设置媒体目录");
        }
        Path base = Paths.get(person.getMediaDir()).toAbsolutePath().normalize();
        if (!Files.isDirectory(base)) {
            throw ApiException.notFound("媒体目录不存在: " + person.getMediaDir());
        }
        Path dir = FilePathUtil.resolveInside(base, StringUtils.trimToEmpty(relPath));
        if (!Files.isDirectory(dir)) {
            throw ApiException.badRequest("目录不存在: " + relPath);
        }
        File[] children = dir.toFile().listFiles();
        if (children == null) {
            throw ApiException.badRequest("无法读取目录（权限不足）");
        }
        Arrays.sort(children, Comparator
                .comparing((File f) -> !f.isDirectory())
                .thenComparing(f -> f.getName().toLowerCase()));
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        List<FileNode> nodes = new ArrayList<>();
        for (File f : children) {
            if (f.isHidden()) {
                continue;
            }
            FileNode n = new FileNode();
            n.setName(f.getName());
            n.setRelPath(base.relativize(f.toPath().toAbsolutePath().normalize())
                    .toString().replace('\\', '/'));
            n.setDir(f.isDirectory());
            if (f.isDirectory()) {
                n.setType("DIR");
            } else {
                String ext = FilenameUtils.getExtension(f.getName());
                n.setType(MediaScanService.isPhoto(ext) ? "PHOTO"
                        : MediaScanService.isVideo(ext) ? "VIDEO" : "FILE");
                n.setSize(f.length());
            }
            n.setModified(fmt.format(LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(f.lastModified()), ZoneId.systemDefault())));
            nodes.add(n);
        }
        return nodes;
    }

    public Person requirePerson(String id) {
        Person p = personMapper.findById(id);
        if (p == null) {
            throw ApiException.notFound("人物不存在: " + id);
        }
        return p;
    }

    private void applyForm(Person person, PersonForm form) {
        // 姓名可能未知（可空）；昵称为必填的主显示名
        person.setName(StringUtils.trimToNull(form.getName()));
        person.setNickname(form.getNickname().trim());
        boolean yearOnly = Boolean.TRUE.equals(form.getBirthYearOnly());
        person.setBirthYearOnly(yearOnly);
        if (yearOnly) {
            person.setBirthDate(null);
            person.setBirthYear(form.getBirthYear());
        } else {
            LocalDate date = null;
            if (StringUtils.isNotBlank(form.getBirthDate())) {
                try {
                    date = LocalDate.parse(form.getBirthDate().trim());
                } catch (DateTimeParseException e) {
                    throw ApiException.badRequest("出生日期格式不正确，应为 yyyy-MM-dd");
                }
            }
            person.setBirthDate(date);
            // 避免三元表达式对 Integer 自动拆箱导致 NPE
            Integer year = form.getBirthYear();
            if (date != null) {
                year = date.getYear();
            }
            person.setBirthYear(year);
        }
        person.setHometown(StringUtils.trimToNull(form.getHometown()));
        person.setEducation(StringUtils.trimToNull(form.getEducation()));
        person.setHeightCm(form.getHeightCm());
        person.setWeightKg(form.getWeightKg());
        person.setMediaDir(StringUtils.trimToNull(form.getMediaDir()));
        person.setCoverPath(StringUtils.trimToNull(form.getCoverPath()));
        // 裁剪封面只存数据库（data URL），绝不写回用户媒体目录
        String coverData = StringUtils.trimToNull(form.getCoverData());
        if (coverData != null && !coverData.startsWith("data:image/")) {
            throw ApiException.badRequest("封面格式不正确，应为图片 data URL");
        }
        // 封面被移除时裁剪结果一并失效
        person.setCoverData(person.getCoverPath() == null ? null : coverData);
        person.setRemarks(StringUtils.trimToNull(form.getRemarks()));
        // 评分/固定：请求未带该字段（null）时保持原值，避免旧客户端全量更新把已打的星清零；
        // 新建时实体里本来就是 null，兜底成 0/false（两列都是 NOT NULL）
        Integer rating = form.getRating();
        if (rating != null) {
            person.setRating(rating);
        } else if (person.getRating() == null) {
            person.setRating(0);
        }
        if (form.getPinned() != null) {
            person.setPinned(form.getPinned());
        } else if (person.getPinned() == null) {
            person.setPinned(false);
        }
        // 封面必须位于媒体目录语义下（相对路径），去掉任何绝对路径/穿越写法
        if (person.getCoverPath() != null) {
            String cp = person.getCoverPath().replace('\\', '/');
            if (cp.startsWith("/") || cp.contains("..")) {
                throw ApiException.badRequest("封面路径不合法");
            }
            person.setCoverPath(cp);
        }
    }

    private void saveAccounts(String personId, List<AccountEntry> accounts) {
        if (accounts == null || accounts.isEmpty()) {
            return;
        }
        List<PersonAccount> list = new ArrayList<>();
        int sort = 0;
        for (AccountEntry e : accounts) {
            if (StringUtils.isBlank(e.getType()) || StringUtils.isBlank(e.getValue())) {
                continue;
            }
            list.add(new PersonAccount(null, personId, e.getType().trim(), e.getValue().trim(), sort++));
        }
        if (!list.isEmpty()) {
            accountMapper.batchInsert(personId, list);
        }
    }

    private void saveTags(String personId, List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return;
        }
        for (String raw : tags) {
            String name = StringUtils.trimToNull(raw);
            if (name == null || name.length() > 64) {
                continue;
            }
            tagMapper.insertIgnore(name);
            Tag tag = tagMapper.findByName(name);
            if (tag != null) {
                tagMapper.attach(personId, tag.getId());
            }
        }
    }
}
