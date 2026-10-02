-- ============================================================
-- 01_diagnose_rls.sql — 읽기 전용 진단 (아무것도 바꾸지 않음)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여 실행 → 결과 표 전체를 복사해 공유
-- 한 번에 결과표 1개만 나오도록 UNION 으로 묶었다.
--   kind=policy   : public 스키마의 모든 RLS 정책 (USING / WITH CHECK 원문)
--   kind=rls      : 테이블별 RLS 켜짐 / FORCE 여부
--   kind=function : public 함수 (security definer / search_path / 실행 권한)
--   kind=edge     : "A 테이블 정책이 B 테이블을 읽는다" 관계 (SELECT/ALL 정책 기준)
--   kind=cycle    : 위 관계에서 발견된 순환  ← 여기에 행이 있으면 재귀 위험
--   kind=affected : 순환 테이블을 직접 읽는 정책 (순환의 일부이거나, 순환의 영향을 받는 쪽)
-- 한계: 정책이 (security definer 가 아닌) 사용자 함수 안에서 다른 테이블을 읽는 경우는
--       edge 로 잡히지 않는다. kind=function 으로 해당 함수가 있는지 같이 본다.
-- ============================================================
with recursive
tabs as (
  select c.relname as t, c.relrowsecurity as rls, c.relforcerowsecurity as forced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
pol as (
  select tablename as t, policyname, cmd, roles::text as roles, qual, with_check,
         coalesce(qual, '') || ' ' || coalesce(with_check, '') as x
  from pg_policies where schemaname = 'public'
),
-- 정책 식 안에서 "FROM <표>" / "JOIN <표>" 로 다른(또는 같은) RLS 테이블을 읽는 관계
edges_all as (
  select p.t as src, b.t as dst, p.policyname, p.cmd
  from pol p join tabs b on b.rls and p.x ~* ('\m(from|join)\s+(public\.)?"?' || b.t || '"?\M')
),
-- 재귀는 "읽힌 표의 SELECT/ALL 정책"이 다시 다른 표를 읽을 때 생기므로 순환 탐색은 SELECT/ALL 정책 기준
edges as (select distinct src, dst from edges_all where cmd in ('SELECT', 'ALL')),
walk(start, cur, visited, closed) as (
  select src, dst, array[src], src = dst from edges
  union all
  select w.start, e.dst, w.visited || w.cur, e.dst = w.start
  from walk w join edges e on e.src = w.cur
  where not w.closed and (e.dst = w.start or e.dst <> all (w.visited || w.cur))
),
cycles as (
  select distinct array_to_string(visited || cur, ' -> ') as path, start
  from walk where closed
),
cyc_tabs as (select distinct start as t from cycles)

select 'policy' as kind, p.t || '.' || p.policyname as name,
       p.cmd || ' | roles=' || p.roles as detail,
       'USING: ' || coalesce(p.qual, '-') || E'\nCHECK: ' || coalesce(p.with_check, '-') as expr
from pol p
union all
select 'rls', t, case when rls then 'RLS ON' else 'RLS OFF' end || case when forced then ' (FORCE)' else '' end, null
from tabs where t in (select t from pol) or rls
union all
select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end
         || ' | ' || case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end
         || ' | config=' || coalesce(p.proconfig::text, '-')
         || ' | owner=' || pg_get_userbyid(p.proowner)
         || ' | acl=' || coalesce(p.proacl::text, 'default(PUBLIC)'),
       null
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (p.proname ilike '%team%' or p.prosecdef)
union all
select 'edge', e.src || ' -> ' || e.dst, e.cmd || ' | ' || e.policyname, null from edges_all e
union all
select 'cycle', c.path, 'RECURSION RISK', null from cycles c
union all
select 'affected', p.t || '.' || p.policyname, p.cmd || ' reads ' || b.t || ' (순환 테이블)', null
from pol p join cyc_tabs b on p.x ~* ('\m(from|join)\s+(public\.)?"?' || b.t || '"?\M')
order by 1, 2;
