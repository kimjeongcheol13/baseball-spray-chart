-- ============================================================
-- 10_one_team_per_user.sql — 한 사람당 팀 하나를 DB 가 강제한다
--
-- 배경 : 클라이언트는 한 사람이 팀 하나에만 속한다고 가정한다(cloud.js _loadMyTeam 의 maybeSingle).
--        DB 는 이를 강제하지 않아서 한 사람이 팀을 둘 소유하거나 둘에 가입하면 조회 오류로 팀 기능이 멈춘다.
--        (teams.owner_id · team_members.user_id 에 unique 가 없다. 2026-10-05 조회: 두 테이블 모두 0행)
-- 변경 : a) unique index  teams(owner_id), team_members(user_id)
--        b) join_team_by_code 재정의 (08 과 같은 시그니처·권한)
--             · 내 팀의 코드          → 가입시키지 않고 is_owner = true 만 돌려준다 (지금과 같음)
--             · 이미 이 팀의 팀원     → 같은 행을 돌려준다 (지금과 같음)
--             · 다른 팀을 소유하거나 다른 팀의 팀원 → 가입시키지 않고 예외(P0001, 한국어 메시지)
--           08 의 "on conflict do nothing"(대상 없음)은 user_id unique 가 생기면 다른 팀 소속 때의 충돌까지 조용히 삼켜
--           가입 성공처럼 보이게 되므로, 충돌을 명시적으로 처리한다.
--        c) teams_insert WITH CHECK 에 "어떤 팀의 팀원도 아님" 조건 추가.
--           teams 정책에서 team_members 를 직접 읽으면 RLS 재귀가 생기므로(02) security definer 함수 is_in_any_team() 으로 뺀다.
-- 선행 : 08_team_write_guards.sql (아래 가정 확인이 적용 여부를 본다)
-- 순서 : ① 이 파일 적용 → ② 클라이언트(cloud.js 오류 문구) 머지·배포
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 가정이 틀리면 아무것도 반영하지 않고 중단.
-- 알려진 한계 : 팀 생성과 가입이 같은 순간에 겹치는 경쟁(한 사람이 teams 와 team_members 에 동시에 들어감)은 테이블이 달라
--              unique 로 막을 수 없다. teams_insert 와 join_team_by_code 가 각자 상대 테이블을 확인할 뿐이다.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 중단
do $$
declare
  v_check text;
begin
  -- 08 적용 여부
  if to_regprocedure('public.join_team_by_code(text)') is null then
    raise exception 'join_team_by_code 가 없습니다. 08_team_write_guards.sql 을 먼저 적용하세요.';
  end if;
  select p.with_check into v_check from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'user_games' and p.policyname = 'user_games_update' and p.cmd = 'UPDATE';
  if v_check is null or position('is_team_member' in v_check) = 0 then
    raise exception 'user_games_update 에 08 의 WITH CHECK 가 적용돼 있지 않습니다. 08_team_write_guards.sql 을 먼저 적용하세요. (현재: %)', coalesce(v_check, '정책 없음');
  end if;

  -- 바꿀 정책이 알려진 원래 식 그대로인지
  select p.with_check into v_check from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'teams' and p.policyname = 'teams_insert' and p.cmd = 'INSERT';
  if not found then
    raise exception 'public.teams 에 FOR INSERT 정책 teams_insert 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if v_check is distinct from '(owner_id = auth.uid())' then
    raise exception 'teams_insert 의 WITH CHECK 가 예상과 다릅니다. 덮어쓰지 않고 중단합니다. (현재: %)', coalesce(v_check, 'null');
  end if;

  -- 중복 행이 없어야 unique index 를 만들 수 있고, 한 사람이 소유와 가입을 겸하면 안 된다
  if exists (select 1 from public.teams group by owner_id having count(*) > 1) then
    raise exception '한 사람이 둘 이상의 팀을 소유한 행이 teams 에 있습니다. 먼저 정리하세요.';
  end if;
  if exists (select 1 from public.team_members group by user_id having count(*) > 1) then
    raise exception '한 사람이 둘 이상의 팀에 가입한 행이 team_members 에 있습니다. 먼저 정리하세요.';
  end if;
  if exists (select 1 from public.teams t join public.team_members m on m.user_id = t.owner_id) then
    raise exception '팀을 소유하면서 팀원으로도 들어가 있는 사용자가 있습니다. 먼저 정리하세요.';
  end if;
end $$;

-- a) 한 사람당 팀 하나: 소유도, 가입도
create unique index teams_owner_id_uniq        on public.teams (owner_id);
create unique index team_members_user_id_uniq  on public.team_members (user_id);

-- c) 어떤 팀의 팀원인지 — security definer 라서 team_members 의 RLS 를 타지 않는다(02 와 같은 방식). 읽는 대상은 호출자 본인뿐.
create or replace function public.is_in_any_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members m where m.user_id = auth.uid());
$$;

revoke all on function public.is_in_any_team() from public;
grant execute on function public.is_in_any_team() to anon, authenticated, service_role;   -- 정책 평가에 쓰이므로 02 와 같이 anon 도 실행 가능(비로그인은 false)

-- c) 팀 만들기: 내가 소유자로 넣고, 어떤 팀의 팀원도 아닐 때만
alter policy teams_insert on public.teams
  with check (owner_id = auth.uid() and not public.is_in_any_team());

-- b) 코드로 팀 가입 (시그니처·권한은 08 과 같다)
create or replace function public.join_team_by_code(p_code text)
returns table (id uuid, name text, is_owner boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_team record;
  v_my   uuid;                                -- 내가 팀원으로 속한 팀(없으면 null)
begin
  if v_uid is null or p_code is null then
    return;                                   -- 비로그인 · 빈 코드
  end if;

  select t.id, t.name, t.owner_id into v_team
  from public.teams t
  where t.code = p_code                       -- 정확히 일치할 때만 (클라이언트가 trim + 대문자화해서 보낸다)
  limit 1;
  if not found then
    return;
  end if;

  if v_team.owner_id = v_uid then             -- 내 팀의 코드: 가입시키지 않고 is_owner = true 만
    return query select v_team.id, v_team.name, true;
    return;
  end if;

  select m.team_id into v_my from public.team_members m where m.user_id = v_uid limit 1;
  if v_my = v_team.id then                    -- 이미 이 팀의 팀원: 같은 행
    return query select v_team.id, v_team.name, false;
    return;
  end if;

  if v_my is not null or exists (select 1 from public.teams o where o.owner_id = v_uid) then
    raise exception '이미 다른 팀에 속해 있어요. 탈퇴 후 다시 시도해 주세요' using errcode = 'P0001';
  end if;

  begin
    insert into public.team_members (team_id, user_id) values (v_team.id, v_uid);
  exception when unique_violation then        -- 같은 사용자의 호출이 동시에 겹친 경쟁: 같은 팀이면 성공, 다른 팀이면 거부
    if not exists (select 1 from public.team_members m where m.team_id = v_team.id and m.user_id = v_uid) then
      raise exception '이미 다른 팀에 속해 있어요. 탈퇴 후 다시 시도해 주세요' using errcode = 'P0001';
    end if;
  end;

  return query select v_team.id, v_team.name, false;
end;
$$;

revoke all on function public.join_team_by_code(text) from public, anon;
grant execute on function public.join_team_by_code(text) to authenticated;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 순서대로. 클라이언트의 오류 문구는 그대로 둬도 동작한다)
-- ============================================================
-- alter policy teams_insert on public.teams with check (owner_id = auth.uid());   -- 원래 식
-- drop function public.is_in_any_team();                                          -- 위 정책을 되돌린 뒤에
-- drop index public.teams_owner_id_uniq;
-- drop index public.team_members_user_id_uniq;
-- -- 08 버전의 join_team_by_code 복원:
-- create or replace function public.join_team_by_code(p_code text)
-- returns table (id uuid, name text, is_owner boolean)
-- language plpgsql
-- volatile
-- security definer
-- set search_path = public
-- as $fn$
-- declare
--   v_uid  uuid := auth.uid();
--   v_team record;
-- begin
--   if v_uid is null or p_code is null then
--     return;
--   end if;
--   select t.id, t.name, t.owner_id into v_team
--   from public.teams t
--   where t.code = p_code
--   limit 1;
--   if not found then
--     return;
--   end if;
--   if v_team.owner_id is distinct from v_uid then
--     insert into public.team_members (team_id, user_id)
--     select v_team.id, v_uid
--     where not exists (select 1 from public.team_members m where m.team_id = v_team.id and m.user_id = v_uid)
--     on conflict do nothing;
--   end if;
--   return query select v_team.id, v_team.name, (v_team.owner_id = v_uid);
-- end;
-- $fn$;
-- revoke all on function public.join_team_by_code(text) from public, anon;
-- grant execute on function public.join_team_by_code(text) to authenticated;
