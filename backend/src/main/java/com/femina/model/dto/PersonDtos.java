package com.femina.model.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

import com.femina.model.Media;

import lombok.Data;

/**
 * 人物模块 DTO 集合。
 */
public class PersonDtos {

    @Data
    public static class AccountEntry {
        @NotBlank(message = "账号类型不能为空")
        private String type;
        @NotBlank(message = "账号值不能为空")
        private String value;
    }

    /** 创建/更新人物的请求体 */
    @Data
    public static class PersonForm {
        /** 姓名可能未知，选填 */
        @Size(max = 64, message = "姓名过长")
        private String name;

        @NotBlank(message = "昵称不能为空")
        @Size(max = 64, message = "昵称过长")
        private String nickname;

        /** true 表示只知道出生年份 */
        private Boolean birthYearOnly = false;
        /** yyyy-MM-dd，birthYearOnly=false 时有效 */
        private String birthDate;
        /** 出生年份，两种模式都可填 */
        private Integer birthYear;

        private String hometown;
        private String education;
        private Integer heightCm;
        private BigDecimal weightKg;

        /** 媒体文件所在目录（绝对路径） */
        private String mediaDir;
        /** 封面图片路径，相对 mediaDir */
        private String coverPath;
        /** 裁剪后封面 base64 data URL；null 表示使用原图 */
        @Size(max = 1000000, message = "封面裁剪图过大")
        private String coverData;

        /** 备注，选填 */
        private String remarks;

        /** 评分 1-5，0 表示未评分；null 表示本次请求不涉及该字段（更新时保持原值） */
        @Min(value = 0, message = "评分不能小于 0")
        @Max(value = 5, message = "评分不能大于 5")
        private Integer rating;

        /** 固定置顶；null 同上，更新时保持原值 */
        private Boolean pinned;

        private List<AccountEntry> accounts = new ArrayList<>();
        private List<String> tags = new ArrayList<>();
    }

    /** 卡片右键「快捷打分」请求体：0 表示清除评分 */
    @Data
    public static class RatingForm {
        @NotNull(message = "评分不能为空")
        @Min(value = 0, message = "评分不能小于 0")
        @Max(value = 5, message = "评分不能大于 5")
        private Integer rating;
    }

    /** 卡片右键「固定/取消固定」请求体 */
    @Data
    public static class PinnedForm {
        @NotNull(message = "pinned 不能为空")
        private Boolean pinned;
    }

    /**
     * 海报墙列表项（含翻卡背面所需的基本信息）。
     * 注意：不带裁剪封面 base64（coverData）——110 个人物时那会让列表 JSON 涨到几十 MB；
     * 封面统一走 GET /api/persons/{id}/cover（可按尺寸档降采样、可长缓存）。
     */
    @Data
    public static class PersonSummary {
        private String id;
        private String name;
        private String nickname;
        private String coverPath;
        private Boolean birthYearOnly;
        private java.time.LocalDate birthDate;
        private Integer birthYear;
        private String hometown;
        private String education;
        private Integer heightCm;
        private BigDecimal weightKg;
        /** 媒体文件数（照片+视频），用于排序展示 */
        private Long mediaCount;
        /** 评分 1-5，0 表示未评分（卡片左上角仅在 >0 时显示星星） */
        private Integer rating;
        /** 固定置顶：恒排列表最前，不参与排序 */
        private Boolean pinned;
        private List<String> tags = new ArrayList<>();
        /** 首次/最近见面日期（无记录为 null），供首页排序 */
        private LocalDate firstMeet;
        private LocalDate lastMeet;
    }

    /** 新增见面记录请求：meetDate 可为 null / 空串（见面时间非必填） */
    @Data
    public static class MeetForm {
        private String meetDate;
    }

    /** 详情页完整数据 */
    @Data
    public static class PersonDetail {
        private String id;
        private String name;
        private String nickname;
        private Boolean birthYearOnly;
        private String birthDate;
        private Integer birthYear;
        private String hometown;
        private String education;
        private Integer heightCm;
        private BigDecimal weightKg;
        private String mediaDir;
        private String coverPath;
        private String coverData;
        private String remarks;
        /** 评分 1-5，0 表示未评分 */
        private Integer rating;
        /** 固定置顶 */
        private Boolean pinned;
        private String createdAt;
        private List<AccountEntry> accounts = new ArrayList<>();
        private List<String> tags = new ArrayList<>();
        /** 媒体明细走 GET /api/persons/{id}/media 分页获取，详情只带计数 */
        private long photoCount;
        private long videoCount;
    }

    /** 人物媒体目录下的文件浏览节点（只读） */
    @Data
    public static class FileNode {
        private String name;
        /** 相对 mediaDir 的路径，/ 分隔 */
        private String relPath;
        private boolean dir;
        /** DIR / PHOTO / VIDEO / FILE */
        private String type;
        private long size;
        /** yyyy-MM-dd HH:mm */
        private String modified;
    }

    /** 通用分页结果 */
    @Data
    public static class PageResult<T> {
        private List<T> items;
        private long total;
        private int page;
        private int size;

        public PageResult(List<T> items, long total, int page, int size) {
            this.items = items;
            this.total = total;
            this.page = page;
            this.size = size;
        }
    }
}
