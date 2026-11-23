-- ============================================================
-- 19_motion_video.sql — 동작 분석 기록의 영상을 기기 사이에 잇기 (로그인한 사람만, 본인 영상만)
--
-- 무엇을 : Storage 버킷 motion-video (비공개). 파일 1개 = 기록 1개의 분석 구간 영상
--          · 원본이 아니라 분석한 몇 초만 짧은 변 720px 로 다시 만든 것(js/motion/cut.js) — 보통 1~3MB
--          · 경로 : <user_id>/<entry_id>.webm|.mp4 — 첫 폴더 이름이 본인 id 인 파일만 읽고 쓴다
--          · 기록 저장 옆 「영상도 다른 기기로 보내기」를 켰을 때만 올린다(기본 켜짐). 기록을 지우면 파일도 지운다
-- 권한 : storage.objects RLS — 로그인한 사람(authenticated)이 이 버킷에서 자기 폴더만. 공개 주소 없음(public = false)
-- 크기 : 파일 하나 10MB · 영상 형식(webm · mp4)만
-- 클라이언트 : js/motion/sync.js · page-sync.js. 버킷이 없으면(이 파일 적용 전) 영상만 안 가고 기록은 그대로 잇는다
-- 적용 : SQL Editor 에서 통째로 1회 실행(한 트랜잭션)
-- 되돌림 : 맨 아래 ROLLBACK 블록(버킷 안 파일은 Storage 화면에서 먼저 비운다)
-- ============================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('motion-video', 'motion-video', false, 10485760, array['video/webm', 'video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists motion_video_select on storage.objects;
drop policy if exists motion_video_insert on storage.objects;
drop policy if exists motion_video_update on storage.objects;
drop policy if exists motion_video_delete on storage.objects;
create policy motion_video_select on storage.objects for select to authenticated
  using (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy motion_video_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy motion_video_update on storage.objects for update to authenticated
  using (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy motion_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'motion-video' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;

-- ── ROLLBACK (필요할 때만, 따로 실행) ─────────────────────────────
-- begin;
-- drop policy if exists motion_video_select on storage.objects;
-- drop policy if exists motion_video_insert on storage.objects;
-- drop policy if exists motion_video_update on storage.objects;
-- drop policy if exists motion_video_delete on storage.objects;
-- delete from storage.buckets where id = 'motion-video';   -- 파일이 남아 있으면 실패한다: Storage 화면에서 먼저 비운다
-- commit;
