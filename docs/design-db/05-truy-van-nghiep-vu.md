# 05 — Truy vấn nghiệp vụ mẫu (T-SQL)

Các truy vấn dưới đây là **mẫu tham chiếu** cho lập trình viên backend: dùng trực tiếp với `@Query(nativeQuery = true)` / `JdbcTemplate`, hoặc dùng để kiểm tra kế hoạch thực thi khi viết bằng JPA Criteria. Tham số viết dạng `@ten_tham_so`.

---

## 1. Tìm kiếm & lọc khóa học (FR-CRS-01..04)

Ứng dụng **chỉ thêm điều kiện cho bộ lọc người dùng đã chọn**, dùng Criteria API / QueryDSL hoặc ghép chuỗi có tham số. Không viết một câu "bao tất cả" kiểu `(@x IS NULL OR col = @x)`, vì dạng này dễ khiến SQL Server chọn kế hoạch thực thi kém.

Ví dụ: từ khóa "an toan", lĩnh vực "Kỹ năng số" (cấp 1, id = 1), trình độ Cơ bản hoặc Trung cấp, trạng thái Đang mở, tổ chức 12 hoặc 15, sắp xếp mới nhất, trang 2 (12 mục/trang):

```sql
DECLARE @now DATETIME2(3) = SYSUTCDATETIME();

SELECT  c.id, c.title, c.slug, c.short_description, c.thumbnail_url, c.course_level,
        c.published_lesson_count, c.estimated_minutes, c.enrollment_count, c.rating_avg, c.rating_count,
        c.start_date, c.end_date,
        o.id   AS organization_id, o.name AS organization_name,
        cat.id AS category_id,     cat.name AS category_name,
        par.id AS parent_category_id, par.name AS parent_category_name,
        CASE WHEN c.start_date > @now THEN N'UPCOMING'
             WHEN c.end_date   < @now THEN N'ENDED'
             ELSE N'OPEN' END AS time_status,
        COUNT(*) OVER () AS total_items
FROM dbo.courses c
JOIN dbo.organizations     o   ON o.id   = c.organization_id
JOIN dbo.course_categories cat ON cat.id = c.category_id
JOIN dbo.course_categories par ON par.id = cat.parent_id
WHERE c.publish_status = N'PUBLISHED'
  AND cat.is_active = 1 AND par.is_active = 1
  -- Từ khóa: @kw đã được normalize + escape ở Java, ví dụ N'an toan'
  AND c.search_text LIKE N'%' + @kw + N'%' ESCAPE N'\'
  -- Lĩnh vực: chọn cấp 1 bao gồm mọi cấp 2 con; chọn cấp 2 thì khớp trực tiếp
  AND (cat.id IN (@cat1) OR par.id IN (@cat1))
  -- Trình độ
  AND c.course_level IN (N'BASIC', N'INTERMEDIATE')
  -- Trạng thái "Đang mở" (BR-CRS-01)
  AND (c.start_date IS NULL OR c.start_date <= @now)
  AND (c.end_date   IS NULL OR c.end_date   >= @now)
  -- Tổ chức đào tạo
  AND c.organization_id IN (@org1, @org2)
ORDER BY c.published_at DESC, c.id DESC
OFFSET 12 ROWS FETCH NEXT 12 ROWS ONLY;
```

**Bảng ánh xạ bộ lọc → điều kiện:**

| Bộ lọc | Điều kiện thêm vào `WHERE` |
|--------|----------------------------|
| `status=UPCOMING` | `c.start_date > @now` |
| `status=OPEN` | như ví dụ |
| `status=ENDED` | `c.end_date < @now` |
| Nhiều trạng thái | Nối các điều kiện trên bằng `OR` trong một cặp ngoặc |
| `myStatus=NOT_ENROLLED` | `NOT EXISTS (SELECT 1 FROM dbo.enrollments e WHERE e.course_id = c.id AND e.user_id = @userId AND e.status <> N'CANCELLED')` |
| `myStatus=IN_PROGRESS` / `COMPLETED` / `EXPIRED` | `EXISTS (SELECT 1 FROM dbo.enrollments e WHERE e.course_id = c.id AND e.user_id = @userId AND e.status = N'IN_PROGRESS')` (thay bằng trạng thái tương ứng) |

**Sắp xếp:**

| `sort` | `ORDER BY` |
|--------|------------|
| `newest` *(mặc định khi không có từ khóa)* | `c.published_at DESC, c.id DESC` |
| `relevance` *(mặc định khi có từ khóa)* | `CASE WHEN c.search_text LIKE @kw + N'%' THEN 0 ELSE 1 END, c.enrollment_count DESC, c.id DESC` (`search_text` bắt đầu bằng tên khóa học, nên khớp ở đầu chuỗi nghĩa là tên bắt đầu bằng từ khóa) |
| `popular` | `c.enrollment_count DESC, c.id DESC` |
| `rating` | `c.rating_avg DESC, c.rating_count DESC, c.id DESC` |
| `title` | `c.title ASC, c.id ASC` (collation `Vietnamese_100` sắp xếp đúng tiếng Việt) |

> `COUNT(*) OVER ()` trả về tổng số bản ghi trong cùng một truy vấn, phục vụ `totalItems`. Nếu số lượng lớn, tách thành truy vấn `COUNT(*)` riêng.

**Escape từ khóa** (Java): thay `\` → `\\`, `%` → `\%`, `_` → `\_`, `[` → `\[` rồi dùng `ESCAPE N'\'`.

### 1.1 Đếm theo từng giá trị lọc (facet, `GET /courses/facets`)

Đếm cho nhóm "Trình độ": áp dụng **mọi bộ lọc khác trừ trình độ**:

```sql
SELECT c.course_level, COUNT(*) AS course_count
FROM dbo.courses c
JOIN dbo.course_categories cat ON cat.id = c.category_id
JOIN dbo.course_categories par ON par.id = cat.parent_id
WHERE c.publish_status = N'PUBLISHED'
  AND c.search_text LIKE N'%' + @kw + N'%' ESCAPE N'\'
  AND (cat.id IN (@cat1) OR par.id IN (@cat1))
  -- (không có điều kiện course_level)
GROUP BY c.course_level;
```

Làm tương tự cho trạng thái, lĩnh vực, tổ chức. Kết quả nên cache ở Redis khoảng 60 giây theo khóa là tổ hợp bộ lọc.

---

## 2. Giáo trình & trạng thái mở khóa của người học (FR-LRN-01, FR-LRN-07, BR-LRN-02)

```sql
WITH l AS (
    SELECT  l.id, l.title, l.order_index, l.estimated_minutes,
            q.id AS quiz_id,
            lp.status AS progress_status,
            -- Số bài CHƯA hoàn thành đứng trước bài hiện tại
            SUM(CASE WHEN lp.status = N'COMPLETED' THEN 0 ELSE 1 END)
                OVER (ORDER BY l.order_index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS incomplete_before
    FROM dbo.lessons l
    LEFT JOIN dbo.quizzes q          ON q.lesson_id = l.id
    LEFT JOIN dbo.lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = @enrollmentId
    WHERE l.course_id = @courseId
      AND l.is_published = 1
)
SELECT  id, title, order_index, estimated_minutes, quiz_id,
        CASE
            WHEN progress_status = N'COMPLETED'      THEN N'COMPLETED'
            WHEN progress_status = N'IN_PROGRESS'    THEN N'IN_PROGRESS'   -- đã từng mở thì luôn truy cập được
            WHEN ISNULL(incomplete_before, 0) = 0    THEN N'UNLOCKED'      -- bài đầu tiên, hoặc mọi bài trước đã xong
            ELSE N'LOCKED'
        END AS lesson_state
FROM l
ORDER BY order_index;
```

**Kiểm tra quyền vào một bài** (`GET /learning/lessons/{id}`, bắt đầu quiz): chạy cùng CTE, lọc theo `id = @lessonId`. Nếu `lesson_state = 'LOCKED'` thì trả `403 LESSON_LOCKED`. Ngoài ra kiểm tra thêm:
- enrollment thuộc về `@userId` và có `status IN ('IN_PROGRESS','COMPLETED')`, nếu không thì `403 NOT_ENROLLED`;
- `courses.start_date <= now`, nếu không thì `403 COURSE_NOT_STARTED` (BR-LRN-06);
- enrollment `IN_PROGRESS` thì `enrollments.expires_at > now`, nếu không thì `403 ENROLLMENT_EXPIRED` (BR-LRN-10). Kiểm tra này áp dụng cho mọi API `/learning/**`, kể cả lưu nháp và nộp quiz, không chờ job §8.1.

**Ghi nhận mở bài lần đầu** (idempotent, an toàn khi gọi đồng thời):

```sql
INSERT INTO dbo.lesson_progress (enrollment_id, lesson_id, status)
SELECT @enrollmentId, @lessonId, N'IN_PROGRESS'
WHERE NOT EXISTS (SELECT 1 FROM dbo.lesson_progress WITH (UPDLOCK, HOLDLOCK)
                  WHERE enrollment_id = @enrollmentId AND lesson_id = @lessonId);

UPDATE dbo.enrollments SET last_lesson_id = @lessonId, updated_at = SYSUTCDATETIME()
WHERE id = @enrollmentId;
```

---

## 3. Ghi danh (FR-CRS-09, FR-CRS-11)

Mốc thời hạn học (BR-LRN-09): bắt đầu tính từ lúc ghi danh, hoặc từ `start_date` nếu khóa "Sắp mở".

```sql
DECLARE @now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @startAt DATETIME2(3), @durationDays INT, @done INT;

SELECT @startAt      = CASE WHEN start_date > @now THEN start_date ELSE @now END,
       @durationDays = learning_duration_days
FROM dbo.courses
WHERE id = @courseId;

BEGIN TRAN;

-- Lượt IN_PROGRESS/CANCELLED đã quá expires_at mà job chưa xử lý:
-- ứng dụng chạy §8.1 cho đúng enrollment đó trước, trong cùng transaction.

-- 1. Đã hủy và còn hạn: khôi phục, giữ tiến độ và hạn cũ (FR-CRS-11)
UPDATE dbo.enrollments WITH (UPDLOCK, SERIALIZABLE)
SET status = N'IN_PROGRESS', cancelled_at = NULL, updated_at = @now, version = version + 1
WHERE user_id = @userId AND course_id = @courseId AND status = N'CANCELLED' AND expires_at > @now;
SET @done = @@ROWCOUNT;

-- 2. Đã hết hạn: học lại từ đầu với lượt mới (BR-LRN-11). Dữ liệu cũ đã bị xóa ở §8.1
IF @done = 0
BEGIN
    UPDATE dbo.enrollments WITH (UPDLOCK, SERIALIZABLE)
    SET status = N'IN_PROGRESS', round_no = round_no + 1,
        progress_percent = 0, completed_lesson_count = 0, last_lesson_id = NULL,
        enrolled_at = @now, learning_started_at = @startAt,
        expires_at = DATEADD(DAY, @durationDays, @startAt),
        cancelled_at = NULL, expired_at = NULL, expiry_reminder_stage = 0,
        updated_at = @now, version = version + 1
    WHERE user_id = @userId AND course_id = @courseId AND status = N'EXPIRED';
    SET @done = @@ROWCOUNT;
END;

-- 3. Chưa từng ghi danh
IF @done = 0
   AND NOT EXISTS (SELECT 1 FROM dbo.enrollments WITH (UPDLOCK, SERIALIZABLE)
                   WHERE user_id = @userId AND course_id = @courseId)
BEGIN
    INSERT INTO dbo.enrollments (user_id, course_id, enrolled_at, learning_started_at, expires_at)
    VALUES (@userId, @courseId, @now, @startAt, DATEADD(DAY, @durationDays, @startAt));
END;

-- Cập nhật cột tổng hợp
UPDATE dbo.courses
SET enrollment_count = (SELECT COUNT(*) FROM dbo.enrollments
                        WHERE course_id = @courseId AND status IN (N'IN_PROGRESS', N'COMPLETED'))
WHERE id = @courseId;

COMMIT;
```

Nếu đã ghi danh (`IN_PROGRESS`/`COMPLETED`), ứng dụng trả `409 ALREADY_ENROLLED`. Bấm nhiều lần cũng không tạo bản ghi trùng nhờ `uq_enrollments_user_course` (NFR-REL-07).

---

## 4. Làm & nộp quiz (FR-LRN-04, 05; FR-RNK-03)

### 4.1 Bắt đầu lượt làm

```sql
BEGIN TRAN;

-- 1. Có lượt đang làm thì trả lại lượt đó (filtered unique index bảo đảm tối đa 1 lượt)
SELECT id, started_at, expires_at, question_order
FROM dbo.quiz_attempts WITH (UPDLOCK, HOLDLOCK)
WHERE user_id = @userId AND quiz_id = @quizId AND status = N'IN_PROGRESS';

-- 2. Nếu không có: kiểm tra max_attempts và retry_cooldown_seconds
SELECT COUNT(*) AS used_attempts, MAX(submitted_at) AS last_submitted_at
FROM dbo.quiz_attempts
WHERE user_id = @userId AND quiz_id = @quizId;

-- 3. Tạo lượt mới
INSERT INTO dbo.quiz_attempts (quiz_id, user_id, enrollment_id, attempt_no, question_order, expires_at)
VALUES (@quizId, @userId, @enrollmentId, @usedAttempts + 1, @questionOrderJson,
        CASE WHEN @timeLimitSeconds IS NULL THEN NULL
             ELSE DATEADD(SECOND, @timeLimitSeconds + 30, SYSUTCDATETIME()) END);

COMMIT;
```

Lấy đề **không kèm đáp án đúng** (BR-LRN-04):

```sql
SELECT q.id AS question_id, q.content, q.question_type, q.points,
       o.id AS option_id, o.content AS option_content            -- KHÔNG select o.is_correct
FROM dbo.questions q
JOIN dbo.question_options o ON o.question_id = q.id AND o.is_active = 1
WHERE q.quiz_id = @quizId AND q.is_active = 1
ORDER BY q.order_index, o.order_index;   -- ứng dụng sắp lại theo question_order nếu có xáo trộn
```

### 4.2 Lưu nháp câu trả lời (`PUT /attempts/{id}/answers`)

```sql
-- Với mỗi câu trả lời: upsert dòng answer, sau đó thay toàn bộ lựa chọn
MERGE dbo.quiz_attempt_answers WITH (HOLDLOCK) AS t
USING (SELECT @attemptId AS attempt_id, @questionId AS question_id) AS s
   ON t.attempt_id = s.attempt_id AND t.question_id = s.question_id
WHEN MATCHED THEN UPDATE SET answered_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (attempt_id, question_id) VALUES (s.attempt_id, s.question_id)
OUTPUT inserted.id INTO @answerIds;

DELETE FROM dbo.quiz_attempt_answer_options WHERE answer_id = @answerId;
INSERT INTO dbo.quiz_attempt_answer_options (answer_id, option_id)
SELECT @answerId, CAST(value AS BIGINT) FROM OPENJSON(@selectedOptionIdsJson);   -- ví dụ N'[1207,1209]'
```

> `MERGE` trên một dòng có khóa duy nhất kèm `HOLDLOCK` là an toàn. Với thao tác nhiều dòng, ưu tiên mẫu `UPDATE ...; IF @@ROWCOUNT = 0 INSERT ...` như §3.

### 4.3 Nộp bài: chấm điểm và cập nhật tiến độ, xếp hạng trong **một transaction**

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @now DATETIME2(3) = SYSUTCDATETIME();

-- (a) Khóa lượt làm, xác nhận còn IN_PROGRESS và chưa quá hạn (+30s đã tính trong expires_at)
--     Ứng dụng kiểm tra: @now <= expires_at (nếu có), nếu không thì chỉ chấm các câu đã lưu.
--     Đồng thời kiểm tra hạn học: @now <= enrollments.expires_at, nếu không thì 403 ENROLLMENT_EXPIRED, không chấm.

-- (b) Chấm từng câu: đúng khi tập đáp án chọn == tập đáp án đúng (BR-LRN-03)
;WITH correct AS (
    SELECT o.question_id, o.id AS option_id
    FROM dbo.question_options o
    JOIN dbo.questions q ON q.id = o.question_id
    WHERE q.quiz_id = @quizId AND q.is_active = 1 AND o.is_active = 1 AND o.is_correct = 1
),
graded AS (
    SELECT a.id AS answer_id, a.question_id,
           CASE WHEN NOT EXISTS (   -- chọn thừa
                         SELECT ao.option_id FROM dbo.quiz_attempt_answer_options ao WHERE ao.answer_id = a.id
                         EXCEPT SELECT c.option_id FROM correct c WHERE c.question_id = a.question_id)
                 AND NOT EXISTS (   -- chọn thiếu
                         SELECT c.option_id FROM correct c WHERE c.question_id = a.question_id
                         EXCEPT SELECT ao.option_id FROM dbo.quiz_attempt_answer_options ao WHERE ao.answer_id = a.id)
                 AND EXISTS (SELECT 1 FROM dbo.quiz_attempt_answer_options ao WHERE ao.answer_id = a.id)
                THEN 1 ELSE 0 END AS is_correct
    FROM dbo.quiz_attempt_answers a
    WHERE a.attempt_id = @attemptId
)
UPDATE a
SET a.is_correct = g.is_correct,
    a.points_awarded = CASE WHEN g.is_correct = 1 THEN q.points ELSE 0 END
FROM dbo.quiz_attempt_answers a
JOIN graded g        ON g.answer_id = a.id
JOIN dbo.questions q ON q.id = a.question_id;

-- (c) Tổng hợp kết quả lượt
DECLARE @score DECIMAL(7,2) = (SELECT ISNULL(SUM(points_awarded), 0) FROM dbo.quiz_attempt_answers WHERE attempt_id = @attemptId);
DECLARE @max   DECIMAL(7,2) = (SELECT SUM(points) FROM dbo.questions WHERE quiz_id = @quizId AND is_active = 1);
DECLARE @pct   DECIMAL(5,2) = CASE WHEN @max > 0 THEN CAST(@score * 100 / @max AS DECIMAL(5,2)) ELSE 0 END;
DECLARE @dur   INT;
DECLARE @passed BIT = CASE WHEN @pct >= @passScorePercent THEN 1 ELSE 0 END;
DECLARE @countsForRanking BIT = CASE WHEN @courseEndDate IS NULL OR @now <= @courseEndDate THEN 1 ELSE 0 END;

UPDATE dbo.quiz_attempts
SET status = N'SUBMITTED', submitted_at = @now,
    @dur = duration_seconds = DATEDIFF(SECOND, started_at, @now),
    score = @score, max_score = @max, score_percent = @pct,
    passed = @passed, counts_for_ranking = @countsForRanking
WHERE id = @attemptId AND status = N'IN_PROGRESS';
-- @@ROWCOUNT = 0 → lượt đã được nộp trước đó (bấm 2 lần) → ROLLBACK, trả kết quả cũ (idempotent)

-- (d) Đạt → hoàn thành bài học (BR-LRN-01)
IF @passed = 1
BEGIN
    UPDATE dbo.lesson_progress
    SET status = N'COMPLETED', completed_at = @now, completion_method = N'QUIZ_PASSED'
    WHERE enrollment_id = @enrollmentId AND lesson_id = @lessonId AND status = N'IN_PROGRESS';
    -- Sau đó cập nhật tiến độ enrollment theo §5
END;

-- (e) Cập nhật lượt tốt nhất & xếp hạng theo §6.1, §6.2 (chỉ khi @countsForRanking = 1)

COMMIT;
```

---

## 5. Tính lại tiến độ & hoàn thành khóa học (FR-LRN-08, FR-LRN-11)

```sql
UPDATE e
SET e.completed_lesson_count = x.done,
    e.progress_percent = CASE WHEN x.total = 0 THEN 0 ELSE x.done * 100 / x.total END,  -- chia nguyên = làm tròn xuống
    e.status       = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done = x.total
                          THEN N'COMPLETED' ELSE e.status END,
    e.completed_at = CASE WHEN e.status = N'IN_PROGRESS' AND x.total > 0 AND x.done = x.total
                          THEN SYSUTCDATETIME() ELSE e.completed_at END,
    e.updated_at   = SYSUTCDATETIME(),
    e.version      = e.version + 1
FROM dbo.enrollments e
CROSS APPLY (
    SELECT COUNT(*) AS total,
           ISNULL(SUM(CASE WHEN lp.status = N'COMPLETED' THEN 1 ELSE 0 END), 0) AS done
    FROM dbo.lessons l
    LEFT JOIN dbo.lesson_progress lp ON lp.lesson_id = l.id AND lp.enrollment_id = e.id
    WHERE l.course_id = e.course_id AND l.is_published = 1
) x
WHERE e.id = @enrollmentId;
```

Khi Admin thêm, ẩn hoặc xuất bản bài học, chạy lại câu trên cho **mọi** enrollment của khóa (thay `WHERE e.id = @enrollmentId` bằng `WHERE e.course_id = @courseId AND e.status IN (N'IN_PROGRESS', N'COMPLETED')`) trong một job nền, đồng thời cập nhật `courses.published_lesson_count`. Enrollment đã `COMPLETED` giữ nguyên trạng thái (FR-LRN-11).

---

## 6. Xếp hạng (FR-RNK-01..04, BR-RNK-01..03)

### 6.1 Cập nhật lượt tốt nhất sau khi nộp bài

```sql
-- Lượt mới tốt hơn khi: điểm cao hơn, hoặc bằng điểm mà thời gian ngắn hơn
UPDATE dbo.quiz_best_attempts WITH (UPDLOCK, SERIALIZABLE)
SET attempt_id = @attemptId, score = @score, duration_seconds = @dur, achieved_at = @now, updated_at = @now
WHERE user_id = @userId AND quiz_id = @quizId
  AND (@score > score OR (@score = score AND @dur < duration_seconds));

IF @@ROWCOUNT = 0
   AND NOT EXISTS (SELECT 1 FROM dbo.quiz_best_attempts WITH (UPDLOCK, SERIALIZABLE)
                   WHERE user_id = @userId AND quiz_id = @quizId)
BEGIN
    INSERT INTO dbo.quiz_best_attempts (user_id, quiz_id, course_id, attempt_id, score, duration_seconds, achieved_at)
    VALUES (@userId, @quizId, @courseId, @attemptId, @score, @dur, @now);
END;
```

### 6.2 Cập nhật tổng điểm xếp hạng của người học trong khóa

```sql
DECLARE @total DECIMAL(9,2), @totalDur INT, @cnt INT, @last DATETIME2(3);

SELECT @total = ISNULL(SUM(score), 0), @totalDur = ISNULL(SUM(duration_seconds), 0),
       @cnt = COUNT(*), @last = MAX(achieved_at)
FROM dbo.quiz_best_attempts
WHERE user_id = @userId AND course_id = @courseId;

UPDATE dbo.rankings WITH (UPDLOCK, SERIALIZABLE)
SET total_score = @total, total_duration_seconds = @totalDur, completed_quiz_count = @cnt,
    last_achieved_at = @last, updated_at = SYSUTCDATETIME()
WHERE user_id = @userId AND course_id = @courseId;

IF @@ROWCOUNT = 0
    INSERT INTO dbo.rankings (user_id, course_id, total_score, total_duration_seconds, completed_quiz_count, last_achieved_at)
    VALUES (@userId, @courseId, @total, @totalDur, @cnt, @last);
```

### 6.3 Bảng xếp hạng một khóa học (`GET /courses/{slug}/ranking`)

```sql
WITH eligible AS (
    SELECT  r.user_id, r.total_score, r.total_duration_seconds, r.completed_quiz_count, r.last_achieved_at,
            u.full_name, u.avatar_url, u.show_on_leaderboard
    FROM dbo.rankings r
    JOIN dbo.users u       ON u.id = r.user_id
    JOIN dbo.enrollments e ON e.user_id = r.user_id AND e.course_id = r.course_id
    WHERE r.course_id = @courseId
      AND r.total_score > 0
      AND e.status IN (N'IN_PROGRESS', N'COMPLETED')
      AND u.status = N'ACTIVE' AND u.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.user_roles ur
                      WHERE ur.user_id = u.id AND ur.role_id = 1)     -- 1 = ADMIN (BR-RNK-03)
),
ranked AS (
    SELECT *, RANK() OVER (ORDER BY total_score DESC,
                                    total_duration_seconds ASC,
                                    last_achieved_at ASC) AS rank_no
    FROM eligible
)
SELECT  rank_no,
        user_id,
        CASE WHEN show_on_leaderboard = 1 THEN full_name ELSE N'Học viên ẩn danh' END AS display_name,
        CASE WHEN show_on_leaderboard = 1 THEN avatar_url END AS avatar_url,
        total_score, total_duration_seconds, completed_quiz_count
FROM ranked
ORDER BY rank_no, user_id
OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;
```

- Ứng dụng rút gọn tên cho khách chưa đăng nhập (ví dụ "Nguyễn V. A.").
- Top 50 có thể cache ở Redis 60 giây. Xóa cache khi có lượt nộp làm thay đổi `rankings` của khóa.

### 6.4 Thứ hạng của tôi (`GET /courses/{slug}/ranking/me`)

```sql
-- Dùng lại CTE eligible, ranked ở §6.3
SELECT rank_no, total_score, total_duration_seconds,
       (SELECT COUNT(*) FROM eligible) AS total_ranked
FROM ranked
WHERE user_id = @userId;
```

### 6.5 Tính lại toàn bộ xếp hạng một khóa (FR-RNK-04, chạy nền)

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

-- Bước 1 (ứng dụng): chấm lại mọi quiz_attempt_answers của khóa theo đáp án hiện tại (giống §4.3 b, c)

-- Bước 2: dựng lại quiz_best_attempts
DELETE FROM dbo.quiz_best_attempts WHERE course_id = @courseId;

;WITH ranked AS (
    SELECT  a.id, a.user_id, a.quiz_id, a.score, a.duration_seconds, a.submitted_at,
            ROW_NUMBER() OVER (PARTITION BY a.user_id, a.quiz_id
                               ORDER BY a.score DESC, a.duration_seconds ASC, a.submitted_at ASC) AS rn
    FROM dbo.quiz_attempts a
    JOIN dbo.quizzes q ON q.id = a.quiz_id
    JOIN dbo.lessons l ON l.id = q.lesson_id
    WHERE l.course_id = @courseId
      AND a.status IN (N'SUBMITTED', N'EXPIRED')
      AND a.counts_for_ranking = 1
)
INSERT INTO dbo.quiz_best_attempts (user_id, quiz_id, course_id, attempt_id, score, duration_seconds, achieved_at)
SELECT user_id, quiz_id, @courseId, id, score, duration_seconds, submitted_at
FROM ranked WHERE rn = 1;

-- Bước 3: dựng lại rankings
DELETE FROM dbo.rankings WHERE course_id = @courseId;

INSERT INTO dbo.rankings (user_id, course_id, total_score, total_duration_seconds, completed_quiz_count, last_achieved_at)
SELECT user_id, @courseId, SUM(score), SUM(duration_seconds), COUNT(*), MAX(achieved_at)
FROM dbo.quiz_best_attempts
WHERE course_id = @courseId
GROUP BY user_id;

INSERT INTO dbo.audit_logs (actor_id, action_type, entity_type, entity_id)
VALUES (@adminId, N'RECALCULATE_RANKING', N'COURSE', @courseId);

COMMIT;
```

---

## 7. Sắp xếp lại thứ tự bài học (FR-ADM-16)

SQL Server **không** có `DEFERRABLE` constraint. Để không vi phạm `uq_lessons_course_order` khi hoán đổi thứ tự, cập nhật mọi bài trong **một câu lệnh** (SQL Server chỉ kiểm tra tính duy nhất ở cuối câu lệnh):

```sql
-- @orderJson = N'[{"id":11,"orderIndex":2},{"id":12,"orderIndex":1},{"id":13,"orderIndex":3}]'
UPDATE l
SET l.order_index = j.orderIndex, l.updated_at = SYSUTCDATETIME(), l.version = l.version + 1
FROM dbo.lessons l
JOIN OPENJSON(@orderJson) WITH (id BIGINT '$.id', orderIndex INT '$.orderIndex') j ON j.id = l.id
WHERE l.course_id = @courseId;
```

Lưu ý với JPA: Hibernate cập nhật từng dòng một nên có thể vi phạm UNIQUE giữa chừng. Dùng native query như trên, hoặc cập nhật 2 pha (đặt `order_index = order_index + 100000`, sau đó đặt giá trị mới).

Sắp xếp lại `course_categories.sort_order` thì không vướng vấn đề này vì cột không có ràng buộc UNIQUE.

---

## 8. Job định kỳ

| Job | Tần suất | Câu lệnh |
|-----|----------|----------|
| Hết hạn học: đóng khóa, xóa dữ liệu học tập (BR-LRN-10) | 5 phút | Xem §8.1 |
| Email nhắc hạn học (FR-LRN-13) | 15 phút | Xem §8.2 |
| Tự nộp lượt quiz quá hạn | 1 phút | Lấy `SELECT id FROM dbo.quiz_attempts WHERE status = N'IN_PROGRESS' AND expires_at < SYSUTCDATETIME()`, chấm như §4.3 nhưng đặt `status = N'EXPIRED'` |
| Dọn OTP / reset token / refresh token hết hạn | Hằng ngày | Xem bên dưới |
| Xóa tài khoản chưa xác thực quá 7 ngày (BR-AUTH-06) | Hằng ngày | Xem bên dưới |
| Xóa audit log quá 1 năm (nếu có chính sách) | Hằng tháng | `DELETE TOP (5000) FROM dbo.audit_logs WHERE created_at < DATEADD(YEAR, -1, SYSUTCDATETIME());` lặp tới khi hết |

```sql
-- Dọn token: xóa theo lô để tránh khóa bảng lâu và phình transaction log
DECLARE @cutoff DATETIME2(3) = DATEADD(DAY, -1, SYSUTCDATETIME());
WHILE 1 = 1
BEGIN
    DELETE TOP (5000) FROM dbo.otp_codes WHERE expires_at < @cutoff;
    IF @@ROWCOUNT = 0 BREAK;
END;
DELETE TOP (5000) FROM dbo.password_reset_tokens WHERE expires_at < @cutoff;
-- Cắt liên kết replaced_by trước khi xóa refresh token cũ
UPDATE dbo.refresh_tokens SET replaced_by_id = NULL
WHERE replaced_by_id IN (SELECT id FROM dbo.refresh_tokens WHERE expires_at < @cutoff);
DELETE TOP (5000) FROM dbo.refresh_tokens WHERE expires_at < @cutoff;

-- BR-AUTH-06: cascade xóa user_roles, otp_codes, các token
DELETE FROM dbo.users
WHERE status = N'PENDING_VERIFICATION'
  AND deleted_at IS NULL
  AND created_at < DATEADD(DAY, -7, SYSUTCDATETIME());
```

### 8.1 Hết hạn học (BR-LRN-10)

Lấy từng lô lượt ghi danh đã quá hạn (điều kiện viết bằng hằng số để dùng được `ix_enrollments_expiring`):

```sql
SELECT TOP (200) id
FROM dbo.enrollments
WHERE status IN (N'IN_PROGRESS', N'CANCELLED') AND expires_at <= SYSUTCDATETIME()
ORDER BY expires_at;
```

Xử lý **mỗi enrollment trong một transaction riêng** để lỗi ở một bản ghi không chặn cả lô:

```sql
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @userId BIGINT, @courseId BIGINT;

-- Khóa và kiểm tra lại: người học có thể vừa hoàn thành khóa ngay trước hạn (BR-LRN-12)
SELECT @userId = user_id, @courseId = course_id
FROM dbo.enrollments WITH (UPDLOCK, HOLDLOCK)
WHERE id = @enrollmentId
  AND status IN (N'IN_PROGRESS', N'CANCELLED')
  AND expires_at <= @now;

IF @userId IS NOT NULL
BEGIN
    -- 1. Xếp hạng. quiz_best_attempts phải xóa trước quiz_attempts vì đang tham chiếu attempt_id
    DELETE FROM dbo.quiz_best_attempts WHERE user_id = @userId AND course_id = @courseId;
    DELETE FROM dbo.rankings           WHERE user_id = @userId AND course_id = @courseId;

    -- 2. Lượt làm quiz, kể cả lượt đang làm dở (cascade quiz_attempt_answers → quiz_attempt_answer_options)
    DELETE FROM dbo.quiz_attempts WHERE enrollment_id = @enrollmentId;

    -- 3. Tiến độ từng bài
    DELETE FROM dbo.lesson_progress WHERE enrollment_id = @enrollmentId;

    -- 4. Đóng lượt ghi danh, giữ lại bản ghi để thống kê
    UPDATE dbo.enrollments
    SET status = N'EXPIRED', expired_at = @now,
        progress_percent = 0, completed_lesson_count = 0, last_lesson_id = NULL,
        updated_at = @now, version = version + 1
    WHERE id = @enrollmentId;

    -- 5. Cột tổng hợp
    UPDATE dbo.courses
    SET enrollment_count = (SELECT COUNT(*) FROM dbo.enrollments
                            WHERE course_id = @courseId AND status IN (N'IN_PROGRESS', N'COMPLETED'))
    WHERE id = @courseId;
END;

COMMIT;
```

Sau khi commit: xóa cache bảng xếp hạng của khóa (Redis). Job ghi log số lượt đã xử lý mỗi lần chạy.

### 8.2 Email nhắc hạn học (FR-LRN-13)

Chạy mốc 24 giờ trước, mốc 3 ngày sau, để lượt có thời hạn ngắn không nhận cả 2 email cùng lúc:

```sql
DECLARE @now DATETIME2(3) = SYSUTCDATETIME();

-- Mốc 24 giờ
SELECT id, user_id, course_id, expires_at
FROM dbo.enrollments
WHERE status IN (N'IN_PROGRESS', N'CANCELLED') AND expiry_reminder_stage < 2
  AND expires_at > @now AND expires_at <= DATEADD(HOUR, 24, @now);

-- Mốc 3 ngày
SELECT id, user_id, course_id, expires_at
FROM dbo.enrollments
WHERE status IN (N'IN_PROGRESS', N'CANCELLED') AND expiry_reminder_stage = 0
  AND expires_at > DATEADD(HOUR, 24, @now) AND expires_at <= DATEADD(DAY, 3, @now);
```

Ứng dụng bỏ qua lượt `CANCELLED` (truy vấn vẫn giữ `CANCELLED` trong điều kiện để khớp filtered index). Sau khi đưa email vào hàng đợi, đánh dấu đã gửi một cách idempotent:

```sql
UPDATE dbo.enrollments SET expiry_reminder_stage = @stage   -- 1 = mốc 3 ngày, 2 = mốc 24 giờ
WHERE id = @enrollmentId AND expiry_reminder_stage < @stage;
```

---

## 9. Dashboard quản trị (FR-ADM-21)

```sql
DECLARE @now DATETIME2(3) = SYSUTCDATETIME();

SELECT
    (SELECT COUNT(*) FROM dbo.users WHERE deleted_at IS NULL AND status <> N'PENDING_VERIFICATION')        AS total_users,
    (SELECT COUNT(*) FROM dbo.users WHERE deleted_at IS NULL AND created_at >= DATEADD(DAY, -7, @now))     AS new_users_7d,
    (SELECT COUNT(*) FROM dbo.courses WHERE publish_status = N'PUBLISHED')                                AS published_courses,
    (SELECT COUNT(*) FROM dbo.enrollments WHERE status <> N'CANCELLED')                                   AS total_enrollments,
    (SELECT COUNT(*) FROM dbo.enrollments WHERE status = N'COMPLETED')                                    AS completed_enrollments,
    (SELECT COUNT(*) FROM dbo.enrollments WHERE status = N'EXPIRED' AND expired_at >= DATEADD(DAY, -30, @now)) AS expired_enrollments_30d;

-- Lượt ghi danh theo ngày (giờ Việt Nam), 30 ngày gần nhất
SELECT CAST(DATEADD(HOUR, 7, enrolled_at) AS DATE) AS day_vn, COUNT(*) AS enrollments
FROM dbo.enrollments
WHERE enrolled_at >= DATEADD(DAY, -30, @now)
GROUP BY CAST(DATEADD(HOUR, 7, enrolled_at) AS DATE)
ORDER BY day_vn;

-- Top 5 khóa học nhiều học viên
SELECT TOP (5) id, title, enrollment_count
FROM dbo.courses
WHERE publish_status = N'PUBLISHED'
ORDER BY enrollment_count DESC;
```
