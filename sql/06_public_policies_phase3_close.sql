-- ============================================================
-- 06_public_policies_phase3_close.sql — [Phase 3] 공개 정책 닫기 (games / feedback / shared_links)
--
-- 선행 : 05 적용 + 클라이언트(core.js ?v=122) 배포 + 배포 확인(실서비스에서 games 요청에 x-team-code 헤더가 실리고 200)
--        ※ 구버전 클라이언트(헤더 없음)는 이 파일 적용 후 팀 코드 동기화가 빈 결과/실패가 된다 → 배포 후 충분히 기다린 뒤 적용
-- 변경 :
--   games        : pub_r/pub_i/pub_u/pub_d(전부 true) 삭제 → team_code = request_team_code() 인 행만 select/insert/update/delete
--                  (대상 역할은 기존과 같은 public. (select ...) 로 감싸 쿼리당 1번만 평가)
--   feedback     : allow_select 삭제 (allow_insert 유지 — 클라이언트는 insert 만 사용, 반환값 없음)
--   shared_links : public_read 삭제 (public_insert 유지 — 읽기는 get_shared_link RPC)
-- 안전 : 트랜잭션. 05 가 없거나 예상 정책이 없으면 아무것도 바꾸지 않고 중단한다.
-- 되돌림: 파일 맨 아래 ROLLBACK 블록 (옛 공개 정책 복구)
-- ============================================================
begin;

-- 0) 사전 점검
do $$
begin
  if to_regprocedure('public.request_team_code()') is null then
    raise exception '05_public_policies_phase1_additive.sql 을 먼저 적용하세요 (request_team_code() 없음)';
  end if;
  if to_regprocedure('public.get_shared_link(text)') is null then
    raise exception '05_public_policies_phase1_additive.sql 을 먼저 적용하세요 (get_shared_link(text) 없음)';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'games' and policyname in ('pub_r', 'pub_i', 'pub_u', 'pub_d')) <> 4 then
    raise exception 'games 의 예상 정책(pub_r/pub_i/pub_u/pub_d)이 아닙니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback' and policyname = 'allow_select' and cmd = 'SELECT') then
    raise exception 'feedback.allow_select 정책이 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_links' and policyname = 'public_read' and cmd = 'SELECT') then
    raise exception 'shared_links.public_read 정책이 없습니다. 01_diagnose_rls.sql 결과를 먼저 확인하세요.';
  end if;
end $$;

-- 1) games — 팀 코드(헤더)가 일치하는 행만
drop policy pub_r on public.games;
drop policy pub_i on public.games;
drop policy pub_u on public.games;
drop policy pub_d on public.games;

create policy games_select on public.games for select
  using (team_code = (select public.request_team_code()));
create policy games_insert on public.games for insert
  with check (team_code = (select public.request_team_code()));
create policy games_update on public.games for update
  using (team_code = (select public.request_team_code()))
  with check (team_code = (select public.request_team_code()));   -- 다른 팀 코드로 바꿔치기 금지
create policy games_delete on public.games for delete
  using (team_code = (select public.request_team_code()));

-- 2) feedback — 읽기 닫기 (insert 는 allow_insert 그대로)
drop policy allow_select on public.feedback;

-- 3) shared_links — 목록 읽기 닫기 (insert 는 public_insert 그대로, 읽기는 get_shared_link RPC)
drop policy public_read on public.shared_links;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 다시 공개 상태가 된다)
-- ============================================================
-- begin;
-- drop policy games_select on public.games;  drop policy games_insert on public.games;
-- drop policy games_update on public.games;  drop policy games_delete on public.games;
-- create policy pub_r on public.games for select using (true);
-- create policy pub_i on public.games for insert with check (true);
-- create policy pub_u on public.games for update using (true) with check (true);
-- create policy pub_d on public.games for delete using (true);
-- create policy allow_select on public.feedback for select using (true);
-- create policy public_read on public.shared_links for select using (true);
-- commit;
