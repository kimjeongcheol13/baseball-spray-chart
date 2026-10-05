-- ============================================================
-- 12_team_display_name.sql — 팀원이 가입할 때 "팀에서 쓸 이름"을 정한다 (팀장 화면 "팀 경기"의 팀원 이름)
--
-- 배경 : user_games · team_members 어디에도 사람 이름이 없어서 팀장의 "팀 경기" 목록이 팀원을 구분하지 못한다.
--        구글 계정 이름은 쓰지 않는다 — 유소년 팀은 선수가 미성년자라 계정 실명을 팀에 노출하지 않는다.
--        그래서 가입할 때 본인이 정한 이름(예: "#7 김OO")만 team_members 에 저장한다.
-- 변경 : a) team_members.display_name text (null 허용 — 이 파일 이전에 가입한 행 · 구버전 클라이언트의 1인자 가입은 이름이 없다)
--           + check 1~20자
--        b) join_team_by_code(p_code text, p_name text) 오버로드 추가.
--           기존 1인자 함수는 건드리지 않는다(구버전 클라이언트가 그대로 동작). 새 함수는 이름을 trim 해서 검사한 뒤
--           1인자 함수를 호출하고(가입 규칙은 10 한 곳에만 둔다), 가입했거나 이미 이 팀의 팀원이면 그 행의 이름을 입력값으로 정한다.
--             · 이름이 비었으면(trim 뒤) 예외 P0001 "팀에서 쓸 이름을 입력해 주세요" — 가입하지 않는다
--             · 20자를 넘으면 예외 P0001 "이름은 20자 이하로 입력해 주세요"
--             · 내 팀의 코드 · 없는 코드 → 이름을 저장하지 않고 1인자와 같은 결과(is_owner = true / 빈 결과)
--        c) set_my_team_name(p_name text) — 이미 가입한 팀원이 자기 이름만 바꾼다. security definer, 본인 행(user_id = auth.uid())만.
--           team_members 에는 UPDATE 정책이 없어서 테이블을 직접 고칠 수는 없다 — 이름 변경은 이 함수로만 된다.
--        팀장은 team_members_select(02: 내 행 또는 내가 소유한 팀의 행)로 자기 팀 팀원의 이름을 읽는다. 팀원은 본인 행만 읽는다.
-- 선행 : 08 · 10 (아래 가정 확인이 검사). 11 은 목록 화면용이라 이 파일과 독립이지만 PR 순서는 ① 11 → ② 12 → ③ 머지·배포.
-- 순서 : **클라이언트 배포 전에** 적용한다. 새 클라이언트의 가입 폼이 2인자 함수를 부르므로 함수가 없으면 가입이 실패한다.
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 가정이 틀리면 아무것도 반영하지 않고 중단.
-- 알려진 한계 : 이름은 중복될 수 있고 검증하지 않는다(팀 안에서 구분은 팀장이 본인 팀 사정에 맞게 정한다).
--              이 파일 이전에 가입한 팀원은 이름이 없다 → 화면에는 임시 표시가 남고, set_my_team_name 을 부르는 화면은 이 PR 범위 밖이다.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 중단
do $$
begin
  if to_regprocedure('public.join_team_by_code(text)') is null then
    raise exception 'join_team_by_code(text) 가 없습니다. 08_team_write_guards.sql 을 먼저 적용하세요.';
  end if;
  if to_regclass('public.team_members_user_id_uniq') is null then
    raise exception 'team_members_user_id_uniq 가 없습니다. 10_one_team_per_user.sql 을 먼저 적용하세요(한 사람당 팀 하나 — set_my_team_name 이 본인 행 하나만 바꾼다는 전제).';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_members' and column_name = 'display_name') then
    raise exception 'team_members.display_name 이 이미 있습니다(12 가 적용된 것으로 보입니다). 중단합니다.';
  end if;
  if to_regprocedure('public.join_team_by_code(text,text)') is not null or to_regprocedure('public.set_my_team_name(text)') is not null then
    raise exception 'join_team_by_code(text,text) 또는 set_my_team_name 이 이미 있습니다. 중단합니다.';
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'team_members' and p.policyname = 'team_members_select' and p.cmd = 'SELECT') then
    raise exception 'team_members 에 SELECT 정책 team_members_select 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
end $$;

-- a) 컬럼 + 길이 검사. null 은 허용(이름 없는 기존 행) — 값이 있으면 1~20자
alter table public.team_members add column display_name text;
alter table public.team_members
  add constraint team_members_display_name_len check (display_name is null or char_length(display_name) between 1 and 20);

-- b) 이름을 받는 가입. 가입 규칙은 1인자 함수(10)가 그대로 판정한다 — 여기서는 이름 검사와 저장만 한다.
create or replace function public.join_team_by_code(p_code text, p_name text)
returns table (id uuid, name text, is_owner boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');   -- 앞뒤 공백(탭 · 줄바꿈 포함) 제거
  v_row  record;
begin
  if v_uid is null or p_code is null then
    return;                                   -- 비로그인 · 빈 코드 (1인자와 같다)
  end if;
  if v_name = '' then
    raise exception '팀에서 쓸 이름을 입력해 주세요' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 20 then
    raise exception '이름은 20자 이하로 입력해 주세요' using errcode = 'P0001';
  end if;

  select * into v_row from public.join_team_by_code(p_code);   -- 다른 팀 소속이면 여기서 P0001 이 그대로 올라온다
  if not found then
    return;                                   -- 없는 코드
  end if;

  if not v_row.is_owner then                  -- 방금 가입했거나 이미 이 팀의 팀원: 내 행의 이름을 입력값으로
    update public.team_members m set display_name = v_name where m.team_id = v_row.id and m.user_id = v_uid;
  end if;

  return query select v_row.id, v_row.name, v_row.is_owner;
end;
$$;

revoke all on function public.join_team_by_code(text, text) from public, anon;
grant execute on function public.join_team_by_code(text, text) to authenticated;

-- c) 이미 가입한 팀원이 자기 이름만 바꾼다
create or replace function public.set_my_team_name(p_name text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = 'P0001';
  end if;
  if v_name = '' then
    raise exception '팀에서 쓸 이름을 입력해 주세요' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 20 then
    raise exception '이름은 20자 이하로 입력해 주세요' using errcode = 'P0001';
  end if;

  update public.team_members m set display_name = v_name where m.user_id = v_uid;   -- 본인 행만(한 사람당 팀 하나 — 10)
  if not found then
    raise exception '가입한 팀이 없어요' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.set_my_team_name(text) from public, anon;
grant execute on function public.set_my_team_name(text) to authenticated;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 순서대로. 저장된 이름은 컬럼과 함께 사라진다. 클라이언트는 이름 없는 임시 표시로 돌아가지만 가입 폼은 2인자 함수가 없으면 실패하므로 클라이언트도 되돌린다)
-- ============================================================
-- begin;
-- drop function public.set_my_team_name(text);
-- drop function public.join_team_by_code(text, text);
-- alter table public.team_members drop constraint team_members_display_name_len;
-- alter table public.team_members drop column display_name;
-- commit;
