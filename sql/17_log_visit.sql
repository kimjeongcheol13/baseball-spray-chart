-- ============================================================
-- 17_log_visit.sql — 로그인 없이 쓰는 사람도 셀 수 있게 하루 한 번 방문 기록 (public.visits)
--
-- 왜 : 지금 사용자 수는 로그인 계정(auth.users)으로만 셀 수 있다. 앱은 로그인 없이 쓰고 기록이 기기에만 남아서
--      실제 몇 명이 쓰는지 모른다. 07 에서 막아 둔 public.visits 표(정책 없음)를 그대로 두고, 아래 함수로만 넣게 한다.
-- 변경 : a) log_visit(p_uid, p_kind) — 같은 uid 는 20시간에 1번만 넣는다(그 안이면 아무것도 안 함).
--           uid = js/analytics.js 의 익명 UUID(spraylab_uid, GA4 와 같은 값) · kind = 'a'|'l'(앱 · 소개 페이지) + 'm'|'d'(폰 · 컴퓨터)
--           표 전체 10분에 300줄까지(넘으면 조용히 버림) — 주소로 바로 쏘는 봇이 표를 키우지 못하게
--           새로 넣을 때 1년 지난 줄은 지운다(개인정보처리방침 3. 보관 기간)
--        b) visits (uid, created_at) 색인 — 위 20시간 검사용
--        표 정책은 그대로 없음 = 읽기 · 직접 쓰기 막힘. 이름 · 이메일 · IP 는 넣지 않는다 (uid · 날짜 · kind 만)
-- 클라이언트 : js/analytics.js — github.io 에서만, 자동화 브라우저(navigator.webdriver)는 빼고, 기기에서 하루 한 번(sl_visit_day)
--              함수가 없으면(이 파일 적용 전) 요청이 404 로 끝나고 화면은 아무 영향 없음
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 이미 있으면 중단.
-- 집계 예 : select created_at::date d, count(distinct uid) from visits where ua like 'a%' group by 1 order by 1;
-- 되돌림 : 맨 아래 ROLLBACK 블록
-- ============================================================
begin;

do $$
begin
  if to_regclass('public.visits') is null then
    raise exception 'public.visits 표가 없습니다. 중단합니다.';
  end if;
  if to_regprocedure('public.log_visit(text,text)') is not null then
    raise exception 'log_visit 이 이미 있습니다(17 이 적용된 것으로 보입니다). 중단합니다.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'visits') then
    raise exception 'public.visits 에 정책이 생겼습니다. 07 이후 바뀐 것이니 먼저 확인하세요. 중단합니다.';
  end if;
end $$;

create index if not exists visits_uid_created_at on public.visits (uid, created_at);
revoke all on table public.visits from anon, authenticated;

create function public.log_visit(p_uid text, p_kind text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_uid is null or p_uid !~ '^[0-9a-f-]{36}$' or p_kind is null or p_kind !~ '^[al][md]$' then
    raise exception '값이 올바르지 않습니다' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.visits insert'));   -- 동시에 와도 차례로 검사한다
  if exists (select 1 from public.visits where uid = p_uid and created_at > now() - interval '20 hours') then
    return;
  end if;
  if (select count(*) from public.visits where created_at > now() - interval '10 minutes') >= 300 then
    return;
  end if;
  delete from public.visits where created_at < now() - interval '1 year';   -- 처리방침: 1년 지나면 지운다
  insert into public.visits (uid, ts, ua) values (p_uid, (extract(epoch from now()) * 1000)::bigint, p_kind);
end $$;

revoke all on function public.log_visit(text, text) from public;
grant execute on function public.log_visit(text, text) to anon, authenticated;

commit;

-- ── 되돌림 (필요할 때만, 따로 실행) ──
-- begin;
-- drop function public.log_visit(text, text);
-- drop index public.visits_uid_created_at;
-- commit;
