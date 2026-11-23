-- ============================================================
-- 18_user_motion.sql — 동작 분석 기록을 기기 사이에 잇기 (로그인한 사람만, 본인 기록만)
--
-- 무엇을 : 동작 분석(motion.html)에서 저장한 기록 1개 = 1행
--          · entry : 목록에 보이는 숫자 기록(종류 · 좌우 · 날짜 · 선수 이름 · 지표 · 흔들림 폭 · 구간). 약 1KB
--          · clip  : 다시 보기용 관절 좌표(Float32 를 base64 로). 분석 하나에 약 0.1MB(12초 · 60fps 면 최대 약 1MB)
--          · 영상은 보내지 않는다(용량 · 얼굴이 나오는 영상). 다른 기기에서는 「영상 다시 고르기」로 잇는다
--          · deleted : 한 기기에서 지우면 내용을 비우고 표시만 남겨 다른 기기에서도 지운다
-- 권한 : RLS — 로그인한 사람(authenticated)이 자기 행(user_id = auth.uid())만 읽고 쓴다. 비로그인(anon)은 표에 손대지 못한다
-- 크기 : entry 32KB · clip 3MB 를 넘는 행은 막는다(check)
-- 클라이언트 : js/motion/sync.js. 표가 없으면(이 파일 적용 전) 동기화만 꺼지고 기기 안 저장은 그대로
-- 적용 : SQL Editor 에서 통째로 1회 실행(한 트랜잭션). 이미 있으면 바꾸지 않는다(create if not exists)
-- 되돌림 : 맨 아래 ROLLBACK 블록(표를 지우면 서버에 올린 동작 기록도 지워진다)
-- ============================================================
begin;

create table if not exists public.user_motion (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id    bigint not null,
  entry       jsonb not null default '{}'::jsonb,
  clip        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  constraint user_motion_one_per_entry unique (user_id, entry_id),
  constraint user_motion_entry_size check (pg_column_size(entry) < 32768),
  constraint user_motion_clip_size check (clip is null or pg_column_size(clip) < 3145728)
);

create index if not exists user_motion_user_updated on public.user_motion (user_id, updated_at desc);

alter table public.user_motion enable row level security;
revoke all on public.user_motion from anon;
grant select, insert, update, delete on public.user_motion to authenticated;

drop policy if exists user_motion_select on public.user_motion;
drop policy if exists user_motion_insert on public.user_motion;
drop policy if exists user_motion_update on public.user_motion;
drop policy if exists user_motion_delete on public.user_motion;
create policy user_motion_select on public.user_motion for select to authenticated using (user_id = (select auth.uid()));
create policy user_motion_insert on public.user_motion for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_motion_update on public.user_motion for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_motion_delete on public.user_motion for delete to authenticated using (user_id = (select auth.uid()));

-- 고칠 때마다 updated_at 을 서버 시각으로
create or replace function public.user_motion_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.user_motion_touch() from public, anon, authenticated;
drop trigger if exists user_motion_touch on public.user_motion;
create trigger user_motion_touch before update on public.user_motion for each row execute function public.user_motion_touch();

commit;

-- ── ROLLBACK (필요할 때만, 따로 실행) ─────────────────────────────
-- begin;
-- drop trigger if exists user_motion_touch on public.user_motion;
-- drop function if exists public.user_motion_touch();
-- drop table if exists public.user_motion;
-- commit;
