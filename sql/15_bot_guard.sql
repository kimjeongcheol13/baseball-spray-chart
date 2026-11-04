-- ============================================================
-- 15_bot_guard.sql — 로그인 없이 쓰는 두 표(feedback · shared_links)에 크기 · 횟수 제한 (봇 경비 B)
--
-- 배경 : 두 표는 비로그인(anon)에게 insert 가 열려 있다(05 · 06 — 의견 보내기 · 공유 링크 만들기). anon 키는 페이지에 들어 있으므로
--        봇은 우리 화면(js/botguard.js 의 숨은 칸 · 빠르기 검사)을 거치지 않고 저장소 주소로 바로 넣을 수 있다.
--        그런 봇이 큰 행을 많이 넣어 무료 용량을 채우거나 표를 쓰레기로 덮지 못하게 저장소 쪽에서 막는다.
-- 변경 : a) 크기 검사(check · NOT VALID — 이미 있는 행은 검사하지 않고 새로 들어오는 행만 본다)
--           feedback     : text ≤ 2000자 · tags ≤ 10개이고 합쳐 ≤ 200자 · ua ≤ 200자 · ver ≤ 20자
--           shared_links : payload ≤ 256 KB(글자로 바꾼 크기) · id 4~32자
--        b) 횟수 제한 트리거(before insert · security definer — RLS 에 가려지지 않고 표 전체를 센다)
--           feedback     : 10분에 20개 · 하루 200개
--           shared_links : 10분에 60개 · 하루 600개 · 하루 합계 50 MB
--           넘으면 SQLSTATE PT429 예외. PostgREST 는 PTnnn 을 HTTP nnn 으로 돌려준다(429) — 아니더라도 오류이므로 앱 동작은 같다:
--             의견 보내기 = Formspree 로는 그대로 가고 Supabase 실패는 콘솔에만 남는다(core.js fieldFeedbackSubmit)
--             공유 링크   = 예전 방식(주소에 담는 링크)으로 자동 대체된다(core.js pushSharedLink onFail → _shareGameLinkLegacy)
--           created_at 은 트리거가 now() 로 고정한다 — 보내는 쪽이 옛날 시각을 넣어 횟수 세기를 피하지 못하게
--           동시에 여러 행이 들어와도 차례로 세도록 표마다 트랜잭션 잠금(pg_advisory_xact_lock)을 건다
--        c) created_at 인덱스 2개(세기용)
-- 한도 고른 근거(2026-11-05 읽기 전용 조회 — 개수 · 크기만 봄): feedback 전체 9행 · 최근 30일 0행 · 글 최대 65자 · 태그 최대 1개.
--        shared_links 전체 42행 · 최근 30일 12행 · payload 최대 33 KB · 가운데값 8.8 KB · id 모두 8자. DB 전체 13 MB.
--        → 한도는 지금 쓰임새의 수십 배다. 정상 사용자는 닿지 않는다.
-- 알려진 한계 : 횟수는 표 전체로 센다(IP 별이 아니다 — IP 는 저장하지 않는다). 봇이 한도까지 채우면 그 10분 · 하루 동안은
--              진짜 사용자의 저장도 막힌다(위의 대체 동작으로 기능은 살아 있다). Formspree 로 바로 보내는 것은 이 파일로 못 막는다.
-- 선행 : 06(공개 읽기 닫기). 아래 가정 확인이 검사한다. 클라이언트 배포와 순서 무관 — 지금 클라이언트(core.js 251 · 252)는 이미 한도 안의 값만 보낸다.
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 가정이 틀리면 아무것도 반영하지 않고 중단. 적용 후 15b 로 확인.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 중단
do $$
declare
  v_missing text;
begin
  if to_regclass('public.feedback') is null or to_regclass('public.shared_links') is null then
    raise exception 'public.feedback 또는 public.shared_links 가 없습니다.';
  end if;
  -- 이 파일이 쓰는 열과 모양
  select string_agg(want.t || '.' || want.c || ' ' || want.u, ', ') into v_missing
  from (values ('feedback', 'text', 'text'), ('feedback', 'tags', '_text'), ('feedback', 'ua', 'text'), ('feedback', 'ver', 'text'),
               ('feedback', 'created_at', 'timestamptz'), ('shared_links', 'id', 'text'), ('shared_links', 'payload', 'jsonb'),
               ('shared_links', 'created_at', 'timestamptz')) as want(t, c, u)
  where not exists (select 1 from information_schema.columns k
                    where k.table_schema = 'public' and k.table_name = want.t and k.column_name = want.c and k.udt_name = want.u);
  if v_missing is not null then
    raise exception '열이 없거나 모양이 다릅니다: %', v_missing;
  end if;
  -- 비로그인 insert 가 열려 있고(05 · 06), 공개 읽기는 닫혀 있다(06)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback' and policyname = 'allow_insert' and cmd = 'INSERT')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_links' and policyname = 'public_insert' and cmd = 'INSERT') then
    raise exception 'feedback.allow_insert 또는 shared_links.public_insert 정책이 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('feedback', 'shared_links') and cmd = 'SELECT') then
    raise exception 'feedback · shared_links 에 SELECT 정책이 남아 있습니다. 06_public_policies_phase3_close.sql 을 먼저 적용하세요.';
  end if;
  -- 두 번 적용 방지 · 다른 사용자 트리거가 있으면 순서를 따져야 하므로 중단
  if exists (select 1 from pg_constraint where conrelid in ('public.feedback'::regclass, 'public.shared_links'::regclass)
             and conname in ('feedback_text_len', 'feedback_tags_len', 'feedback_meta_len', 'shared_links_payload_size', 'shared_links_id_len'))
     or to_regprocedure('public.feedback_insert_guard()') is not null or to_regprocedure('public.shared_links_insert_guard()') is not null then
    raise exception '이 파일이 만드는 제약 · 함수가 이미 있습니다(15 가 적용된 것으로 보입니다). 중단합니다.';
  end if;
  if exists (select 1 from pg_trigger where not tgisinternal and tgrelid in ('public.feedback'::regclass, 'public.shared_links'::regclass)) then
    raise exception 'feedback · shared_links 에 이미 사용자 트리거가 있습니다. 순서를 확인한 뒤 적용하세요.';
  end if;
end $$;

-- a) 크기 검사 — NOT VALID: 이미 있는 행은 그대로 두고, 이제부터 들어오는 행만 검사한다
alter table public.feedback
  add constraint feedback_text_len check (text is null or char_length(text) <= 2000) not valid;
alter table public.feedback
  add constraint feedback_tags_len check (tags is null or (cardinality(tags) <= 10 and char_length(array_to_string(tags, ',')) <= 200)) not valid;
alter table public.feedback
  add constraint feedback_meta_len check (char_length(coalesce(ua, '')) <= 200 and char_length(coalesce(ver, '')) <= 20) not valid;
alter table public.shared_links
  add constraint shared_links_payload_size check (octet_length(payload::text) <= 262144) not valid;
alter table public.shared_links
  add constraint shared_links_id_len check (char_length(id) between 4 and 32) not valid;

-- b) 횟수 제한 트리거
create or replace function public.feedback_insert_guard()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  n10  int;
  nday int;
begin
  new.created_at := now();                                        -- 보내는 쪽이 넣은 시각은 쓰지 않는다
  perform pg_advisory_xact_lock(hashtext('sl_bot_guard.feedback')); -- 동시에 들어와도 차례로 센다
  select count(*) filter (where f.created_at > now() - interval '10 minutes'), count(*)
    into n10, nday
    from public.feedback f
   where f.created_at > now() - interval '1 day';
  if n10 >= 20 or nday >= 200 then
    raise exception '의견이 너무 많이 들어오고 있어요. 잠시 뒤에 다시 보내 주세요' using errcode = 'PT429';
  end if;
  return new;
end $$;

create or replace function public.shared_links_insert_guard()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  n10  int;
  nday int;
  bday bigint;
begin
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext('sl_bot_guard.shared_links'));
  select count(*) filter (where s.created_at > now() - interval '10 minutes'), count(*), coalesce(sum(octet_length(s.payload::text)), 0)
    into n10, nday, bday
    from public.shared_links s
   where s.created_at > now() - interval '1 day';
  if n10 >= 60 or nday >= 600 or bday + octet_length(new.payload::text) > 52428800 then
    raise exception '공유 링크가 너무 많이 만들어지고 있어요. 잠시 뒤에 다시 해 주세요' using errcode = 'PT429';
  end if;
  return new;
end $$;

-- 트리거 함수는 트리거로만 돈다 — 직접 부를 권한은 거둔다(트리거가 불릴 때는 권한을 보지 않는다)
revoke execute on function public.feedback_insert_guard() from public;
revoke execute on function public.shared_links_insert_guard() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.feedback_insert_guard(), public.shared_links_insert_guard() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.feedback_insert_guard(), public.shared_links_insert_guard() from authenticated';
  end if;
end $$;

create trigger feedback_insert_guard
  before insert on public.feedback
  for each row execute function public.feedback_insert_guard();
create trigger shared_links_insert_guard
  before insert on public.shared_links
  for each row execute function public.shared_links_insert_guard();

-- c) 세기용 인덱스
create index if not exists feedback_created_at_idx on public.feedback (created_at);
create index if not exists shared_links_created_at_idx on public.shared_links (created_at);

commit;

-- ============================================================
-- 확인 : 15b_verify_bot_guard.sql 실행 → "VERIFY_RESULT …" 오류 메시지가 결과표(전부 OK 여야 함 · 전부 롤백됨)
--
-- 잠깐 끄기 (한도 때문에 진짜 사용자가 막힐 때 — 지우지 않고 멈춤):
--   alter table public.feedback disable trigger feedback_insert_guard;
--   alter table public.shared_links disable trigger shared_links_insert_guard;
--   (다시 켜기: … enable trigger …)
-- 한도만 바꾸기 : 위 b) 의 함수를 숫자만 고쳐 create or replace 로 다시 실행한다(트리거는 그대로).
--
-- ROLLBACK (완전히 되돌리기 — 필요할 때만 SQL Editor 에서):
-- begin;
-- drop trigger feedback_insert_guard on public.feedback;
-- drop trigger shared_links_insert_guard on public.shared_links;
-- drop function public.feedback_insert_guard();
-- drop function public.shared_links_insert_guard();
-- alter table public.feedback drop constraint feedback_text_len, drop constraint feedback_tags_len, drop constraint feedback_meta_len;
-- alter table public.shared_links drop constraint shared_links_payload_size, drop constraint shared_links_id_len;
-- drop index public.feedback_created_at_idx;
-- drop index public.shared_links_created_at_idx;
-- commit;
-- ============================================================
