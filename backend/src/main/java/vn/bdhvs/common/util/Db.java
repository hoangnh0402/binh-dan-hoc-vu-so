package vn.bdhvs.common.util;

import java.sql.Timestamp;
import java.time.Instant;

/** Chuyển đổi kiểu khi gửi tham số cho SQL Server (DATETIME2 lưu UTC; JVM chạy múi giờ UTC). */
public final class Db {

    private Db() {
    }

    public static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }
}
