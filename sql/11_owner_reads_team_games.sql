-- ============================================================
-- 11_owner_reads_team_games.sql — 팀장(소유자)도 자기 팀의 경기를 읽는다
--
-- 배경 : user_games_select 는 "내 행 또는 내가 팀원으로 속한 팀의 행"만 허용해서, 팀장은 팀원이 올린 경기를 읽지 못한다.
--        (팀장은 team_members 에 들어가지 않고 teams.owner_id 로만 판별된다.) 코치(팀장)가 선수 경기를 보는 것이 핵심 용도라 고친다.
--        Realtime(postgres_changes)도 같은 SELECT 정책을 따르므로 함께 해결된다.
-- 변경 : user_games_select USING
--          user_id = auth.uid()
--          OR (team_id IS NOT NULL AND (is_team_member(team_id) OR is_team_owner(team_id)))
--        팀원 판정도 직접 서브쿼리 대신 security definer 함수 is_team_member 로 바꾼다(02 의 방식 — 정책 안에서 team_members 를 읽지 않는다).
--        쓰기 정책(user_games_insert / update, 08)은 그대로다: 팀장이 읽을 수 있어도 남의 행을 고칠 수는 없다.
-- 선행 : 10_one_team_per_user.sql (teams_owner_id_uniq 가 있는지 확인), 02 (is_team_member / is_team_owner)
-- 순서 : ① 10 → ② 이 파일 → ③ 클라이언트 머지·배포
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 가정이 틀리면 아무것도 반영하지 않고 중단.
-- 알려진 한계 : 팀을 나가거나 강퇴된 사용자의 옛 경기는 team_id 가 남아 있는 동안 팀장에게 계속 보인다
--              (클라이언트는 그 사용자가 다음에 그 경기를 올릴 때 team_id 를 null 로 지운다). 팀 탈퇴 때 경기 team_id 를 비우는 처리는 이 파일 범위 밖이다.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 중단 (식 전체를 비교하지 않고 필요한 부분만 본다)
do $$
declare
  v_using text;
begin
  if to_regclass('public.teams_owner_id_uniq') is null then
    raise exception 'teams_owner_id_uniq 가 없습니다. 10_one_team_per_user.sql 을 먼저 적용하세요.';
  end if;
  if to_regprocedure('public.is_team_member(uuid)') is null or to_regprocedure('public.is_team_owner(uuid)') is null then
    raise exception 'is_team_member / is_team_owner 가 없습니다. 02_fix_teams_rls_recursion.sql 을 먼저 적용하세요.';
  end if;

  select p.qual into v_using from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'user_games' and p.policyname = 'user_games_select' and p.cmd = 'SELECT';
  if not found then
    raise exception 'public.user_games 에 FOR SELECT 정책 user_games_select 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if position('is_team_owner' in coalesce(v_using, '')) > 0 then
    raise exception 'user_games_select 에 이미 is_team_owner 가 있습니다(11 이 적용된 것으로 보입니다). 중단합니다. (현재: %)', v_using;
  end if;
end $$;

-- 내 행, 또는 내가 팀원이거나 소유한 팀의 행 (ALTER POLICY 는 이름 · 대상 역할 · 명령을 그대로 둔다)
alter policy user_games_select on public.user_games
  using (
    user_id = auth.uid()
    or (team_id is not null and (public.is_team_member(team_id) or public.is_team_owner(team_id)))
  );

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 팀장은 다시 팀원 경기를 읽지 못한다)
-- ============================================================
-- 11 적용 전의 실제 식(2026-10-05 pg_policies 조회):
-- alter policy user_games_select on public.user_games
--   using ((user_id = auth.uid()) or (team_id is not null and exists (select 1 from team_members where team_members.team_id = user_games.team_id and team_members.user_id = auth.uid())));
