-- ============================================================
-- 03b_verify_team_rls_fixture.sql — 임시 픽스처로 하는 권한 검증 (팀 · 사용자가 없어도 실행 가능)
--
-- 03 은 실제 팀을 골라 쓰므로 팀이 하나도 없으면 돌릴 수 없다. 이 파일은 가짜 사용자 4명 · 팀 2개 ·
-- 경기 4건을 만들어 소유자 / 팀원 / 비팀원 / 다른 팀 소유자 / 비로그인으로 시험한다.
--
-- 안전성: 전체가 하나의 DO 블록(= 한 문장 = 한 트랜잭션)이고, 맨 끝에서 결과를 담아 일부러 예외를
--         던진다 → 만든 데이터와 시험 중 쓰기가 전부 롤백된다. 실행하면 "VERIFY_RESULT …" 오류가
--         나오는 것이 정상이며, 그 메시지가 결과표다. (FK 때문에 auth.users 에도 가짜 행을 넣었다가 같이 취소됨)
-- 읽는 법: expect 가 '-' 이면 "지금 정책이 허용/거부하는 값을 눈으로 확인"하는 항목이다.
--   'teams by code' 는 앱의 "코드로 참가"가 요구하는 값(1)과 비교한다.
-- ============================================================
do $$
declare
  uo uuid := gen_random_uuid(); um uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid();
  lines text[] := array[]::text[];
  pr record; uid uuid; cnt int; r text; code text; oc text;
  -- (persona, kind, label, sql, expect)   kind: read | write
  probes text[][];
begin
  insert into auth.users(id) values (uo), (um), (uc), (ud);
  insert into public.teams(id, code, name, owner_id) values (t1, 'ZZVER1', 'verify-team', uo), (t2, 'ZZVER2', 'verify-other', ud);
  insert into public.team_members(team_id, user_id) values (t1, um);
  insert into public.user_games(user_id, game_key, team_id, data) values
    (uo, 'v_owner', t1, '{}'), (um, 'v_member', t1, '{}'), (uc, 'v_out', null, '{}'), (ud, 'v_other', t2, '{}');

  probes := array[
    -- ── 읽기 ────────────────────────────────────────────
    ['owner','read','teams',                 'select count(*) from public.teams where code like ''ZZVER%''', '1'],
    ['member','read','teams',                'select count(*) from public.teams where code like ''ZZVER%''', '1'],
    ['outsider','read','teams',              'select count(*) from public.teams where code like ''ZZVER%''', '0'],
    ['other','read','teams',                 'select count(*) from public.teams where code like ''ZZVER%''', '1'],
    ['anon','read','teams',                  'select count(*) from public.teams where code like ''ZZVER%''', '0'],
    ['owner','read','team_members',          format('select count(*) from public.team_members where team_id in (%L,%L)', t1, t2), '1'],
    ['member','read','team_members',         format('select count(*) from public.team_members where team_id in (%L,%L)', t1, t2), '1'],
    ['outsider','read','team_members',       format('select count(*) from public.team_members where team_id in (%L,%L)', t1, t2), '0'],
    ['other','read','team_members',          format('select count(*) from public.team_members where team_id in (%L,%L)', t1, t2), '0'],
    ['anon','read','team_members',           format('select count(*) from public.team_members where team_id in (%L,%L)', t1, t2), '0'],
    ['owner','read','user_games (v_*)',      'select count(*) from public.user_games where game_key like ''v\_%''', '-'],
    ['member','read','user_games (v_*)',     'select count(*) from public.user_games where game_key like ''v\_%''', '-'],
    ['outsider','read','user_games (v_*)',   'select count(*) from public.user_games where game_key like ''v\_%''', '-'],
    ['other','read','user_games (v_*)',      'select count(*) from public.user_games where game_key like ''v\_%''', '-'],
    ['anon','read','user_games (v_*)',       'select count(*) from public.user_games where game_key like ''v\_%''', '0'],
    -- 앱 joinTeam(): 가입 전 사용자가 코드로 팀을 찾아야 한다
    ['outsider','read','teams BY CODE (가입)', 'select count(*) from public.teams where code = ''ZZVER1''', '1'],
    ['other','read','teams BY CODE (가입)',    'select count(*) from public.teams where code = ''ZZVER1''', '1'],
    -- ── 쓰기 (시험마다 취소) ─────────────────────────────
    ['owner','write','내 경기 upsert (team_id 포함)',   format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,''v_owner'',%L,''{"n":1}'') on conflict (user_id,game_key) do update set data = excluded.data', uo, t1), '1'],
    ['member','write','내 경기 upsert (team_id 포함)',  format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,''v_member'',%L,''{"n":1}'') on conflict (user_id,game_key) do update set data = excluded.data', um, t1), '1'],
    ['outsider','write','내 경기 upsert (team_id 없음)', format('insert into public.user_games(user_id,game_key,data) values (%L,''v_out'',''{"n":1}'') on conflict (user_id,game_key) do update set data = excluded.data', uc), '1'],
    ['anon','write','경기 insert',                      format('insert into public.user_games(user_id,game_key,data) values (%L,''v_anon'',''{}'')', uc), 'DENIED'],
    ['owner','write','내 팀 이름 수정',                 format('update public.teams set name = ''x'' where id = %L', t1), '1'],
    ['member','write','팀 이름 수정 시도',              format('update public.teams set name = ''x'' where id = %L', t1), '0'],
    ['outsider','write','팀 이름 수정 시도',            format('update public.teams set name = ''x'' where id = %L', t1), '0'],
    ['outsider','write','팀 삭제 시도',                 format('delete from public.teams where id = %L', t1), '0'],
    ['owner','write','팀 해산(teams 삭제)',             format('delete from public.teams where id = %L', t1), '1'],
    ['owner','write','팀원 내보내기(team_members 삭제)', format('delete from public.team_members where team_id = %L', t1), '1'],
    ['member','write','팀 탈퇴(내 team_members 삭제)',   format('delete from public.team_members where team_id = %L and user_id = %L', t1, um), '1'],
    ['outsider','write','남의 team_members 삭제 시도',   format('delete from public.team_members where team_id = %L', t1), '0'],
    ['outsider','write','team_members 에 나를 추가(가입)', format('insert into public.team_members(team_id,user_id) values (%L,%L)', t1, uc), '-'],
    ['outsider','write','남의 team_id 를 단 내 경기 insert', format('insert into public.user_games(user_id,game_key,team_id,data) values (%L,''v_inj'',%L,''{}'')', uc, t1), '-'],
    ['outsider','write','팀 경기 수정 시도(data)',       'update public.user_games set data = ''{"x":1}'' where game_key = ''v_owner''', '0'],
    ['member','write','팀원 경기 수정(data)',            'update public.user_games set data = ''{"x":1}'' where game_key = ''v_owner''', '-'],
    ['member','write','팀원 경기의 user_id 를 내 것으로 변경', format('update public.user_games set user_id = %L where game_key = ''v_owner''', um), '-'],
    ['owner','write','팀원 경기 수정(data)',             'update public.user_games set data = ''{"x":1}'' where game_key = ''v_member''', '-']
  ];

  for i in 1 .. array_length(probes, 1) loop
    uid := case probes[i][1] when 'owner' then uo when 'member' then um when 'outsider' then uc when 'other' then ud else null end;
    execute format('set local role %s', case when probes[i][1] = 'anon' then 'anon' else 'authenticated' end);
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
    r := null; code := 'OK'; cnt := null;
    begin
      if probes[i][2] = 'read' then
        execute probes[i][4] into cnt;
        r := cnt::text;
      else
        execute probes[i][4];
        get diagnostics cnt = row_count;
        r := cnt::text;
        raise exception using errcode = 'P0001', message = 'probe_rollback';   -- 시험 쓰기 취소
      end if;
    exception
      when sqlstate 'P0001' then null;   -- 정상 취소
      when others then r := sqlerrm; code := 'ERROR ' || sqlstate;
    end;
    reset role;
    oc := case
      when code = 'ERROR 42P17'                      then '*** 재귀(42P17) ***'
      when code = 'ERROR 42501'                      then case when probes[i][5] = 'DENIED' then 'OK' else 'DENIED(RLS)' end
      when code like 'ERROR 23%'                     then 'ALLOWED(RLS 통과, 제약에서 중단)'
      when code <> 'OK'                              then code
      when probes[i][5] = '-'                        then 'INFO'
      when probes[i][5] = r                          then 'OK'
      else 'MISMATCH'
    end;
    lines := lines || format('%-8s %-5s %-34s expect=%-6s actual=%-4s %s', probes[i][1], probes[i][2], probes[i][3], probes[i][5], left(coalesce(r, ''), 40), oc);
  end loop;

  raise exception E'VERIFY_RESULT (전부 롤백됨 — 데이터 변경 없음)\n%', array_to_string(lines, E'\n');
end $$;
