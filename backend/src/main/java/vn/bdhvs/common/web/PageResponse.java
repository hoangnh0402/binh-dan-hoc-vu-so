package vn.bdhvs.common.web;

import java.util.List;

/** Phản hồi danh sách có phân trang (SRS 08 §1.2). */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    public static <T> PageResponse<T> of(List<T> items, int page, int size, long total) {
        return new PageResponse<>(items, page, size, total, size == 0 ? 0 : (int) ((total + size - 1) / size));
    }

    /** Chuẩn hóa tham số phân trang: page >= 0, 1 <= size <= max. */
    public static int[] clamp(Integer page, Integer size, int defaultSize, int max) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null || size < 1 ? defaultSize : Math.min(size, max);
        return new int[] {p, s};
    }
}
