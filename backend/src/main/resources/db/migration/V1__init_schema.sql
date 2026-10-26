-- Sinh từ docs/design-db/04-script-tao-csdl.md. Sửa tài liệu thiết kế trước, rồi tạo migration mới (không sửa file đã chạy).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* =====================================================================
   1. NGƯỜI DÙNG & XÁC THỰC
   ===================================================================== */

CREATE TABLE dbo.roles (
    id          SMALLINT       IDENTITY(1,1) NOT NULL,
    code        NVARCHAR(30)   NOT NULL,
    name        NVARCHAR(100)  NOT NULL,
    created_at  DATETIME2(3)   NOT NULL CONSTRAINT df_roles_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_roles PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_roles_code UNIQUE (code)
);
GO

CREATE TABLE dbo.users (
    id                   BIGINT         IDENTITY(1,1) NOT NULL,
    email                NVARCHAR(255)  NOT NULL,
    password_hash        NVARCHAR(100)  NOT NULL,
    full_name            NVARCHAR(100)  NOT NULL,
    birth_year           SMALLINT       NULL,
    hometown             NVARCHAR(255)  NULL,
    workplace            NVARCHAR(255)  NULL,
    phone                NVARCHAR(20)   NULL,
    avatar_url           NVARCHAR(500)  NULL,
    status               NVARCHAR(30)   NOT NULL CONSTRAINT df_users_status DEFAULT N'PENDING_VERIFICATION',
    lock_reason          NVARCHAR(500)  NULL,
    email_verified_at    DATETIME2(3)   NULL,
    failed_login_count   SMALLINT       NOT NULL CONSTRAINT df_users_failed_login_count DEFAULT 0,
    locked_until         DATETIME2(3)   NULL,
    last_login_at        DATETIME2(3)   NULL,
    show_on_leaderboard  BIT            NOT NULL CONSTRAINT df_users_show_on_leaderboard DEFAULT 1,
    privacy_consent_at   DATETIME2(3)   NULL,
    version              INT            NOT NULL CONSTRAINT df_users_version DEFAULT 0,
    created_at           DATETIME2(3)   NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(3)   NOT NULL CONSTRAINT df_users_updated_at DEFAULT SYSUTCDATETIME(),
    deleted_at           DATETIME2(3)   NULL,
    CONSTRAINT pk_users PRIMARY KEY CLUSTERED (id),
    CONSTRAINT ck_users_status CHECK (status IN (N'PENDING_VERIFICATION', N'ACTIVE', N'LOCKED')),
    CONSTRAINT ck_users_birth_year CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND YEAR(SYSUTCDATETIME())),
    CONSTRAINT ck_users_failed_login_count CHECK (failed_login_count >= 0)
);
GO
-- Email duy nhất trong số tài khoản chưa xóa (cho phép đăng ký lại email của tài khoản đã xóa mềm)
CREATE UNIQUE NONCLUSTERED INDEX ux_users_email ON dbo.users (email) WHERE deleted_at IS NULL;
CREATE NONCLUSTERED INDEX ix_users_status_created_at ON dbo.users (status, created_at) WHERE deleted_at IS NULL;
GO

CREATE TABLE dbo.user_roles (
    user_id      BIGINT        NOT NULL,
    role_id      SMALLINT      NOT NULL,
    assigned_at  DATETIME2(3)  NOT NULL CONSTRAINT df_user_roles_assigned_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_user_roles PRIMARY KEY CLUSTERED (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES dbo.roles (id)
);
GO
CREATE NONCLUSTERED INDEX ix_user_roles_role ON dbo.user_roles (role_id);
GO

CREATE TABLE dbo.otp_codes (
    id               BIGINT         IDENTITY(1,1) NOT NULL,
    user_id          BIGINT         NOT NULL,
    purpose          NVARCHAR(30)   NOT NULL,
    code_hash        NVARCHAR(100)  NOT NULL,
    expires_at       DATETIME2(3)   NOT NULL,
    failed_attempts  TINYINT        NOT NULL CONSTRAINT df_otp_codes_failed_attempts DEFAULT 0,
    consumed_at      DATETIME2(3)   NULL,
    invalidated_at   DATETIME2(3)   NULL,
    request_ip       NVARCHAR(45)   NULL,
    created_at       DATETIME2(3)   NOT NULL CONSTRAINT df_otp_codes_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_otp_codes PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_otp_codes_user FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE,
    CONSTRAINT ck_otp_codes_purpose CHECK (purpose IN (N'REGISTER', N'RESET_PASSWORD')),
    CONSTRAINT ck_otp_codes_failed_attempts CHECK (failed_attempts BETWEEN 0 AND 5)
);
GO
CREATE NONCLUSTERED INDEX ix_otp_codes_user_purpose ON dbo.otp_codes (user_id, purpose, created_at DESC);
CREATE NONCLUSTERED INDEX ix_otp_codes_expires_at ON dbo.otp_codes (expires_at);
GO

CREATE TABLE dbo.password_reset_tokens (
    id          BIGINT         IDENTITY(1,1) NOT NULL,
    user_id     BIGINT         NOT NULL,
    token_hash  NVARCHAR(100)  NOT NULL,
    source      NVARCHAR(20)   NOT NULL CONSTRAINT df_password_reset_tokens_source DEFAULT N'SELF',
    expires_at  DATETIME2(3)   NOT NULL,
    used_at     DATETIME2(3)   NULL,
    created_at  DATETIME2(3)   NOT NULL CONSTRAINT df_password_reset_tokens_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE,
    CONSTRAINT uq_password_reset_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_password_reset_tokens_source CHECK (source IN (N'SELF', N'ADMIN'))
);
GO
CREATE NONCLUSTERED INDEX ix_password_reset_tokens_user ON dbo.password_reset_tokens (user_id);
CREATE NONCLUSTERED INDEX ix_password_reset_tokens_expires_at ON dbo.password_reset_tokens (expires_at);
GO

CREATE TABLE dbo.refresh_tokens (
    id              BIGINT         IDENTITY(1,1) NOT NULL,
    user_id         BIGINT         NOT NULL,
    token_hash      NVARCHAR(100)  NOT NULL,
    remember_me     BIT            NOT NULL CONSTRAINT df_refresh_tokens_remember_me DEFAULT 0,
    expires_at      DATETIME2(3)   NOT NULL,
    revoked_at      DATETIME2(3)   NULL,
    revoked_reason  NVARCHAR(30)   NULL,
    replaced_by_id  BIGINT         NULL,
    user_agent      NVARCHAR(500)  NULL,
    ip_address      NVARCHAR(45)   NULL,
    created_at      DATETIME2(3)   NOT NULL CONSTRAINT df_refresh_tokens_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_refresh_tokens PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by_id) REFERENCES dbo.refresh_tokens (id),
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_refresh_tokens_revoked_reason CHECK (revoked_reason IS NULL OR revoked_reason IN
        (N'ROTATED', N'LOGOUT', N'LOGOUT_ALL', N'PASSWORD_CHANGED', N'REUSE_DETECTED', N'ACCOUNT_LOCKED'))
);
GO
CREATE NONCLUSTERED INDEX ix_refresh_tokens_user_active ON dbo.refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE NONCLUSTERED INDEX ix_refresh_tokens_expires_at ON dbo.refresh_tokens (expires_at);
CREATE NONCLUSTERED INDEX ix_refresh_tokens_replaced_by ON dbo.refresh_tokens (replaced_by_id) WHERE replaced_by_id IS NOT NULL;
GO

/* =====================================================================
   2. DANH MỤC & NỘI DUNG
   ===================================================================== */

CREATE TABLE dbo.uploaded_files (
    id             BIGINT         IDENTITY(1,1) NOT NULL,
    storage_key    NVARCHAR(500)  NOT NULL,
    public_url     NVARCHAR(500)  NOT NULL,
    original_name  NVARCHAR(255)  NOT NULL,
    content_type   NVARCHAR(100)  NOT NULL,
    size_bytes     BIGINT         NOT NULL,
    purpose        NVARCHAR(30)   NOT NULL,
    uploaded_by    BIGINT         NOT NULL,
    created_at     DATETIME2(3)   NOT NULL CONSTRAINT df_uploaded_files_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_uploaded_files PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_uploaded_files_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES dbo.users (id),
    CONSTRAINT uq_uploaded_files_storage_key UNIQUE (storage_key),
    CONSTRAINT ck_uploaded_files_size CHECK (size_bytes > 0),
    CONSTRAINT ck_uploaded_files_purpose CHECK (purpose IN
        (N'AVATAR', N'COURSE_THUMBNAIL', N'LESSON_CONTENT', N'LESSON_ATTACHMENT', N'CATEGORY_ICON', N'ORGANIZATION_LOGO', N'QUESTION_IMAGE'))
);
GO
CREATE NONCLUSTERED INDEX ix_uploaded_files_uploaded_by ON dbo.uploaded_files (uploaded_by);
GO

CREATE TABLE dbo.organizations (
    id             BIGINT         IDENTITY(1,1) NOT NULL,
    name           NVARCHAR(200)  NOT NULL,
    slug           NVARCHAR(220)  NOT NULL,
    logo_url       NVARCHAR(500)  NULL,
    website        NVARCHAR(500)  NULL,
    contact_email  NVARCHAR(255)  NULL,
    description    NVARCHAR(MAX)  NULL,
    is_active      BIT            NOT NULL CONSTRAINT df_organizations_is_active DEFAULT 1,
    version        INT            NOT NULL CONSTRAINT df_organizations_version DEFAULT 0,
    created_at     DATETIME2(3)   NOT NULL CONSTRAINT df_organizations_created_at DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3)   NOT NULL CONSTRAINT df_organizations_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_organizations PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_organizations_name UNIQUE (name),
    CONSTRAINT uq_organizations_slug UNIQUE (slug)
);
GO

/* Loại khóa học 2 cấp.
   Ràng buộc "tối đa 2 cấp" (BR-ADM-02) được khai báo bằng:
   - depth: 1 = cấp 1, 2 = cấp 2
   - parent_depth: luôn = 1 khi có cha
   - FK tổ hợp (parent_id, parent_depth) -> (id, depth): bản ghi cha bắt buộc là cấp 1 */
CREATE TABLE dbo.course_categories (
    id            BIGINT          IDENTITY(1,1) NOT NULL,
    parent_id     BIGINT          NULL,
    depth         TINYINT         NOT NULL,
    parent_depth  TINYINT         NULL,
    name          NVARCHAR(150)   NOT NULL,
    slug          NVARCHAR(170)   NOT NULL,
    description   NVARCHAR(1000)  NULL,
    icon_url      NVARCHAR(500)   NULL,
    sort_order    INT             NOT NULL CONSTRAINT df_course_categories_sort_order DEFAULT 0,
    is_active     BIT             NOT NULL CONSTRAINT df_course_categories_is_active DEFAULT 1,
    version       INT             NOT NULL CONSTRAINT df_course_categories_version DEFAULT 0,
    created_at    DATETIME2(3)    NOT NULL CONSTRAINT df_course_categories_created_at DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2(3)    NOT NULL CONSTRAINT df_course_categories_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_course_categories PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_course_categories_id_depth UNIQUE (id, depth),
    CONSTRAINT uq_course_categories_slug UNIQUE (slug),
    CONSTRAINT uq_course_categories_parent_name UNIQUE (parent_id, name),
    CONSTRAINT fk_course_categories_parent FOREIGN KEY (parent_id, parent_depth)
        REFERENCES dbo.course_categories (id, depth),
    CONSTRAINT ck_course_categories_depth CHECK (
           (parent_id IS NULL     AND parent_depth IS NULL AND depth = 1)
        OR (parent_id IS NOT NULL AND parent_depth = 1     AND depth = 2))
);
GO
CREATE NONCLUSTERED INDEX ix_course_categories_parent ON dbo.course_categories (parent_id, sort_order);
GO

CREATE TABLE dbo.courses (
    id                      BIGINT          IDENTITY(1,1) NOT NULL,
    category_id             BIGINT          NOT NULL,
    category_depth          TINYINT         NOT NULL CONSTRAINT df_courses_category_depth DEFAULT 2,
    organization_id         BIGINT          NOT NULL,
    title                   NVARCHAR(200)   NOT NULL,
    slug                    NVARCHAR(220)   NOT NULL,
    short_description       NVARCHAR(300)   NOT NULL,
    description             NVARCHAR(MAX)   NOT NULL,
    outcomes                NVARCHAR(MAX)   NULL,
    target_audience         NVARCHAR(MAX)   NULL,
    prerequisites           NVARCHAR(MAX)   NULL,
    thumbnail_url           NVARCHAR(500)   NULL,
    course_level            NVARCHAR(20)    NOT NULL,
    publish_status          NVARCHAR(20)    NOT NULL CONSTRAINT df_courses_publish_status DEFAULT N'DRAFT',
    start_date              DATETIME2(3)    NULL,
    end_date                DATETIME2(3)    NULL,
    learning_duration_days  INT             NOT NULL CONSTRAINT df_courses_learning_duration_days DEFAULT 21,
    estimated_minutes       INT             NULL,
    is_featured             BIT             NOT NULL CONSTRAINT df_courses_is_featured DEFAULT 0,
    certificate_criteria    NVARCHAR(MAX)   NULL,
    search_text             NVARCHAR(1000)  NOT NULL CONSTRAINT df_courses_search_text DEFAULT N'',
    published_lesson_count  INT             NOT NULL CONSTRAINT df_courses_published_lesson_count DEFAULT 0,
    enrollment_count        INT             NOT NULL CONSTRAINT df_courses_enrollment_count DEFAULT 0,
    rating_avg              DECIMAL(3,2)    NOT NULL CONSTRAINT df_courses_rating_avg DEFAULT 0,
    rating_count            INT             NOT NULL CONSTRAINT df_courses_rating_count DEFAULT 0,
    published_at            DATETIME2(3)    NULL,
    created_by              BIGINT          NOT NULL,
    updated_by              BIGINT          NULL,
    version                 INT             NOT NULL CONSTRAINT df_courses_version DEFAULT 0,
    created_at              DATETIME2(3)    NOT NULL CONSTRAINT df_courses_created_at DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2(3)    NOT NULL CONSTRAINT df_courses_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_courses PRIMARY KEY CLUSTERED (id),
    CONSTRAINT uq_courses_slug UNIQUE (slug),
    -- BR-ADM-03: khóa học chỉ gắn vào loại cấp 2
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id, category_depth)
        REFERENCES dbo.course_categories (id, depth),
    CONSTRAINT fk_courses_organization FOREIGN KEY (organization_id) REFERENCES dbo.organizations (id),
    CONSTRAINT fk_courses_created_by FOREIGN KEY (created_by) REFERENCES dbo.users (id),
    CONSTRAINT fk_courses_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.users (id),
    CONSTRAINT ck_courses_category_depth CHECK (category_depth = 2),
    CONSTRAINT ck_courses_course_level CHECK (course_level IN (N'BASIC', N'INTERMEDIATE', N'ADVANCED')),
    CONSTRAINT ck_courses_publish_status CHECK (publish_status IN (N'DRAFT', N'PUBLISHED', N'ARCHIVED')),
    CONSTRAINT ck_courses_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date),
    -- BR-LRN-09: thời hạn học của mỗi lượt ghi danh, mặc định 21 ngày (3 tuần)
    CONSTRAINT ck_courses_learning_duration_days CHECK (learning_duration_days BETWEEN 1 AND 365),
    CONSTRAINT ck_courses_estimated_minutes CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
    CONSTRAINT ck_courses_counters CHECK (published_lesson_count >= 0 AND enrollment_count >= 0 AND rating_count >= 0),
    CONSTRAINT ck_courses_rating_avg CHECK (rating_avg BETWEEN 0 AND 5),
    CONSTRAINT ck_courses_certificate_criteria CHECK (certificate_criteria IS NULL OR ISJSON(certificate_criteria) = 1),
    CONSTRAINT ck_courses_published_at CHECK (publish_status = N'DRAFT' OR published_at IS NOT NULL)
);
GO
CREATE NONCLUSTERED INDEX ix_courses_status_category ON dbo.courses (publish_status, category_id)
    INCLUDE (course_level, organization_id, start_date, end_date, published_at, enrollment_count, rating_avg);
CREATE NONCLUSTERED INDEX ix_courses_status_organization ON dbo.courses (publish_status, organization_id)
    INCLUDE (course_level, category_id, start_date, end_date);
CREATE NONCLUSTERED INDEX ix_courses_status_published_at ON dbo.courses (publish_status, published_at DESC);
CREATE NONCLUSTERED INDEX ix_courses_status_popular ON dbo.courses (publish_status, enrollment_count DESC);
CREATE NONCLUSTERED INDEX ix_courses_featured ON dbo.courses (publish_status, published_at DESC) WHERE is_featured = 1;
CREATE NONCLUSTERED INDEX ix_courses_category ON dbo.courses (category_id);
CREATE NONCLUSTERED INDEX ix_courses_organization ON dbo.courses (organization_id);
GO

CREATE TABLE dbo.lessons (
    id                 BIGINT         IDENTITY(1,1) NOT NULL,
    course_id          BIGINT         NOT NULL,
    title              NVARCHAR(200)  NOT NULL,
    order_index        INT            NOT NULL,
    content            NVARCHAR(MAX)  NULL,
    video_url          NVARCHAR(500)  NULL,
    assignment         NVARCHAR(MAX)  NULL,
    estimated_minutes  INT            NULL,
    is_published       BIT            NOT NULL CONSTRAINT df_lessons_is_published DEFAULT 0,
    version            INT            NOT NULL CONSTRAINT df_lessons_version DEFAULT 0,
    created_at         DATETIME2(3)   NOT NULL CONSTRAINT df_lessons_created_at DEFAULT SYSUTCDATETIME(),
    updated_at         DATETIME2(3)   NOT NULL CONSTRAINT df_lessons_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_lessons PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES dbo.courses (id) ON DELETE CASCADE,
    CONSTRAINT uq_lessons_course_order UNIQUE (course_id, order_index),
    CONSTRAINT ck_lessons_order_index CHECK (order_index >= 1),
    CONSTRAINT ck_lessons_estimated_minutes CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0)
);
GO

CREATE TABLE dbo.lesson_attachments (
    id            BIGINT         IDENTITY(1,1) NOT NULL,
    lesson_id     BIGINT         NOT NULL,
    file_id       BIGINT         NOT NULL,
    display_name  NVARCHAR(255)  NOT NULL,
    order_index   INT            NOT NULL CONSTRAINT df_lesson_attachments_order_index DEFAULT 0,
    created_at    DATETIME2(3)   NOT NULL CONSTRAINT df_lesson_attachments_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_lesson_attachments PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_lesson_attachments_lesson FOREIGN KEY (lesson_id) REFERENCES dbo.lessons (id) ON DELETE CASCADE,
    CONSTRAINT fk_lesson_attachments_file FOREIGN KEY (file_id) REFERENCES dbo.uploaded_files (id),
    CONSTRAINT uq_lesson_attachments_lesson_file UNIQUE (lesson_id, file_id)
);
GO
CREATE NONCLUSTERED INDEX ix_lesson_attachments_file ON dbo.lesson_attachments (file_id);
GO

CREATE TABLE dbo.quizzes (
    id                         BIGINT         IDENTITY(1,1) NOT NULL,
    lesson_id                  BIGINT         NOT NULL,
    title                      NVARCHAR(200)  NOT NULL,
    pass_score_percent         TINYINT        NOT NULL CONSTRAINT df_quizzes_pass_score_percent DEFAULT 70,
    time_limit_seconds         INT            NULL,
    max_attempts               INT            NULL,
    retry_cooldown_seconds     INT            NOT NULL CONSTRAINT df_quizzes_retry_cooldown_seconds DEFAULT 0,
    shuffle_questions          BIT            NOT NULL CONSTRAINT df_quizzes_shuffle_questions DEFAULT 0,
    shuffle_options            BIT            NOT NULL CONSTRAINT df_quizzes_shuffle_options DEFAULT 0,
    show_answers_after_submit  BIT            NOT NULL CONSTRAINT df_quizzes_show_answers_after_submit DEFAULT 1,
    version                    INT            NOT NULL CONSTRAINT df_quizzes_version DEFAULT 0,
    created_at                 DATETIME2(3)   NOT NULL CONSTRAINT df_quizzes_created_at DEFAULT SYSUTCDATETIME(),
    updated_at                 DATETIME2(3)   NOT NULL CONSTRAINT df_quizzes_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_quizzes PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_quizzes_lesson FOREIGN KEY (lesson_id) REFERENCES dbo.lessons (id) ON DELETE CASCADE,
    CONSTRAINT uq_quizzes_lesson UNIQUE (lesson_id),
    CONSTRAINT ck_quizzes_pass_score_percent CHECK (pass_score_percent BETWEEN 0 AND 100),
    CONSTRAINT ck_quizzes_time_limit CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
    CONSTRAINT ck_quizzes_max_attempts CHECK (max_attempts IS NULL OR max_attempts > 0),
    CONSTRAINT ck_quizzes_retry_cooldown CHECK (retry_cooldown_seconds >= 0)
);
GO

CREATE TABLE dbo.questions (
    id             BIGINT         IDENTITY(1,1) NOT NULL,
    quiz_id        BIGINT         NOT NULL,
    content        NVARCHAR(MAX)  NOT NULL,
    question_type  NVARCHAR(20)   NOT NULL,
    points         DECIMAL(5,2)   NOT NULL CONSTRAINT df_questions_points DEFAULT 1,
    explanation    NVARCHAR(MAX)  NULL,
    order_index    INT            NOT NULL CONSTRAINT df_questions_order_index DEFAULT 0,
    is_active      BIT            NOT NULL CONSTRAINT df_questions_is_active DEFAULT 1,
    version        INT            NOT NULL CONSTRAINT df_questions_version DEFAULT 0,
    created_at     DATETIME2(3)   NOT NULL CONSTRAINT df_questions_created_at DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3)   NOT NULL CONSTRAINT df_questions_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_questions PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES dbo.quizzes (id) ON DELETE CASCADE,
    CONSTRAINT ck_questions_type CHECK (question_type IN (N'SINGLE_CHOICE', N'MULTIPLE_CHOICE', N'TRUE_FALSE')),
    CONSTRAINT ck_questions_points CHECK (points > 0)
);
GO
CREATE NONCLUSTERED INDEX ix_questions_quiz ON dbo.questions (quiz_id, is_active, order_index);
GO

CREATE TABLE dbo.question_options (
    id           BIGINT          IDENTITY(1,1) NOT NULL,
    question_id  BIGINT          NOT NULL,
    content      NVARCHAR(1000)  NOT NULL,
    is_correct   BIT             NOT NULL CONSTRAINT df_question_options_is_correct DEFAULT 0,
    order_index  INT             NOT NULL CONSTRAINT df_question_options_order_index DEFAULT 0,
    is_active    BIT             NOT NULL CONSTRAINT df_question_options_is_active DEFAULT 1,
    created_at   DATETIME2(3)    NOT NULL CONSTRAINT df_question_options_created_at DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2(3)    NOT NULL CONSTRAINT df_question_options_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_question_options PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES dbo.questions (id) ON DELETE CASCADE
);
GO
CREATE NONCLUSTERED INDEX ix_question_options_question ON dbo.question_options (question_id, is_active, order_index)
    INCLUDE (is_correct);
GO

/* =====================================================================
   3. HỌC TẬP
   ===================================================================== */

CREATE TABLE dbo.enrollments (
    id                      BIGINT         IDENTITY(1,1) NOT NULL,
    user_id                 BIGINT         NOT NULL,
    course_id               BIGINT         NOT NULL,
    status                  NVARCHAR(20)   NOT NULL CONSTRAINT df_enrollments_status DEFAULT N'IN_PROGRESS',
    progress_percent        TINYINT        NOT NULL CONSTRAINT df_enrollments_progress_percent DEFAULT 0,
    completed_lesson_count  INT            NOT NULL CONSTRAINT df_enrollments_completed_lesson_count DEFAULT 0,
    last_lesson_id          BIGINT         NULL,
    enrolled_at             DATETIME2(3)   NOT NULL CONSTRAINT df_enrollments_enrolled_at DEFAULT SYSUTCDATETIME(),
    completed_at            DATETIME2(3)   NULL,
    cancelled_at            DATETIME2(3)   NULL,
    round_no                INT            NOT NULL CONSTRAINT df_enrollments_round_no DEFAULT 1,
    learning_started_at     DATETIME2(3)   NOT NULL CONSTRAINT df_enrollments_learning_started_at DEFAULT SYSUTCDATETIME(),
    expires_at              DATETIME2(3)   NOT NULL,
    expired_at              DATETIME2(3)   NULL,
    expiry_reminder_stage   TINYINT        NOT NULL CONSTRAINT df_enrollments_expiry_reminder_stage DEFAULT 0,
    version                 INT            NOT NULL CONSTRAINT df_enrollments_version DEFAULT 0,
    updated_at              DATETIME2(3)   NOT NULL CONSTRAINT df_enrollments_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_enrollments PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES dbo.courses (id),
    CONSTRAINT fk_enrollments_last_lesson FOREIGN KEY (last_lesson_id) REFERENCES dbo.lessons (id),
    CONSTRAINT uq_enrollments_user_course UNIQUE (user_id, course_id),
    CONSTRAINT ck_enrollments_status CHECK (status IN (N'IN_PROGRESS', N'COMPLETED', N'CANCELLED', N'EXPIRED')),
    CONSTRAINT ck_enrollments_progress CHECK (progress_percent BETWEEN 0 AND 100 AND completed_lesson_count >= 0),
    CONSTRAINT ck_enrollments_completed_at CHECK (status <> N'COMPLETED' OR completed_at IS NOT NULL),
    CONSTRAINT ck_enrollments_cancelled_at CHECK (status <> N'CANCELLED' OR cancelled_at IS NOT NULL),
    -- BR-LRN-09..11: thời hạn học
    CONSTRAINT ck_enrollments_round_no CHECK (round_no >= 1),
    CONSTRAINT ck_enrollments_expires_at CHECK (expires_at > learning_started_at),
    CONSTRAINT ck_enrollments_expired_at CHECK (status <> N'EXPIRED' OR expired_at IS NOT NULL),
    CONSTRAINT ck_enrollments_expiry_reminder_stage CHECK (expiry_reminder_stage BETWEEN 0 AND 2)
);
GO
CREATE NONCLUSTERED INDEX ix_enrollments_user_status ON dbo.enrollments (user_id, status) INCLUDE (course_id, progress_percent, last_lesson_id);
CREATE NONCLUSTERED INDEX ix_enrollments_course_status ON dbo.enrollments (course_id, status) INCLUDE (user_id, progress_percent, enrolled_at);
CREATE NONCLUSTERED INDEX ix_enrollments_last_lesson ON dbo.enrollments (last_lesson_id) WHERE last_lesson_id IS NOT NULL;
CREATE NONCLUSTERED INDEX ix_enrollments_enrolled_at ON dbo.enrollments (enrolled_at);
-- Job hết hạn học và job nhắc hạn (BR-LRN-10, FR-LRN-13)
CREATE NONCLUSTERED INDEX ix_enrollments_expiring ON dbo.enrollments (expires_at) INCLUDE (user_id, course_id, expiry_reminder_stage)
    WHERE status IN (N'IN_PROGRESS', N'CANCELLED');
GO

CREATE TABLE dbo.lesson_progress (
    id                 BIGINT        IDENTITY(1,1) NOT NULL,
    enrollment_id      BIGINT        NOT NULL,
    lesson_id          BIGINT        NOT NULL,
    status             NVARCHAR(20)  NOT NULL CONSTRAINT df_lesson_progress_status DEFAULT N'IN_PROGRESS',
    completion_method  NVARCHAR(20)  NULL,
    started_at         DATETIME2(3)  NOT NULL CONSTRAINT df_lesson_progress_started_at DEFAULT SYSUTCDATETIME(),
    completed_at       DATETIME2(3)  NULL,
    CONSTRAINT pk_lesson_progress PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_lesson_progress_enrollment FOREIGN KEY (enrollment_id) REFERENCES dbo.enrollments (id) ON DELETE CASCADE,
    CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id) REFERENCES dbo.lessons (id),
    CONSTRAINT uq_lesson_progress_enrollment_lesson UNIQUE (enrollment_id, lesson_id),
    CONSTRAINT ck_lesson_progress_status CHECK (status IN (N'IN_PROGRESS', N'COMPLETED')),
    CONSTRAINT ck_lesson_progress_completion CHECK (
           (status = N'IN_PROGRESS' AND completed_at IS NULL AND completion_method IS NULL)
        OR (status = N'COMPLETED'   AND completed_at IS NOT NULL AND completion_method IN (N'QUIZ_PASSED', N'MANUAL')))
);
GO
CREATE NONCLUSTERED INDEX ix_lesson_progress_lesson ON dbo.lesson_progress (lesson_id, status);
GO

CREATE TABLE dbo.quiz_attempts (
    id                  BIGINT         IDENTITY(1,1) NOT NULL,
    quiz_id             BIGINT         NOT NULL,
    user_id             BIGINT         NOT NULL,
    enrollment_id       BIGINT         NOT NULL,
    attempt_no          INT            NOT NULL,
    status              NVARCHAR(20)   NOT NULL CONSTRAINT df_quiz_attempts_status DEFAULT N'IN_PROGRESS',
    question_order      NVARCHAR(MAX)  NULL,
    started_at          DATETIME2(3)   NOT NULL CONSTRAINT df_quiz_attempts_started_at DEFAULT SYSUTCDATETIME(),
    expires_at          DATETIME2(3)   NULL,
    submitted_at        DATETIME2(3)   NULL,
    duration_seconds    INT            NULL,
    score               DECIMAL(7,2)   NULL,
    max_score           DECIMAL(7,2)   NULL,
    score_percent       DECIMAL(5,2)   NULL,
    passed              BIT            NULL,
    counts_for_ranking  BIT            NULL,
    CONSTRAINT pk_quiz_attempts PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_quiz_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES dbo.quizzes (id),
    CONSTRAINT fk_quiz_attempts_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT fk_quiz_attempts_enrollment FOREIGN KEY (enrollment_id) REFERENCES dbo.enrollments (id),
    CONSTRAINT uq_quiz_attempts_user_quiz_no UNIQUE (user_id, quiz_id, attempt_no),
    CONSTRAINT ck_quiz_attempts_status CHECK (status IN (N'IN_PROGRESS', N'SUBMITTED', N'EXPIRED')),
    CONSTRAINT ck_quiz_attempts_attempt_no CHECK (attempt_no >= 1),
    CONSTRAINT ck_quiz_attempts_question_order CHECK (question_order IS NULL OR ISJSON(question_order) = 1),
    CONSTRAINT ck_quiz_attempts_result CHECK (
           (status = N'IN_PROGRESS' AND submitted_at IS NULL)
        OR (status IN (N'SUBMITTED', N'EXPIRED')
            AND submitted_at IS NOT NULL AND duration_seconds >= 0
            AND score IS NOT NULL AND max_score IS NOT NULL AND score_percent IS NOT NULL
            AND passed IS NOT NULL AND counts_for_ranking IS NOT NULL
            AND score >= 0 AND score <= max_score))
);
GO
-- Mỗi người chỉ có 1 lượt đang làm cho mỗi quiz (FR-LRN-04)
CREATE UNIQUE NONCLUSTERED INDEX ux_quiz_attempts_in_progress ON dbo.quiz_attempts (user_id, quiz_id) WHERE status = N'IN_PROGRESS';
CREATE NONCLUSTERED INDEX ix_quiz_attempts_user_quiz_submitted ON dbo.quiz_attempts (user_id, quiz_id, submitted_at DESC)
    INCLUDE (status, score, duration_seconds, passed);
CREATE NONCLUSTERED INDEX ix_quiz_attempts_quiz_submitted ON dbo.quiz_attempts (quiz_id, submitted_at) INCLUDE (user_id, score, duration_seconds, counts_for_ranking);
CREATE NONCLUSTERED INDEX ix_quiz_attempts_enrollment ON dbo.quiz_attempts (enrollment_id);
CREATE NONCLUSTERED INDEX ix_quiz_attempts_expiring ON dbo.quiz_attempts (expires_at) WHERE status = N'IN_PROGRESS';
GO

CREATE TABLE dbo.quiz_attempt_answers (
    id              BIGINT        IDENTITY(1,1) NOT NULL,
    attempt_id      BIGINT        NOT NULL,
    question_id     BIGINT        NOT NULL,
    is_correct      BIT           NULL,
    points_awarded  DECIMAL(5,2)  NULL,
    answered_at     DATETIME2(3)  NOT NULL CONSTRAINT df_quiz_attempt_answers_answered_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_quiz_attempt_answers PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_quiz_attempt_answers_attempt FOREIGN KEY (attempt_id) REFERENCES dbo.quiz_attempts (id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempt_answers_question FOREIGN KEY (question_id) REFERENCES dbo.questions (id),
    CONSTRAINT uq_quiz_attempt_answers_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT ck_quiz_attempt_answers_points CHECK (points_awarded IS NULL OR points_awarded >= 0)
);
GO
CREATE NONCLUSTERED INDEX ix_quiz_attempt_answers_question ON dbo.quiz_attempt_answers (question_id);
GO

CREATE TABLE dbo.quiz_attempt_answer_options (
    answer_id  BIGINT  NOT NULL,
    option_id  BIGINT  NOT NULL,
    CONSTRAINT pk_quiz_attempt_answer_options PRIMARY KEY CLUSTERED (answer_id, option_id),
    CONSTRAINT fk_quiz_attempt_answer_options_answer FOREIGN KEY (answer_id) REFERENCES dbo.quiz_attempt_answers (id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempt_answer_options_option FOREIGN KEY (option_id) REFERENCES dbo.question_options (id)
);
GO
CREATE NONCLUSTERED INDEX ix_quiz_attempt_answer_options_option ON dbo.quiz_attempt_answer_options (option_id);
GO

/* =====================================================================
   4. XẾP HẠNG
   ===================================================================== */

CREATE TABLE dbo.quiz_best_attempts (
    user_id           BIGINT        NOT NULL,
    quiz_id           BIGINT        NOT NULL,
    course_id         BIGINT        NOT NULL,
    attempt_id        BIGINT        NOT NULL,
    score             DECIMAL(7,2)  NOT NULL,
    duration_seconds  INT           NOT NULL,
    achieved_at       DATETIME2(3)  NOT NULL,
    updated_at        DATETIME2(3)  NOT NULL CONSTRAINT df_quiz_best_attempts_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_quiz_best_attempts PRIMARY KEY CLUSTERED (user_id, quiz_id),
    CONSTRAINT fk_quiz_best_attempts_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT fk_quiz_best_attempts_quiz FOREIGN KEY (quiz_id) REFERENCES dbo.quizzes (id),
    CONSTRAINT fk_quiz_best_attempts_course FOREIGN KEY (course_id) REFERENCES dbo.courses (id),
    CONSTRAINT fk_quiz_best_attempts_attempt FOREIGN KEY (attempt_id) REFERENCES dbo.quiz_attempts (id),
    CONSTRAINT uq_quiz_best_attempts_attempt UNIQUE (attempt_id),
    CONSTRAINT ck_quiz_best_attempts_values CHECK (score >= 0 AND duration_seconds >= 0)
);
GO
CREATE NONCLUSTERED INDEX ix_quiz_best_attempts_user_course ON dbo.quiz_best_attempts (user_id, course_id)
    INCLUDE (score, duration_seconds, achieved_at);
CREATE NONCLUSTERED INDEX ix_quiz_best_attempts_course ON dbo.quiz_best_attempts (course_id);
CREATE NONCLUSTERED INDEX ix_quiz_best_attempts_quiz ON dbo.quiz_best_attempts (quiz_id);
GO

CREATE TABLE dbo.rankings (
    user_id                 BIGINT        NOT NULL,
    course_id               BIGINT        NOT NULL,
    total_score             DECIMAL(9,2)  NOT NULL CONSTRAINT df_rankings_total_score DEFAULT 0,
    total_duration_seconds  INT           NOT NULL CONSTRAINT df_rankings_total_duration_seconds DEFAULT 0,
    completed_quiz_count    INT           NOT NULL CONSTRAINT df_rankings_completed_quiz_count DEFAULT 0,
    last_achieved_at        DATETIME2(3)  NULL,
    updated_at              DATETIME2(3)  NOT NULL CONSTRAINT df_rankings_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_rankings PRIMARY KEY CLUSTERED (user_id, course_id),
    CONSTRAINT fk_rankings_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT fk_rankings_course FOREIGN KEY (course_id) REFERENCES dbo.courses (id),
    CONSTRAINT ck_rankings_values CHECK (total_score >= 0 AND total_duration_seconds >= 0 AND completed_quiz_count >= 0)
);
GO
-- Phục vụ BR-RNK-02: điểm giảm dần, thời gian tăng dần, thời điểm đạt tăng dần
CREATE NONCLUSTERED INDEX ix_rankings_leaderboard ON dbo.rankings
    (course_id, total_score DESC, total_duration_seconds ASC, last_achieved_at ASC)
    INCLUDE (completed_quiz_count);
GO

/* =====================================================================
   5. ĐÁNH GIÁ & HỆ THỐNG
   ===================================================================== */

CREATE TABLE dbo.course_reviews (
    id             BIGINT          IDENTITY(1,1) NOT NULL,
    course_id      BIGINT          NOT NULL,
    user_id        BIGINT          NOT NULL,
    rating         TINYINT         NOT NULL,
    comment        NVARCHAR(1000)  NULL,
    is_hidden      BIT             NOT NULL CONSTRAINT df_course_reviews_is_hidden DEFAULT 0,
    hidden_reason  NVARCHAR(500)   NULL,
    hidden_by      BIGINT          NULL,
    hidden_at      DATETIME2(3)    NULL,
    created_at     DATETIME2(3)    NOT NULL CONSTRAINT df_course_reviews_created_at DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3)    NOT NULL CONSTRAINT df_course_reviews_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_course_reviews PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_course_reviews_course FOREIGN KEY (course_id) REFERENCES dbo.courses (id),
    CONSTRAINT fk_course_reviews_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT fk_course_reviews_hidden_by FOREIGN KEY (hidden_by) REFERENCES dbo.users (id),
    CONSTRAINT uq_course_reviews_course_user UNIQUE (course_id, user_id),
    CONSTRAINT ck_course_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_course_reviews_hidden CHECK (is_hidden = 0 OR (hidden_by IS NOT NULL AND hidden_at IS NOT NULL))
);
GO
CREATE NONCLUSTERED INDEX ix_course_reviews_course_visible ON dbo.course_reviews (course_id, is_hidden, created_at DESC)
    INCLUDE (rating, user_id);
CREATE NONCLUSTERED INDEX ix_course_reviews_user ON dbo.course_reviews (user_id);
GO

CREATE TABLE dbo.audit_logs (
    id           BIGINT         IDENTITY(1,1) NOT NULL,
    actor_id     BIGINT         NULL,
    action_type  NVARCHAR(30)   NOT NULL,
    entity_type  NVARCHAR(50)   NOT NULL,
    entity_id    BIGINT         NULL,
    before_data  NVARCHAR(MAX)  NULL,
    after_data   NVARCHAR(MAX)  NULL,
    ip_address   NVARCHAR(45)   NULL,
    user_agent   NVARCHAR(500)  NULL,
    created_at   DATETIME2(3)   NOT NULL CONSTRAINT df_audit_logs_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_audit_logs PRIMARY KEY CLUSTERED (id),
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES dbo.users (id),
    CONSTRAINT ck_audit_logs_action_type CHECK (action_type IN
        (N'CREATE', N'UPDATE', N'DELETE', N'LOCK', N'UNLOCK', N'PUBLISH', N'UNPUBLISH', N'ARCHIVE', N'RESTORE',
         N'HIDE', N'SHOW', N'ROLE_CHANGE', N'RESET_PASSWORD', N'RECALCULATE_RANKING', N'IMPORT', N'EXPORT')),
    CONSTRAINT ck_audit_logs_before_data CHECK (before_data IS NULL OR ISJSON(before_data) = 1),
    CONSTRAINT ck_audit_logs_after_data CHECK (after_data IS NULL OR ISJSON(after_data) = 1)
);
GO
CREATE NONCLUSTERED INDEX ix_audit_logs_entity ON dbo.audit_logs (entity_type, entity_id, created_at DESC);
CREATE NONCLUSTERED INDEX ix_audit_logs_actor ON dbo.audit_logs (actor_id, created_at DESC);
CREATE NONCLUSTERED INDEX ix_audit_logs_created_at ON dbo.audit_logs (created_at);
GO
