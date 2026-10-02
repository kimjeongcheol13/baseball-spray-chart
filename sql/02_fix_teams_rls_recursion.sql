-- ============================================================
-- 02_fix_teams_rls_recursion.sql — teams ↔ team_members RLS 무한 재귀 제거
--
-- 증상 : user_games / teams / team_members REST 가 전부 500
--        "infinite recursion detected in policy for relation "team_members""
-- 원인 : 두 SELECT 정책이 서로의 테이블을 서브쿼리로 읽음 (RLS 가 서브쿼리에도 적용돼 순환)
--          team_members_select → teams  → teams_select → team_members → …
--        user_games 정책도 team_members 를 읽으므로 같이 500 이 된다.
-- 해결 : "소유자인가 / 멤버인가" 판정을 security definer 함수로 빼서 서브쿼리의 RLS 를 건너뜀.
--        판정식은 기존 서브쿼리와 동일하므로 누가 무엇을 볼 수 있는지는 그대로다.
--
-- 적용 : SQL Editor 에 통째로 붙여 1회 실행 (트랜잭션 — 중간 실패 시 아무것도 반영되지 않음)
-- 되돌림: 파일 맨 아래 ROLLBACK 블록 참고 (되돌리면 재귀가 다시 생긴다)
-- 선행 : 01_diagnose_rls.sql 결과에서 kind=cycle 행이 teams/team_members 외 다른 테이블을
--        포함하면 이 파일만으로는 부족하다 → 결과를 공유해 달라.
-- ============================================================
begin;

-- 0) 사전 점검 — 가정이 틀리면 아무것도 바꾸지 않고 중단
do $$
begin
  -- cmd = SELECT 여야 한다: FOR ALL 이면 WITH CHECK 에 옛 식이 남아 ALTER ... USING 만으로는 재귀가 안 끊긴다
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_members' and policyname = 'team_members_select' and cmd = 'SELECT') then
    raise exception 'public.team_members 에 FOR SELECT 정책 team_members_select 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'teams_select' and cmd = 'SELECT') then
    raise exception 'public.teams 에 FOR SELECT 정책 teams_select 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  -- FORCE RLS 면 테이블 소유자(= 함수 소유자)도 RLS 를 받아 security definer 로 순환을 못 끊는다
  if exists (select 1 from pg_class where oid in ('public.teams'::regclass, 'public.team_members'::regclass) and relforcerowsecurity) then
    raise exception 'teams / team_members 에 FORCE ROW LEVEL SECURITY 가 켜져 있어 이 방식이 통하지 않습니다.';
  end if;
end $$;

-- 1) 판정 함수 — security definer: 함수 소유자(테이블 소유자)의 권한으로 읽으므로 RLS 재귀 없음
--    · auth.uid() 를 함수 안에서 직접 읽는다 (호출자가 다른 사람 uid 를 넘길 수 없음)
--    · search_path 고정 + 객체명 스키마 명시 (definer 함수의 search_path 하이재킹 방지)
--    · stable + SET 절이 있어 플래너가 호출 쪽으로 인라인하지 않는다 (인라인되면 다시 RLS 가 적용됨)
create or replace function public.is_team_owner(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t
    where t.id = tid and t.owner_id = auth.uid()
  );
$$;

create or replace function public.is_team_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = tid and m.user_id = auth.uid()
  );
$$;

-- 실행 권한: PUBLIC 기본 부여를 걷고 필요한 역할에만 명시.
-- anon 을 남기는 이유: 정책의 대상 역할(TO ...)을 아직 확인하지 못했다. 정책이 anon 도 평가하는 경우
-- 권한을 걷으면 "빈 결과" 대신 42501 오류가 새로 생긴다. 함수는 auth.uid() 만 보므로 anon 에게는 항상 false.
revoke all on function public.is_team_owner(uuid)  from public;
revoke all on function public.is_team_member(uuid) from public;
grant execute on function public.is_team_owner(uuid)  to anon, authenticated, service_role;
grant execute on function public.is_team_member(uuid) to anon, authenticated, service_role;

-- 2) 정책 교체 — ALTER POLICY 는 USING 식만 바꾼다 (이름 · 대상 역할 · 명령은 그대로)
--    기존 식과 동치:
--      team_members: user_id = auth.uid() OR EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.owner_id = auth.uid())
--      teams       : owner_id = auth.uid() OR EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid())
alter policy team_members_select on public.team_members
  using (user_id = auth.uid() or public.is_team_owner(team_id));

alter policy teams_select on public.teams
  using (owner_id = auth.uid() or public.is_team_member(id));

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 재귀가 다시 생기므로 비상용)
-- ============================================================
-- begin;
-- alter policy team_members_select on public.team_members
--   using (user_id = auth.uid() or exists (select 1 from teams where teams.id = team_members.team_id and teams.owner_id = auth.uid()));
-- alter policy teams_select on public.teams
--   using (owner_id = auth.uid() or exists (select 1 from team_members where team_members.team_id = teams.id and team_members.user_id = auth.uid()));
-- drop function public.is_team_owner(uuid);
-- drop function public.is_team_member(uuid);
-- commit;
