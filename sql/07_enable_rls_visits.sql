-- ============================================================
-- 07_enable_rls_visits.sql — public.visits 에 RLS 켜기 (정책 없음 = anon / authenticated 전면 차단)
--
-- 배경 : Supabase 보안 어드바이저 ERROR "rls_disabled_in_public" — public.visits 는 RLS 가 꺼져 있고 정책도 없어
--        anon 키(공개 JS 에 포함)만 있으면 누구나 읽기/쓰기/삭제가 가능한 상태였다.
-- 근거 (2026-10-02 운영 확인):
--   · 행 0건
--   · 최근 24시간 API 로그에 /visits 요청 0건
--   · 레포 어디에도 Supabase visits 참조 없음 (PR #55 에서 방문 기록 전송 제거. stats.html 의 visits 는 Firebase 의 별개 경로)
--   · DB 안에서도 의존 없음: 뷰 · 트리거 · FK · public 함수 · Realtime publication 모두 없음
-- 효과 : 정책 없이 RLS 만 켜면 anon / authenticated 는 이 테이블을 읽을 수도 쓸 수도 없다 (읽기는 빈 결과, 쓰기는 42501).
--        service_role 과 테이블 소유자(postgres)는 RLS 를 우회하므로 대시보드·서버 작업은 그대로 된다.
--        나중에 다시 방문 기록을 Supabase 에 쌓으려면 그때 "insert 만 허용하는 정책"을 새로 추가한다 (읽기는 열지 않는다).
-- 안전 : 트랜잭션. 테이블이 없거나, 이미 정책이 있으면(= 누가 의도를 가지고 설정했다는 뜻) 아무것도 바꾸지 않고 중단한다.
--        재실행해도 안전(멱등).
-- 적용 : SQL Editor 에 통째로 붙여 1회 실행 → 07b 로 검증.
-- 되돌림: 파일 맨 아래 ROLLBACK (다시 열린 상태가 된다)
-- ============================================================
begin;

do $$
begin
  if to_regclass('public.visits') is null then
    raise exception 'public.visits 테이블이 없습니다. 이 파일은 필요 없을 수 있어요 — 01_diagnose_rls.sql 결과를 확인하세요.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visits') then
    raise exception 'public.visits 에 이미 정책이 있습니다. 의도한 설정일 수 있으니 01_diagnose_rls.sql 로 먼저 확인하세요.';
  end if;
end $$;

alter table public.visits enable row level security;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 다시 anon 이 읽고 쓸 수 있는 상태가 된다)
-- ============================================================
-- alter table public.visits disable row level security;
