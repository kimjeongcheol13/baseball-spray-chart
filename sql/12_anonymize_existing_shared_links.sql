-- ============================================================
-- 12_anonymize_existing_shared_links.sql — 이미 만들어진 공유 링크(shared_links)의 선수 실명을 치환  [초안 · 아직 적용 안 함]
--
-- 배경 : 클라이언트(core.js ?v=147, PR #121)는 이제 새 공유 링크의 선수 이름을 "#등번호" / "성OO" 로 바꿔서 저장한다.
--        그 전에 만든 ?gid= 링크의 payload 는 서버에 실명 그대로 남아 있고, id 를 아는 사람은 누구나 열 수 있다 (get_shared_link, sql/05).
-- 변경 : 기준 시각(cutoff) 이전에 만든 행의 payload 에서 이름 필드만 클라이언트(_anonSharePayload)와 같은 규칙으로 치환한다.
--          hl[].n · al[].n (홈/원정 라인업) · pitchers[].nm · abs[].bn (타석마다 반복되는 타자 이름)
--        id · 등번호 · 타구 좌표 · 결과 등 나머지 필드는 그대로라, 열어 보면 같은 스프레이차트 · 같은 통계가 나온다.
--        규칙: 등번호가 있으면 "#7", 없으면 "김OO". 같은 표기가 겹치면 "#7 원정" · "김OO 홈" · "김OO 2" 로 구분(이름으로 집계해도 선수가 합쳐지지 않게).
-- 안전장치 :
--   · 기본값은 미리보기 — 아무것도 바꾸지 않고, 결과를 예외 메시지(DRY_RUN …)로 보여 주며 전부 롤백된다. apply 를 true 로 바꿔야 적용된다.
--   · cutoff 를 비워 두면 중단. 치환된 클라이언트를 배포한 "이후"에 만든 행(= 이미 치환됐거나, 사용자가 "선수 실명 포함"을 켜고 만든 행)은 건드리지 않는다.
--   · 적용하면 대상 행의 원본을 sl_maint.shared_links_backup 에 먼저 복사한다(이미 있으면 중단 — 두 번 적용 방지).
--     ⚠ 백업 표에는 실명이 그대로 있다: 비공개 스키마 + RLS 켬 + anon/authenticated 권한 회수. 확인이 끝나면 아래 "정리" 블록으로 삭제할 것.
--   · 적용 중 치환 후에도 이전 이름이 남은 행이 하나라도 있으면 예외 → 전부 롤백.
--   · 내용 비출력: 결과에는 개수와 "치환 후" 이름 예시만 나온다(실명 없음). 결과를 그대로 공유해도 된다.
-- 순서 : ① PR #121 머지 · 배포 → ② 이 파일을 미리보기로 실행(cutoff = 배포 시각) → ③ 개수 확인 → ④ apply = true 로 바꿔 실행 → ⑤ 아래 "확인" 쿼리 + 브라우저에서 기존 ?gid= 링크 열기
--        (배포 시각은 GitHub Actions "Deploy to GitHub Pages" 실행 시각. 모르면 더 늦은 시각을 넣는 쪽이 안전하다 — 그 사이에 만든 행은 건드리지 않을 뿐이다)
-- 적용 : SQL Editor 에서 통째로 1회 실행. 한 트랜잭션 · 테이블은 shared_links 만 UPDATE.
-- 알려진 한계 :
--   · Supabase 자체 백업 / PITR 에는 치환 전 데이터가 보존 기간 동안 남는다.
--   · 링크를 이미 열어 「저장」한 사람의 기기(localStorage), 로그인 클라우드(user_games) · 팀 코드 동기화(games)에 저장된 경기는 이 파일의 대상이 아니다.
--   · 배포 후에도 구버전 화면으로 만든 실명 링크는 "실명 포함" 을 켠 링크와 구분할 수 없어 건드리지 않는다.
-- ============================================================
begin;

-- 0) 파라미터 — 여기 두 값만 고친다
create temp table sl_params (apply boolean, cutoff timestamptz) on commit drop;
insert into sl_params values (
  false,   -- apply  : false = 미리보기(변경 없음, 예외로 종료) / true = 적용
  null     -- cutoff : 치환된 클라이언트(core.js ?v=147)를 배포한 시각. 예) '2026-10-13 18:00:00+09'. 이 시각 "이전"에 만든 행만 치환한다
);

-- 1) 가정 확인 — 틀리면 중단
do $$
declare
  v_apply boolean;
  v_cut   timestamptz;
  v_col   text;
begin
  select apply, cutoff into v_apply, v_cut from sl_params;
  if v_cut is null then
    raise exception 'cutoff 가 비어 있습니다. 치환된 클라이언트(core.js ?v=147)를 배포한 시각을 sl_params 에 넣으세요.';
  end if;
  if v_cut > now() then
    raise exception 'cutoff(%) 가 미래입니다. 배포 시각을 확인하세요.', v_cut;
  end if;
  if to_regclass('public.shared_links') is null then
    raise exception 'public.shared_links 가 없습니다.';
  end if;
  foreach v_col in array array['id', 'payload', 'created_at'] loop
    perform 1 from information_schema.columns where table_schema = 'public' and table_name = 'shared_links' and column_name = v_col;
    if not found then raise exception 'shared_links.% 컬럼이 없습니다. 사전 점검(아래 "확인" 쿼리의 컬럼 조회)을 먼저 하세요.', v_col; end if;
  end loop;
  perform 1 from information_schema.columns where table_schema = 'public' and table_name = 'shared_links' and column_name = 'payload' and data_type = 'jsonb';
  if not found then raise exception 'shared_links.payload 가 jsonb 가 아닙니다.'; end if;
  if v_apply and to_regclass('sl_maint.shared_links_backup') is not null then
    raise exception '백업 표 sl_maint.shared_links_backup 이 이미 있습니다. 이미 적용했거나 이전 시도가 남아 있습니다. 내용을 확인한 뒤 "정리" 블록으로 지우고 다시 실행하세요.';
  end if;
end $$;

-- 2) 치환 함수 (이 세션에서만 존재하는 임시 함수 — 스키마에 남지 않는다)
--    클라이언트 js/core.js 의 _hasNum · _anonLabel · _anonSharePayload 와 같은 규칙. 순서도 같다: 홈 라인업 → 원정 라인업 → 투수 → 타석.
-- JS String.prototype.trim 이 지우는 공백(전각 공백 · NBSP 포함)을 같이 지운다
create or replace function pg_temp.sl_trim(t text) returns text language sql immutable as $$
  select regexp_replace(coalesce(t, ''), '^[\s   -     　﻿]+|[\s   -     　﻿]+$', '', 'g')
$$;
-- 등번호가 "있는" 값인가: null · 숫자 0(payload 가 번호 없음 대신 채우는 값) · 빈 문자열은 없음, 문자열 '0' 은 있음
create or replace function pg_temp.sl_has_num(v jsonb) returns boolean language sql immutable as $$
  select case jsonb_typeof(v)
    when 'number' then (v #>> '{}')::numeric <> 0
    when 'string' then pg_temp.sl_trim(v #>> '{}') <> ''
    else false
  end
$$;
-- 배열 arr 의 i 번째 객체에 k = labels['sec:i'] 를 써 넣는다 (객체가 아닌 원소는 그대로)
create or replace function pg_temp.sl_apply(arr jsonb, sec text, k text, labels jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(
           case when jsonb_typeof(e) = 'object' then e || jsonb_build_object(k, labels ->> (sec || ':' || (i - 1))) else e end
           order by i), '[]'::jsonb)
  from jsonb_array_elements(arr) with ordinality as t(e, i)
$$;
create or replace function pg_temp.sl_anon(p jsonb) returns jsonb language plpgsql as $$
declare
  r      record;
  labels jsonb := '{}';   -- 'hl:0' → 치환 표기
  used   jsonb := '{}';   -- '<bat|pit>|표기' → true   (타자 · 투수는 따로 센다)
  map    jsonb := '{}';   -- '<bat|pit>|<선수 키>' → 표기   (같은 선수는 라인업 · 타석 어디서든 같은 표기)
  v_name text; v_num jsonb; v_id text; v_key text; v_base text; v_l text; v_n int;
begin
  if jsonb_typeof(p) is distinct from 'object' then return p; end if;
  for r in
    select * from (
      select 1 as ord, 'hl' as sec, 'bat' as kind, 'home' as team, 'n' as nk, 'no' as ok_, 'id' as ik, e, i
        from jsonb_array_elements(case when jsonb_typeof(p -> 'hl') = 'array' then p -> 'hl' else '[]'::jsonb end) with ordinality as t(e, i)
      union all
      select 2, 'al', 'bat', 'away', 'n', 'no', 'id', e, i
        from jsonb_array_elements(case when jsonb_typeof(p -> 'al') = 'array' then p -> 'al' else '[]'::jsonb end) with ordinality as t(e, i)
      union all
      select 3, 'pitchers', 'pit', null, 'nm', 'no', 'id', e, i
        from jsonb_array_elements(case when jsonb_typeof(p -> 'pitchers') = 'array' then p -> 'pitchers' else '[]'::jsonb end) with ordinality as t(e, i)
      union all
      select 4, 'abs', 'bat', e ->> 't', 'bn', 'bno', 'bid', e, i
        from jsonb_array_elements(case when jsonb_typeof(p -> 'abs') = 'array' then p -> 'abs' else '[]'::jsonb end) with ordinality as t(e, i)
    ) x
    where jsonb_typeof(e) = 'object'
    order by ord, i
  loop
    v_name := pg_temp.sl_trim(r.e ->> r.nk);
    v_num  := r.e -> r.ok_;
    v_id   := r.e ->> r.ik;
    v_key  := r.kind || '|' || case
                when v_id is not null and v_id <> '-1' then 'i' || v_id
                else 'n' || coalesce(r.team, '') || '|' || coalesce(r.e ->> r.nk, '') || '|'
                     || case when pg_temp.sl_has_num(v_num) then pg_temp.sl_trim(v_num #>> '{}') else '' end
              end;
    if (map ->> v_key) is not null then
      v_l := map ->> v_key;
    else
      v_base := case when pg_temp.sl_has_num(v_num) then '#' || pg_temp.sl_trim(v_num #>> '{}')
                     when v_name <> '' then left(v_name, 1) || 'OO'
                     else '선수' end;
      v_l := v_base;
      if (used ->> (r.kind || '|' || v_l)) is not null then
        v_l := v_base || case r.team when 'away' then ' 원정' when 'home' then ' 홈' else '' end;
      end if;
      v_n := 2;
      while (used ->> (r.kind || '|' || v_l)) is not null loop
        v_l := v_base || ' ' || v_n;
        v_n := v_n + 1;
      end loop;
      used := used || jsonb_build_object(r.kind || '|' || v_l, true);
      map  := map  || jsonb_build_object(v_key, v_l);
    end if;
    labels := labels || jsonb_build_object(r.sec || ':' || (r.i - 1), v_l);
  end loop;
  return p
    || case when jsonb_typeof(p -> 'hl')       = 'array' then jsonb_build_object('hl',       pg_temp.sl_apply(p -> 'hl',       'hl',       'n',  labels)) else '{}'::jsonb end
    || case when jsonb_typeof(p -> 'al')       = 'array' then jsonb_build_object('al',       pg_temp.sl_apply(p -> 'al',       'al',       'n',  labels)) else '{}'::jsonb end
    || case when jsonb_typeof(p -> 'pitchers') = 'array' then jsonb_build_object('pitchers', pg_temp.sl_apply(p -> 'pitchers', 'pitchers', 'nm', labels)) else '{}'::jsonb end
    || case when jsonb_typeof(p -> 'abs')      = 'array' then jsonb_build_object('abs',      pg_temp.sl_apply(p -> 'abs',      'abs',      'bn', labels)) else '{}'::jsonb end;
end $$;
-- payload 안의 모든 선수 이름(이름 필드 값)
create or replace function pg_temp.sl_names(j jsonb) returns setof text language sql immutable as $$
  select e ->> 'n'  from jsonb_array_elements(case when jsonb_typeof(j -> 'hl')       = 'array' then j -> 'hl'       else '[]'::jsonb end) e where jsonb_typeof(e) = 'object'
  union all
  select e ->> 'n'  from jsonb_array_elements(case when jsonb_typeof(j -> 'al')       = 'array' then j -> 'al'       else '[]'::jsonb end) e where jsonb_typeof(e) = 'object'
  union all
  select e ->> 'nm' from jsonb_array_elements(case when jsonb_typeof(j -> 'pitchers') = 'array' then j -> 'pitchers' else '[]'::jsonb end) e where jsonb_typeof(e) = 'object'
  union all
  select e ->> 'bn' from jsonb_array_elements(case when jsonb_typeof(j -> 'abs')      = 'array' then j -> 'abs'      else '[]'::jsonb end) e where jsonb_typeof(e) = 'object'
$$;
-- 치환 후에도 남은 이전 이름의 수: 이름 필드에 그대로 있거나, 3글자 이상 이름이 payload 어디에든 문자열로 들어 있으면 센다
create or replace function pg_temp.sl_leaks(o jsonb, n jsonb) returns int language sql immutable as $$
  select count(*)::int
  from (select distinct nm from pg_temp.sl_names(o) as t(nm) where pg_temp.sl_trim(nm) <> '') olds
  where nm in (select x from pg_temp.sl_names(n) as t(x) where x is not null)
     or (char_length(nm) >= 3 and strpos(n::text, nm) > 0)
$$;

-- 3) 치환 (미리보기 또는 적용)
do $$
declare
  v_apply boolean;
  v_cut   timestamptz;
  r       record;
  v_new   jsonb;
  v_total int := 0; v_changed int := 0; v_same int := 0; v_skip int := 0; v_leaks int := 0;
  v_nots  int;
  v_ex    text := '';
begin
  select apply, cutoff into v_apply, v_cut from sl_params;
  select count(*) into v_nots from public.shared_links where created_at is null;

  if v_apply then
    create schema if not exists sl_maint;
    revoke all on schema sl_maint from public, anon, authenticated;
    create table sl_maint.shared_links_backup as select * from public.shared_links where created_at < v_cut;
    alter table sl_maint.shared_links_backup enable row level security;   -- 정책 없음 = 전면 차단
    revoke all on sl_maint.shared_links_backup from public, anon, authenticated;
  end if;

  for r in select id, payload from public.shared_links where created_at < v_cut order by created_at, id loop
    v_total := v_total + 1;
    if jsonb_typeof(r.payload) is distinct from 'object' or jsonb_typeof(r.payload -> 'abs') is distinct from 'array' then
      v_skip := v_skip + 1;   -- 앱이 만든 경기 payload 모양이 아니다 — 건드리지 않는다
      continue;
    end if;
    v_new := pg_temp.sl_anon(r.payload);
    if v_new = r.payload then
      v_same := v_same + 1;
      continue;
    end if;
    v_changed := v_changed + 1;
    v_leaks := v_leaks + pg_temp.sl_leaks(r.payload, v_new);
    if v_changed <= 3 then
      v_ex := v_ex || ' [' || coalesce((select string_agg(e ->> 'n', ', ') from (select e from jsonb_array_elements(v_new -> 'hl') e limit 4) s), '-') || ']';
    end if;
    if v_apply then
      update public.shared_links set payload = v_new where id = r.id;
    end if;
  end loop;

  if v_leaks > 0 then
    raise exception '치환 후에도 이전 이름이 남은 항목이 %건 있습니다 — 중단(전부 롤백). 대상 %행 중 치환 %행.', v_leaks, v_total, v_changed;
  end if;

  if not v_apply then
    raise exception 'DRY_RUN — 변경 없음(전부 롤백). 기준 시각 % 이전 행 %개 → 치환 대상 %, 이미 같음 %, 형식이 달라 건너뜀 %, 이름 잔존 %. created_at 이 비어 대상 판별 불가: %행. 치환 후 홈 라인업 예시(앞 3행):%',
      v_cut, v_total, v_changed, v_same, v_skip, v_leaks, v_nots, v_ex;
  end if;
  raise notice 'APPLIED — 기준 시각 % 이전 행 %개 중 %행 치환 (이미 같음 %, 건너뜀 %). 백업: sl_maint.shared_links_backup', v_cut, v_total, v_changed, v_same, v_skip;
end $$;

commit;

-- ============================================================
-- 확인 (적용 후 · 읽기 전용 · 별도로 실행)
-- ============================================================
-- (사전 점검) shared_links 컬럼 — id / payload(jsonb) / created_at 이 있어야 한다
--   select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'shared_links' order by ordinal_position;
-- (사전 점검) 기준 시각 전후 행 수
--   select count(*) filter (where created_at <  '2026-10-13 18:00:00+09') as before_cutoff, count(*) filter (where created_at >= '2026-10-13 18:00:00+09') as after_cutoff, count(*) filter (where created_at is null) as no_ts from public.shared_links;
-- (적용 후) 백업과 비교: 행 수가 같고, 바뀐 행이 몇 개인지
--   select (select count(*) from sl_maint.shared_links_backup) as backup_rows,
--          (select count(*) from public.shared_links s join sl_maint.shared_links_backup b using (id) where s.payload is distinct from b.payload) as changed_rows;
-- (적용 후) 백업의 이름이 지금 payload 에 남아 있는 행 — 0 이어야 한다
--   select count(*) as leaked_rows from public.shared_links s join sl_maint.shared_links_backup b using (id)
--   where exists (select 1 from jsonb_array_elements(b.payload -> 'hl') e where char_length(e ->> 'n') >= 3 and strpos(s.payload::text, e ->> 'n') > 0);
-- (적용 후) 브라우저: 기존 ?gid= 링크 하나를 열어 이름이 "#7" / "김OO" 로 보이고 스프레이차트 · 통계가 이전과 같은지 확인

-- ============================================================
-- ROLLBACK (적용 직후 문제가 있을 때만 — 백업 표로 payload 를 원래대로 되돌린다. 실명이 다시 노출되므로 신중히)
-- ============================================================
-- begin;
-- update public.shared_links s set payload = b.payload from sl_maint.shared_links_backup b where b.id = s.id;
-- commit;

-- ============================================================
-- 정리 (확인이 끝난 뒤 — 백업 표에는 실명이 있으므로 오래 두지 않는다)
-- ============================================================
-- drop table sl_maint.shared_links_backup;
-- drop schema sl_maint;
