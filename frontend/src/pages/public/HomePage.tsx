import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { HomeData } from '@/api/types';
import { Icon } from '@/components/Icon';
import { CardGridSkeleton, CourseCard } from '@/components/CourseCard';
import { ErrorBox } from '@/components/ui';
import { formatNumber, formatRating } from '@/lib/format';

const CAT_ICON: Record<string, string> = { 'ky-nang-so': 'monitor', 'ngoai-ngu': 'message', 'su-pham-giao-duc': 'book', 'ky-nang-mem': 'users' };

/** SCR-CRS-01 — Trang chủ (FR-CRS-10). */
export default function HomePage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['home'], queryFn: () => api<HomeData>('/home') });
  const search = (e: FormEvent) => {
    e.preventDefault();
    nav(`/khoa-hoc${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };
  return (
    <>
      <section className="hero">
        <div className="container">
          <div>
            <span className="chip" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>
              <Icon name="award" size="sm" />
              Miễn phí cho mọi người dân
            </span>
            <h1 style={{ marginTop: 18 }}>
              Học kỹ năng số cùng
              <br />
              <em>Trường ĐHSP Hà Nội 2</em>
            </h1>
            <p className="lead">Khóa học ngắn, học theo lộ trình từng bài, có bài kiểm tra sau mỗi bài và bảng xếp hạng để cùng nhau tiến bộ.</p>
            <form className="big-search" onSubmit={search} role="search">
              <span style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: 'var(--ink-3)' }}>
                <Icon name="search" />
              </span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bạn muốn học gì? Ví dụ: an toàn thông tin" aria-label="Tìm khóa học" />
              <button className="btn btn-primary btn-lg">Tìm khóa học</button>
            </form>
            <div className="tags">
              <span style={{ opacity: 0.85 }}>Tìm nhiều:</span>
              {['Dịch vụ công trực tuyến', 'Tin học văn phòng', 'Tiếng Anh giao tiếp', 'Lừa đảo trực tuyến'].map((t) => (
                <Link key={t} className="chip" to={`/khoa-hoc?q=${encodeURIComponent(t)}`}>
                  {t}
                </Link>
              ))}
            </div>
          </div>
          <div className="seal">
            <div className="ring">
              <img src="/logo-256.png" alt="Logo Trường Đại học Sư phạm Hà Nội 2" />
            </div>
          </div>
        </div>
      </section>

      <div className="container stats">
        <div className="card">
          <div className="s">
            <div className="v">{formatNumber(data?.stats.courses)}</div>
            <div className="k">Khóa học miễn phí</div>
          </div>
          <div className="s">
            <div className="v">{formatNumber(data?.stats.learners)}</div>
            <div className="k">Người học</div>
          </div>
          <div className="s">
            <div className="v">{formatNumber(data?.stats.organizations)}</div>
            <div className="k">Tổ chức đào tạo</div>
          </div>
          <div className="s">
            <div className="v">{data && data.stats.ratingX100 > 0 ? `${formatRating(data.stats.ratingX100 / 100)} / 5` : '—'}</div>
            <div className="k">Đánh giá trung bình</div>
          </div>
        </div>
      </div>

      {error ? (
        <ErrorBox error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <section className="block container">
            <div className="sec-title">
              <h2>Lĩnh vực đào tạo</h2>
              <Link to="/khoa-hoc">
                Xem tất cả
                <Icon name="chevron-right" size="sm" />
              </Link>
            </div>
            <div className="cats">
              {(data?.categories ?? []).map((c) => (
                <Link key={c.id} className="cat" to={`/khoa-hoc?category=${c.slug}`}>
                  <span className="ic">
                    <Icon name={CAT_ICON[c.slug] ?? 'layers'} size="lg" />
                  </span>
                  <div>
                    <h3>{c.name}</h3>
                    <div className="sub">
                      {c.description ? `${c.description} · ` : ''}
                      {c.courseCount} khóa
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {(isLoading || (data?.featured.length ?? 0) > 0) && (
            <section className="block container">
              <div className="sec-title">
                <h2>Khóa học nổi bật</h2>
                <Link to="/khoa-hoc?sort=popular">
                  Xem tất cả
                  <Icon name="chevron-right" size="sm" />
                </Link>
              </div>
              <div className="grid-4">{isLoading ? <CardGridSkeleton /> : data!.featured.slice(0, 4).map((c) => <CourseCard key={c.id} c={c} />)}</div>
            </section>
          )}

          <section className="block container">
            <div className="sec-title">
              <h2>Khóa học mới nhất</h2>
              <Link to="/khoa-hoc?sort=newest">
                Xem tất cả
                <Icon name="chevron-right" size="sm" />
              </Link>
            </div>
            <div className="grid-4">{isLoading ? <CardGridSkeleton /> : data!.newest.slice(0, 4).map((c) => <CourseCard key={c.id} c={c} />)}</div>
          </section>
        </>
      )}

      <section className="block container">
        <div className="sec-title">
          <h2>Học như thế nào?</h2>
        </div>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <h3>Đăng ký tài khoản &amp; khóa học</h3>
            <p>Xác thực email bằng mã OTP, chọn khóa học phù hợp và bấm "Đăng ký học".</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Học lần lượt trong thời hạn</h3>
            <p>Hoàn thành bài trước để mở bài sau. Mỗi khóa có thời hạn học (thường là 3 tuần); hết hạn mà chưa xong, bạn sẽ phải học lại từ đầu.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Làm quiz &amp; lên bảng xếp hạng</h3>
            <p>Điểm cao hơn xếp trên; bằng điểm thì ai làm nhanh hơn xếp trên.</p>
          </div>
        </div>
      </section>
    </>
  );
}
