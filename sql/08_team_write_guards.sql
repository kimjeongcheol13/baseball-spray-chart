-- ============================================================
-- 08_team_write_guards.sql — user_games 쓰기 가드 + 팀 가입 RPC join_team_by_code
--
-- 배경 : (1) user_games 정책이 "내 행만 수정"을 보장하지 않으면 팀원이 서로의 경기를 고칠 수 있고,
--            남의 team_id 를 달아 경기를 넣을 수도 있다 (03b 의 '-' 항목).
--        (2) 팀 가입이 find_team_by_code → team_members 직접 insert 라서, team_members_insert 정책을 닫을 수 없다.
-- 변경 : a) user_games_update  : 내 행만(USING) · 결과 행도 내 것 + 내가 속한/소유한 팀의 team_id 만(WITH CHECK)
--        b) user_games_insert  : 같은 조건(WITH CHECK)
--        c) join_team_by_code  : 코드가 정확히 일치할 때만 (team_id, auth.uid()) 를 team_members 에 넣는다(중복 무시).
--                                소유자가 자기 팀 코드를 넣으면 삽입하지 않고 is_owner=true 만 돌려준다.
-- 선행 : 02_fix_teams_rls_recursion.sql (is_team_member / is_team_owner), 04 (find_team_by_code 와 같은 방침)
-- 순서 : ① 이 파일 적용 → ② 클라이언트(cloud.js joinTeam → rpc) 머지·배포 → ③ 09_drop_team_members_insert.sql 수동 적용
--        클라이언트가 먼저 배포되면 join_team_by_code 가 없어 가입이 실패한다.
-- 적용 : SQL Editor 에서 아래 "적용 전 확인"을 먼저 실행하고, 이 파일을 통째로 1회 실행. (DROP 없음 · 한 트랜잭션)
--
-- ── 적용 전 확인 (읽기 전용, 이 파일과 따로 실행) ─────────────────────────────
--  1) 지금 정책의 식을 저장해 둔다 (ROLLBACK · 09 되돌리기에 필요) — 저장소에는 이 식들이 없다
--       select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--        where schemaname = 'public' and tablename in ('user_games', 'team_members') order by 1, 2;
--  2) team_members 에 (team_id, user_id) unique 가 있는지 — 저장소에는 team_members 정의가 없다(클라이언트가 23505 를 가정했을 뿐)
--       select conname, contype, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.team_members'::regclass;
--       select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'team_members';
--     (없어도 이 파일의 RPC 는 중복 행을 만들지 않는다 — not exists 로 한 번 더 막는다. 다만 동시 호출 경쟁은 unique 가 있어야 막힌다)
--  3) 새 WITH CHECK 에 걸릴 행 — 더는 속하지 않은 팀의 team_id 가 남은 경기(탈퇴/해산 뒤). 0 이 아니면 아래 주의 참고
--       select count(*) from public.user_games g
--        where g.team_id is not null
--          and not exists (select 1 from public.team_members m where m.team_id = g.team_id and m.user_id = g.user_id)
--          and not exists (select 1 from public.teams t where t.id = g.team_id and t.owner_id = g.user_id);
--
-- 주의 : UPDATE 의 WITH CHECK 는 "수정 후 행"에 적용된다. 위 3) 에 걸리는 경기는 team_id 가 그대로 남아 있어
--        (클라이언트는 팀이 없으면 team_id 를 보내지 않는다) 이후 수정/upsert 가 42501 로 거부된다.
--        시작 동기화는 여러 행을 한 번에 upsert 하므로 한 행이 걸리면 그 요청 전체가 실패한다.
--        3) 이 0 이 아니면 적용 전에 정리한다 (예: 해당 행의 team_id 를 null 로) — 이 파일은 데이터를 바꾸지 않는다.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 아무것도 반영하지 않고 중단
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_games' and policyname = 'user_games_update' and cmd = 'UPDATE') then
    raise exception 'public.user_games 에 FOR UPDATE 정책 user_games_update 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_games' and policyname = 'user_games_insert' and cmd = 'INSERT') then
    raise exception 'public.user_games 에 FOR INSERT 정책 user_games_insert 가 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if to_regprocedure('public.is_team_member(uuid)') is null or to_regprocedure('public.is_team_owner(uuid)') is null then
    raise exception 'is_team_member / is_team_owner 가 없습니다. 02_fix_teams_rls_recursion.sql 을 먼저 적용하세요.';
  end if;
end $$;

-- a) user_games 수정: 내 행만, 수정 후에도 내 행 + 내 팀의 team_id 만
alter policy user_games_update on public.user_games
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (team_id is null or public.is_team_member(team_id) or public.is_team_owner(team_id))
  );

-- b) user_games 삽입: 같은 조건 (ALTER POLICY 는 이름 · 대상 역할 · 명령을 그대로 둔다)
alter policy user_games_insert on public.user_games
  with check (
    user_id = auth.uid()
    and (team_id is null or public.is_team_member(team_id) or public.is_team_owner(team_id))
  );

-- c) 코드로 팀 가입. 로그인한 사용자만. 코드가 정확히 일치할 때만 한 행을 돌려준다(없으면 0행).
--    security definer 라서 team_members 의 insert 정책(09 에서 삭제)과 무관하게 삽입된다 — 02 가 FORCE RLS 가 꺼져 있음을 확인했다.
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

  if v_team.owner_id is distinct from v_uid then   -- 소유자는 팀원으로 또 넣지 않는다
    insert into public.team_members (team_id, user_id)
    select v_team.id, v_uid
    where not exists (select 1 from public.team_members m where m.team_id = v_team.id and m.user_id = v_uid)
    on conflict do nothing;                   -- 이미 팀원이면 무시 (unique 가 있으면 경쟁 상황도 막는다)
  end if;

  return query select v_team.id, v_team.name, (v_team.owner_id = v_uid);
end;
$$;

revoke all on function public.join_team_by_code(text) from public, anon;
grant execute on function public.join_team_by_code(text) to authenticated;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 클라이언트가 이 RPC 를 쓰고 있으면 가입이 다시 막힌다)
-- ============================================================
-- drop function public.join_team_by_code(text);
-- 정책은 "적용 전 확인 1)" 에서 저장한 qual / with_check 로 되돌린다:
-- alter policy user_games_update on public.user_games using (<저장한 qual>) with check (<저장한 with_check>);
-- alter policy user_games_insert on public.user_games with check (<저장한 with_check>);
