-- ============================================================
-- 04_find_team_by_code_rpc.sql — 팀 코드로 가입할 때 쓰는 "코드 정확히 일치 조회" RPC
--
-- 배경 : 앱의 joinTeam() 은 가입 전(=비팀원) 사용자가 코드로 teams 를 조회해야 한다.
--        그러나 teams_select 는 소유자/팀원만 허용하므로 비팀원은 팀을 찾지 못한다 (03/03b 의 teams BY CODE).
-- 방침 : teams_select 는 풀지 않는다 (코드를 몰라도 목록 · 이름을 훑어볼 수 있게 되므로).
--        코드가 "정확히 일치"할 때만 id / name / 내가 소유자인지(is_owner) 만 돌려주는 RPC 를 둔다.
--        owner_id · code · created_at 등 다른 컬럼은 돌려주지 않는다.
-- 보안 : security definer + search_path 고정, 로그인(authenticated)만 실행 가능, anon 은 실행 불가(42501).
--        부분 일치 · LIKE · 목록 조회 없음 (등호 비교, limit 1).
-- 선행 : 02_fix_teams_rls_recursion.sql
-- 적용 : SQL Editor 에 통째로 붙여 1회 실행. 프론트(cloud.js joinTeam)는 이 함수를 적용한 뒤에 배포한다.
-- ============================================================
begin;

create or replace function public.find_team_by_code(p_code text)
returns table (id uuid, name text, is_owner boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, (t.owner_id = auth.uid())
  from public.teams t
  where auth.uid() is not null        -- 로그인한 사용자만
    and p_code is not null
    and t.code = p_code               -- 정확히 일치할 때만 (클라이언트가 trim + 대문자화해서 보낸다)
  limit 1;
$$;

revoke all on function public.find_team_by_code(text) from public, anon;
grant execute on function public.find_team_by_code(text) to authenticated, service_role;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 프론트가 이 함수를 쓰고 있으면 가입이 다시 막힌다)
-- ============================================================
-- drop function public.find_team_by_code(text);
