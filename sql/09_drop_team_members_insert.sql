-- ============================================================
-- 09_drop_team_members_insert.sql — team_members 직접 insert 정책 삭제 (가입은 join_team_by_code RPC 로만)
--
-- 배경 : team_members_insert 가 열려 있으면 로그인한 사용자가 팀 코드를 몰라도 team id 만 알면
--        자기 자신을 아무 팀의 team_members 에 넣을 수 있다. 가입이 RPC(08)로 옮겨갔으므로 이 정책은 필요 없다.
-- 선행 : 08 적용 → 클라이언트(cloud.js joinTeam → rpc('join_team_by_code')) 배포 → 구버전 탭이 정리될 만큼 시간이 지난 뒤.
--        구버전 클라이언트는 team_members 에 직접 insert 하므로 이 파일을 적용한 뒤 가입이 42501 로 실패한다.
-- 적용 : DROP 이 들어 있어 MCP 도구로는 막힐 수 있다 → SQL Editor 에서 수동 실행하고 sql/README.md 이력에 "수동 적용" 으로 남긴다.
--
-- ── 적용 전 확인 (읽기 전용) ─────────────────────────────────────────────────
--  · 소유자를 team_members 에 넣는 경로가 DB 쪽에 없는지. 클라이언트(createTeam)는 teams 에만 insert 하고 소유자는 teams.owner_id 로
--    판별한다(cloud.js _loadMyTeam). 다만 저장소에 없는 트리거가 있을 수 있다:
--       select tgrelid::regclass as tbl, tgname, pg_get_triggerdef(oid) as def, tgfoid::regproc as fn,
--              (select prosecdef from pg_proc where oid = tgfoid) as fn_security_definer
--         from pg_trigger
--        where tgrelid in ('public.teams'::regclass, 'public.team_members'::regclass) and not tgisinternal;
--  · 대체안 (위 조회에서 teams 트리거가 team_members 에 insert 하고 fn_security_definer 가 false 인 경우에만 필요):
--      1) 그 트리거 함수를 security definer + set search_path = public 으로 바꾼다 (가장 작은 변경), 또는
--      2) create_team(p_name text) RPC(security definer)가 teams insert 와 소유자 행 삽입을 한 번에 하고,
--         클라이언트 createTeam 이 그 RPC 를 부르게 한다. 이 경우 teams 의 직접 insert 정책도 같이 닫을 수 있다.
--    트리거가 없으면 대체안은 필요 없다.
-- ============================================================
begin;

drop policy team_members_insert on public.team_members;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 구버전 클라이언트의 직접 가입이 다시 열린다)
-- ============================================================
-- 08 "적용 전 확인 1)" 에서 저장한 team_members_insert 의 with_check 식으로 다시 만든다. 예:
-- create policy team_members_insert on public.team_members for insert to authenticated with check (user_id = auth.uid());
