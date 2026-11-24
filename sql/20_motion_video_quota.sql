-- ============================================================
-- 20_motion_video_quota.sql — 동작 분석 영상: 한 사람당 저장 한도 (영상 100개 · 합계 100MB)
--
-- 왜   : 무료 플랜의 파일 저장 공간(1GB)은 모든 사용자가 함께 쓴다. 한 사람이 많이 올리면 다른 사람이 영상을 못 올린다
--        (유료로 바꿔도 공간이 커질 뿐 같은 문제가 남는다 — 지출 상한을 켜면 전원이 막히고, 끄면 요금이 는다)
-- 무엇을 : public.motion_video_room() — 로그인한 본인 폴더의 영상이 100개 미만 · 합계 100MB 미만이면 true
--          motion_video_insert 정책(19)에 이 판정을 더한다. 읽기 · 지우기는 그대로(한도가 찼어도 지워서 비울 수 있게)
--          새 파일 하나는 클라이언트가 8MB 이하로 만든다(js/motion/cut.js) → 한 사람 최대 약 108MB
-- 왜 함수로 : 정책 안에서 같은 표(storage.objects)를 서브쿼리로 읽지 않는다(sql/README 규칙) — security definer 로 RLS 를 건너뛰어 센다
-- 클라이언트 : js/motion/sync.js VIDEO_QUOTA(같은 숫자) — 올리기 전에 사용량을 보고, 찼으면 보내지 않고 안내한다
-- 선행 : 19 · 적용 : SQL Editor 에서 통째로 1회 실행 · 되돌림 : 맨 아래 ROLLBACK 블록
-- ============================================================
begin;

create or replace function public.motion_video_room() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) < 100 and coalesce(sum((o.metadata->>'size')::bigint), 0) < 100000000
  from storage.objects o
  where o.bucket_id = 'motion-video' and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke execute on function public.motion_video_room() from public, anon;
grant execute on function public.motion_video_room() to authenticated;

alter policy motion_video_insert on storage.objects
  with check (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.motion_video_room()));

commit;

-- ── ROLLBACK (필요할 때만, 따로 실행) ─────────────────────────────
-- begin;
-- alter policy motion_video_insert on storage.objects
--   with check (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- drop function if exists public.motion_video_room();
-- commit;
