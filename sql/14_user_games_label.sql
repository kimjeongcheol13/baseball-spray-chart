-- ============================================================
-- 14_user_games_label.sql — 경기 이름 바꾸기를 다른 기기로 보낸다: user_games.label · label_at
--
-- 배경 : 경기 이름(sl_saves 의 label)은 기기마다 따로 저장된다. 이름 바꾸기(core.js renameGame)는 user_games 에 아무것도 올리지 않는다 —
--        이름만 바뀐 경기를 data 째로 올리면, 내용이 오래된 기기가 서버의 더 새로운 기록을 덮을 수 있어서다(updated_at 도 바뀐다).
--        그래서 휴대폰에서 바꾼 이름이 PC 에 가지 않았다.
-- 변경 : a) user_games.label    text        (null 허용 — 이름을 바꾼 적 없는 경기 · 이 파일 이전의 행)
--        b) user_games.label_at timestamptz (null 허용 — 이름을 바꾼 시각. 기기끼리 이 값이 더 새로운 쪽 이름을 쓴다)
--        클라이언트는 이름을 바꿀 때 update(label, label_at).eq(user_id).eq(game_key) 만 한다 — data · updated_at 은 건드리지 않는다.
--        경기 저장(upsert)은 이 두 열을 싣지 않으므로 저장이 이름을 지우지 않는다(PostgREST upsert 는 보낸 열만 바꾼다).
-- 권한 : 새 정책 없음. 정책은 행 단위라 새 열에도 그대로 적용된다.
--          · 수정 user_games_update(08): USING user_id = auth.uid(), WITH CHECK user_id = auth.uid() and (team_id 가 null 이거나 내 팀)
--            → 내 행의 이름만 바꿀 수 있다. team_id 는 그대로 두므로 WITH CHECK 는 지금 행의 상태 그대로 판정된다
--          · 읽기 user_games_select(11): 내 행 · 내 팀 행 — 새 열도 같은 행만 읽힌다
--        열 단위 GRANT 가 있으면 새 열이 빠질 수 있다 → 아래 2) 가 authenticated 의 열 권한을 확인하고, 없으면 전부 되돌린다.
-- 선행 : 08 (가정 확인이 검사).
-- 순서 : ① 이 파일 적용 → ② 클라이언트(cloud.js · core.js) 머지·배포.
--        클라이언트가 먼저 나가도 경기 동기화는 그대로 된다 — 이름 동기화만 실패한다(조회 실패는 콘솔 경고, 이름 바꾸기는 "클라우드 저장 실패" 알림).
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 가정이 틀리면 아무것도 반영하지 않고 중단.
-- 알려진 한계 : label_at 은 기기의 시계다(updated_at 과 같다). 시계가 크게 틀린 기기의 이름 바꾸기는 순서가 뒤바뀔 수 있다.
-- ============================================================
begin;

-- 0) 가정 확인 — 틀리면 중단
do $$
declare
  v_check text;
begin
  if to_regclass('public.user_games') is null then
    raise exception 'public.user_games 가 없습니다.';
  end if;
  select p.with_check into v_check from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'user_games' and p.policyname = 'user_games_update' and p.cmd = 'UPDATE';
  if v_check is null or position('auth.uid()' in v_check) = 0 or position('is_team_member' in v_check) = 0 then
    raise exception 'user_games_update 에 08 의 WITH CHECK 가 없습니다. 08_team_write_guards.sql 을 먼저 적용하세요. (현재: %)', coalesce(v_check, '정책 없음');
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_games' and column_name in ('label', 'label_at')) then
    raise exception 'user_games.label 또는 label_at 이 이미 있습니다(14 가 적용된 것으로 보입니다). 중단합니다.';
  end if;
  -- 이름만 바꾸는 update 가 updated_at 을 바꾸면 안 된다: 다른 기기가 서버본을 "더 새로운 기록"으로 보고 내려받아 그 기기의 기록을 덮는다.
  -- 2026-10-05 조회(09)에서 user_games 에 사용자 트리거가 없었다 — 그 사이 생겼으면 중단한다
  if exists (select 1 from pg_trigger t where t.tgrelid = 'public.user_games'::regclass and not t.tgisinternal) then
    raise exception 'user_games 에 사용자 트리거가 있습니다. 이름만 바꾸는 update 가 updated_at 을 바꾸는지 먼저 확인하세요. 중단합니다.';
  end if;
end $$;

-- 1) 열 추가
alter table public.user_games
  add column label    text,
  add column label_at timestamptz;

-- 2) 로그인 사용자가 새 열을 읽고 고칠 수 있는지 — 열 단위 GRANT 때문에 빠졌으면 전부 되돌린다
do $$
begin
  -- 권한을 쉼표로 묶으면 "하나라도 있으면 참"이라 하나씩 본다
  if not (has_column_privilege('authenticated', 'public.user_games', 'label', 'SELECT')
          and has_column_privilege('authenticated', 'public.user_games', 'label', 'UPDATE')
          and has_column_privilege('authenticated', 'public.user_games', 'label_at', 'SELECT')
          and has_column_privilege('authenticated', 'public.user_games', 'label_at', 'UPDATE')) then
    raise exception 'authenticated 에 user_games.label / label_at 의 SELECT · UPDATE 권한이 없습니다(열 단위 GRANT). 되돌립니다.';
  end if;
end $$;

commit;

-- ============================================================
-- ROLLBACK (되돌리기 — 저장된 이름은 열과 함께 사라진다. 클라이언트를 먼저 되돌리지 않으면 이름 바꾸기마다 "클라우드 저장 실패" 알림이 뜬다)
-- ============================================================
-- begin;
-- alter table public.user_games drop column label_at;
-- alter table public.user_games drop column label;
-- commit;
