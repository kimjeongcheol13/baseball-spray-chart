-- ============================================================
-- 05_public_policies_phase1_additive.sql — [Phase 1] 공개 정책을 닫기 위한 "추가만" 하는 준비 단계
--
-- 배경 (01 진단 결과): 아래 3개 테이블은 anon 키만 있으면 누구나 읽고/쓰고/지울 수 있다.
--   games         : pub_r/pub_i/pub_u/pub_d 전부 true  → 팀 코드는 클라이언트 필터일 뿐, 다른 팀 경기도 열람·삭제 가능
--   feedback      : allow_select = true                → 사용자가 보낸 피드백(텍스트 · UA)이 공개 열람됨 (클라이언트는 insert 만 함)
--   shared_links  : public_read = true                 → 링크 id 를 몰라도 전체 payload 목록 열람 가능 (클라이언트는 id 1건만 읽음)
--
-- 방침 (정적 호스팅 + 비로그인 팀 코드 공유 유지):
--   games        : "헤더 방식 RLS". 클라이언트가 x-team-code 헤더(= base64url(UTF-8 팀 코드))를 보내고,
--                  정책이 team_code = 그 값 일 때만 허용 (코드 모르면 접근 불가, 코드 알면 기존과 동일하게 사용)
--   feedback     : 읽기 정책 삭제 (insert 는 그대로)
--   shared_links : id 로 1건 조회하는 RPC(get_shared_link) + 읽기 정책 삭제
--
-- 순서 (반드시 이 순서):
--   Phase 1  이 파일(05)      — 함수 2개만 추가. 기존 동작은 전혀 바뀌지 않는다 (클라이언트 배포 전에 적용해도 안전)
--   Phase 2  클라이언트 배포   — core.js ?v=122 (x-team-code 헤더 전송 + 공유 링크 RPC 조회)
--   Phase 3  06_..._close.sql — 정책 변경 (06b 로 검증)
--
-- 적용 : SQL Editor 에 통째로 붙여 1회 실행.
-- 되돌림: 파일 맨 아래 ROLLBACK 블록.
-- ============================================================
begin;

-- 1) request_team_code(): 요청 헤더 x-team-code 를 팀 코드 문자열로 복원
--    · 헤더 값은 base64url(UTF-8). 팀 코드에 한글 등이 있어도 HTTP 헤더(ASCII)로 안전하게 보내기 위함
--      (운영의 기존 팀 코드 10행이 전부 비ASCII 문자를 포함한다 — 날것으로 보내면 브라우저 fetch 가 예외를 던진다)
--    · 헤더가 없거나 형식이 깨졌으면 NULL → 정책이 "team_code = NULL" 이 되어 접근 거부 (fail-closed, 오류도 내지 않음)
--    · security invoker: 요청 GUC 만 읽는다. 정책이 anon 도 평가하므로 anon 실행 권한이 필요하다.
create or replace function public.request_team_code()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  h text;
  b text;
begin
  h := nullif(current_setting('request.headers', true), '')::json ->> 'x-team-code';
  if h is null or h = '' then
    return null;
  end if;
  b := translate(h, '-_', '+/');
  b := b || repeat('=', (4 - length(b) % 4) % 4);
  return convert_from(decode(b, 'base64'), 'UTF8');
exception when others then
  return null;
end;
$$;

revoke all on function public.request_team_code() from public;
grant execute on function public.request_team_code() to anon, authenticated, service_role;

-- 2) get_shared_link(id): 공유 링크 payload 를 id 정확히 일치로 1건만 반환 (없으면 NULL)
--    security definer: shared_links 읽기 정책(public_read)을 닫은 뒤에도 id 를 아는 사람은 열 수 있어야 한다
--    목록 · 부분 일치 · 다른 컬럼 노출 없음.
create or replace function public.get_shared_link(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.payload from public.shared_links s where s.id = p_id limit 1;
$$;

revoke all on function public.get_shared_link(text) from public;
grant execute on function public.get_shared_link(text) to anon, authenticated, service_role;

commit;

-- ============================================================
-- ROLLBACK (Phase 3 를 적용했다면 먼저 06 의 ROLLBACK 을 실행한 뒤에만 — 정책이 이 함수를 참조한다)
-- ============================================================
-- drop function public.get_shared_link(text);
-- drop function public.request_team_code();
