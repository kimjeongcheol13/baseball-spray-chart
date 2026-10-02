-- ============================================================
-- 06b_verify_public_policies_closed.sql — Phase 3(06) 적용 후 검증 (전부 롤백, 팀 코드·내용은 출력하지 않음)
--
-- 하는 일: games 에 실제로 들어 있는 "기존 팀 코드"를 읽어, 앱이 보내는 것과 같은 헤더(base64url(UTF-8))를 만들어
--          anon / authenticated 역할로 시험한다. 시험 쓰기와 임시 행은 마지막에 예외를 던져 전부 취소된다
--          (실행하면 "VERIFY_RESULT …" 오류가 나오는 것이 정상이며, 그 메시지가 결과표다).
-- 기대값: 06 적용 후 전부 OK. (06 적용 전에 돌리면 "헤더 없음 → 0" 같은 항목이 MISMATCH 로 나온다 = 아직 열려 있다는 뜻)
-- 읽는 법: 올바른 헤더 = 기존 팀 코드 그대로(= 지금 쓰는 사용자가 계속 접근 가능해야 하는 경우)
-- ============================================================
do $$
declare
  v_code text; v_link text;
  n_games int; n_fb int; n_sl int;
  h_ok text; h_other text;
  lines text[] := array[]::text[];
  probes text[][];
  i int; role_ text; hk text; kind text; r text; ecode text; oc text; cnt int;
begin
  select team_code into v_code from public.games order by id limit 1;
  if v_code is null then raise exception 'games 에 행이 없어 기존 팀 코드 시험을 할 수 없습니다.'; end if;
  select count(*) into n_games from public.games where team_code = v_code;
  select count(*) into n_fb from public.feedback;
  select count(*) into n_sl from public.shared_links;
  select id into v_link from public.shared_links order by created_at limit 1;

  h_ok    := rtrim(translate(replace(encode(convert_to(v_code, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  h_other := rtrim(translate(replace(encode(convert_to('zz-다른팀-zz', 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');

  -- 임시 시험 행 (postgres 로 만들고, 전부 롤백됨)
  insert into public.games(team_code, game_key, game_data) values (v_code, '__v_probe__', '{}');
  insert into public.shared_links(id, payload) values ('__v_probe__', '{"p":1}');

  -- (설명, 역할, 헤더종류[ok|other|none|broken], r|w, SQL, 기대값)
  probes := array[
    ['[games] 기존 코드(올바른 헤더) 전체 조회 = cloudSync/cloudTest', 'anon', 'ok', 'r', 'select count(*)::text from public.games', (n_games + 1)::text],
    ['[games] 기존 코드, 로그인 사용자(authenticated)도 동일',       'authenticated', 'ok', 'r', 'select count(*)::text from public.games', (n_games + 1)::text],
    ['[games] 헤더 없음 → 아무것도 안 보임',                          'anon', 'none',   'r', 'select count(*)::text from public.games', '0'],
    ['[games] 다른 팀 코드 헤더 → 안 보임',                           'anon', 'other',  'r', 'select count(*)::text from public.games', '0'],
    ['[games] 깨진 헤더(base64 아님) → 안 보임, 오류 없음',           'anon', 'broken', 'r', 'select count(*)::text from public.games', '0'],
    ['[games] 올바른 헤더로도 다른 팀 행은 안 보임',                  'anon', 'ok', 'r', format('select count(*)::text from public.games where team_code <> %L', v_code), '0'],
    ['[games] 올바른 헤더 upsert(새 키) = cloudSave/UploadAll',        'anon', 'ok', 'w', format('insert into public.games(team_code,game_key,game_data,label,ts) values (%L,''__v_new__'',''{"a":1}'',''x'',1) on conflict (team_code,game_key) do update set game_data = excluded.game_data', v_code), 'ROWS:1'],
    ['[games] 올바른 헤더 upsert(기존 키 갱신)',                      'anon', 'ok', 'w', format('insert into public.games(team_code,game_key,game_data,label,ts) values (%L,''__v_probe__'',''{"a":2}'',''x'',1) on conflict (team_code,game_key) do update set game_data = excluded.game_data', v_code), 'ROWS:1'],
    ['[games] 올바른 헤더로 다른 팀 코드 행 insert 시도',             'anon', 'ok', 'w', 'insert into public.games(team_code,game_key,game_data) values (''zz-다른팀-zz'',''__v_x__'',''{}'')', 'DENIED'],
    ['[games] 헤더 없이 insert 시도',                                  'anon', 'none', 'w', format('insert into public.games(team_code,game_key,game_data) values (%L,''__v_y__'',''{}'')', v_code), 'DENIED'],
    ['[games] 올바른 헤더 delete = cloudDelete',                      'anon', 'ok', 'w', 'delete from public.games where game_key = ''__v_probe__''', 'ROWS:1'],
    ['[games] 헤더 없이 delete 시도',                                  'anon', 'none', 'w', 'delete from public.games where game_key = ''__v_probe__''', 'ROWS:0'],
    ['[games] 다른 코드 헤더로 update 시도',                           'anon', 'other', 'w', 'update public.games set label = ''x'' where game_key = ''__v_probe__''', 'ROWS:0'],
    ['[games] 올바른 헤더로 team_code 를 바꿔치기 시도',               'anon', 'ok', 'w', 'update public.games set team_code = ''zz-다른팀-zz'' where game_key = ''__v_probe__''', 'DENIED'],
    ['[feedback] 피드백 보내기(insert) 정상',                          'anon', 'none', 'w', 'insert into public.feedback(ts,tags,text,abs,ver,ua) values (1, array[''t''], ''probe'', 0, ''v'', ''u'')', 'ROWS:1'],
    ['[feedback] 목록 읽기 → 안 보임',                                 'anon', 'none', 'r', 'select count(*)::text from public.feedback', '0'],
    ['[shared_links] 링크 만들기(insert) 정상',                        'anon', 'none', 'w', 'insert into public.shared_links(id,payload) values (''__v_new__'',''{"n":1}'')', 'ROWS:1'],
    ['[shared_links] 목록 읽기 → 안 보임',                             'anon', 'none', 'r', 'select count(*)::text from public.shared_links', '0'],
    ['[shared_links] keep-alive ping (shared_links?limit=1) → 오류 없이 빈 결과', 'anon', 'none', 'r', 'select count(*)::text from (select * from public.shared_links limit 1) x', '0'],
    ['[shared_links] RPC: 기존 링크 id 로 열기',                        'anon', 'none', 'r', format('select (public.get_shared_link(%L) is not null)::text', v_link), 'true'],
    ['[shared_links] RPC: 방금 만든 링크(__v_probe__)',                 'anon', 'none', 'r', 'select (public.get_shared_link(''__v_probe__'') = ''{"p":1}''::jsonb)::text', 'true'],
    ['[shared_links] RPC: 없는 id → 빈 값',                            'anon', 'none', 'r', 'select (public.get_shared_link(''__none__'') is null)::text', 'true'],
    ['[shared_links] RPC: 와일드카드 % → 빈 값',                       'anon', 'none', 'r', 'select (public.get_shared_link(''%'') is null)::text', 'true']
  ];

  for i in 1 .. array_length(probes, 1) loop
    role_ := probes[i][2]; hk := probes[i][3]; kind := probes[i][4];
    execute format('set local role %s', role_);
    perform set_config('request.jwt.claim.sub', case when role_ = 'authenticated' then gen_random_uuid()::text else '' end, true);
    perform set_config('request.headers',
      case hk when 'ok'     then json_build_object('x-team-code', h_ok)::text
              when 'other'  then json_build_object('x-team-code', h_other)::text
              when 'broken' then json_build_object('x-team-code', '!!!')::text
              else '{}' end, true);
    r := null; ecode := 'OK'; cnt := null;
    begin
      if kind = 'r' then
        execute probes[i][5] into r;
      else
        execute probes[i][5];
        get diagnostics cnt = row_count;
        r := 'ROWS:' || cnt;
        raise exception using errcode = 'P0001', message = 'probe_rollback';
      end if;
    exception
      when sqlstate 'P0001' then null;
      when others then r := sqlerrm; ecode := 'ERROR ' || sqlstate;
    end;
    reset role;
    oc := case
      when ecode = 'ERROR 42501' then case when probes[i][6] = 'DENIED' then 'OK' else 'DENIED(예상 밖)' end
      when ecode <> 'OK'         then ecode
      when r = probes[i][6]      then 'OK'
      else 'MISMATCH' end;
    lines := lines || format('%-4s %s | 기대=%s 실제=%s  %s', lpad(i::text, 2, '0'), probes[i][1], probes[i][6], left(coalesce(r, ''), 28), oc);
  end loop;

  lines := lines || format('--   (참고) 기존 팀 코드의 행 %s개 / feedback %s개 / shared_links %s개 — postgres 로 본 실제 개수. 시험 행 1개 포함 기대값은 +1', n_games, n_fb, n_sl);
  raise exception E'VERIFY_RESULT (전부 롤백됨 — 데이터 변경 없음, 팀 코드·내용은 출력하지 않음)\n%', array_to_string(lines, E'\n');
end $$;
