-- ============================================================
-- 03_verify_team_rls.sql — 적용 후 검증: 팀 소유자 / 팀원 / 비팀원 / 비로그인
-- SQL Editor 에 통째로 붙여 실행 → 결과표 1개 (outcome 열에 ERROR 42P17 이 하나라도 있으면 아직 재귀)
--
-- 안전성: 쓰기 시험은 전부 서브트랜잭션 안에서 실행한 뒤 일부러 예외를 던져 취소한다 (데이터 변경 없음).
--         임시 표(pg_temp)만 만든다. 실제 팀 1개를 자동 선택해 그 팀 기준으로 본다.
-- 읽는 법:
--   expect 가 있는 행(teams / team_members 읽기)은 "SQL 수정 전에 사용자가 확인한 두 정책"이 의도한 값이다.
--   expect 가 '-' 인 행(user_games, 쓰기)은 서비스 정책에 따라 다르므로 actual 을 눈으로 확인한다.
--   'read teams by code' 의 outsider 행이 MISMATCH(0) 면: 앱의 "코드로 참가"가 팀을 찾지 못한다는 뜻이다.
--     (teams_select 가 소유자/팀원만 허용하는 정책이면 정상적으로 그렇게 된다 — 다른 SELECT 정책이 따로 있는지 확인 필요)
-- 전제: 팀이 1개 이상 있어야 한다 (팀 만들기 한 번 해두고 실행).
-- ============================================================
create temp table if not exists _rls_verify (
  n serial, persona text, test text, expect text, actual text, outcome text
);
truncate _rls_verify;

do $$
declare
  tid uuid; tcode text; own uuid; mem uuid; oth uuid; outsider uuid := gen_random_uuid();
  n_members int;
  p text; uid uuid; r text; cnt int; ex text; code text;
  items text[][] := array[
    ['teams',         'select count(*) from public.teams where id = %1$L'],
    ['team_members',  'select count(*) from public.team_members where team_id = %1$L'],
    ['user_games',    'select count(*) from public.user_games where team_id = %1$L'],
    -- 앱의 joinTeam() 은 가입 전(=비팀원) 사용자가 팀 코드로 팀을 조회할 수 있어야 동작한다
    ['teams by code', 'select count(*) from public.teams where code = %2$L']
  ];
  it text[];
begin
  -- 팀 선택: 팀원이 있는 팀 우선
  select t.id, t.owner_id, t.code into tid, own, tcode
  from public.teams t
  order by (exists (select 1 from public.team_members m where m.team_id = t.id)) desc, t.created_at
  limit 1;
  if tid is null then raise exception '팀이 하나도 없어 검증할 수 없습니다. 앱에서 팀을 먼저 만들어 주세요.'; end if;

  select m.user_id into mem from public.team_members m where m.team_id = tid limit 1;
  select count(*) into n_members from public.team_members where team_id = tid;
  -- 쓰기 시험용 "다른 실제 사용자" (FK 때문에 auth.users 에 있어야 함). 없으면 쓰기 시험은 건너뜀
  select u.id into oth from auth.users u
  where u.id <> own and u.id is distinct from mem limit 1;

  -- persona 별 읽기 시험 ---------------------------------------------------
  foreach p in array array['owner','member','outsider','anon'] loop
    if p = 'member' and mem is null then
      insert into _rls_verify(persona,test,expect,actual,outcome) values ('member','(건너뜀)','-','팀원이 없는 팀','SKIPPED');
      continue;
    end if;
    uid := case p when 'owner' then own when 'member' then mem when 'outsider' then outsider else null end;

    execute format('set local role %s', case when p = 'anon' then 'anon' else 'authenticated' end);
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);

    foreach it slice 1 in array items loop
      ex := case
        when it[1] = 'teams'        then case p when 'owner' then '1' when 'member' then '1' else '0' end
        when it[1] = 'team_members' then case p when 'owner' then n_members::text when 'member' then '1' else '0' end
        when it[1] = 'teams by code' then case p when 'anon' then '0' else '1' end   -- 비팀원도 1 이어야 가입 가능
        else '-' end;
      begin
        execute format(it[2], tid, tcode) into cnt;
        r := cnt::text; code := 'OK';
      exception when others then
        r := sqlerrm; code := 'ERROR ' || sqlstate;
      end;
      reset role;
      insert into _rls_verify(persona,test,expect,actual,outcome)
      values (p, 'read ' || it[1], ex, r,
              case when code <> 'OK' then code when ex = '-' then 'OK (확인)' when ex = r then 'OK' else 'MISMATCH' end);
      execute format('set local role %s', case when p = 'anon' then 'anon' else 'authenticated' end);
    end loop;
    reset role;
  end loop;

  -- 쓰기 시험 (실제로 반영되지 않음: 각 시험 끝에서 예외로 취소) --------------------
  if oth is null then
    insert into _rls_verify(persona,test,expect,actual,outcome) values ('outsider','write 시험들','-','auth.users 에 다른 사용자가 없어 건너뜀','SKIPPED');
  else
    -- (persona, 설명, 실행 SQL)
    declare
      w text[]; ws text[][] := array[
        ['outsider','team_members 에 나 자신을 추가(가입)',    format('insert into public.team_members(team_id,user_id) values (%L,%L)', tid, oth)],
        ['outsider','남의 team_members 삭제(타인 강퇴 시도)',   format('delete from public.team_members where team_id=%L', tid)],
        ['outsider','팀 이름 수정 시도',                      format('update public.teams set name=name where id=%L', tid)],
        ['outsider','팀 삭제 시도',                           format('delete from public.teams where id=%L', tid)],
        ['outsider','남의 team_id 를 달아 내 경기 upsert',     format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,%L,%L,%L) on conflict (user_id,game_key) do update set data=excluded.data', oth, '__verify_probe__', tid, '{}')],
        ['outsider','team_id 없이 내 경기 upsert',            format('insert into public.user_games(user_id,game_key,data) values (%L,%L,%L) on conflict (user_id,game_key) do update set data=excluded.data', oth, '__verify_probe2__', '{}')],
        ['owner',   '내 팀 이름 수정',                        format('update public.teams set name=name where id=%L', tid)],
        ['owner',   'team_members 삭제(팀원 정리)',            format('delete from public.team_members where team_id=%L', tid)],
        ['owner',   '내 경기 upsert (team_id 포함)',           format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,%L,%L,%L) on conflict (user_id,game_key) do update set data=excluded.data', own, '__verify_probe__', tid, '{}')],
        ['member',  '내 경기 upsert (team_id 포함)',           format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,%L,%L,%L) on conflict (user_id,game_key) do update set data=excluded.data', mem, '__verify_probe__', tid, '{}')],
        ['member',  '팀 탈퇴(내 team_members 삭제)',           format('delete from public.team_members where team_id=%L and user_id=%L', tid, mem)],
        ['member',  '팀 이름 수정 시도',                      format('update public.teams set name=name where id=%L', tid)]
      ];
    begin
      foreach w slice 1 in array ws loop
        continue when w[1] = 'member' and mem is null;
        uid := case w[1] when 'owner' then own when 'member' then mem else oth end;
        begin
          execute 'set local role authenticated';
          perform set_config('request.jwt.claim.sub', uid::text, true);
          perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
          execute w[3];
          get diagnostics cnt = row_count;
          r := cnt || '행 처리'; code := 'OK';
          raise exception using errcode = 'P0001', message = 'probe_rollback';   -- 취소
        exception
          when sqlstate 'P0001' then null;     -- 정상 취소 (r, code 는 위에서 기록됨)
          when others then
            r := sqlerrm; code := 'ERROR ' || sqlstate;
            -- 42501 = RLS 가 막음 → 의도한 "거부". 23xxx = RLS 는 통과했고 제약에서 걸림(허용으로 간주)
        end;
        reset role;
        insert into _rls_verify(persona,test,expect,actual,outcome) values (
          w[1], 'write: ' || w[2], '-', r,
          case when code = 'ERROR 42501'      then 'DENIED (RLS)'
               when code like 'ERROR 23%'     then 'ALLOWED (RLS 통과, 제약에서 중단)'
               when code like 'ERROR 42P17'   then 'ERROR 42P17 재귀!'
               when code <> 'OK'              then code
               when cnt = 0                   then 'NO-OP (0행: RLS 가 대상 행을 숨김)'
               else 'ALLOWED' end);
      end loop;
    end;
  end if;
  reset role;
end $$;

select n, persona, test, expect, actual, outcome from _rls_verify order by n;
