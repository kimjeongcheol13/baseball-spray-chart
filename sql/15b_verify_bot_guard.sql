-- ============================================================
-- 15b_verify_bot_guard.sql — 15 적용 후 검증 (임시 행을 만들어 시험하고 전부 롤백)
-- 실행하면 "VERIFY_RESULT …" 오류가 나오는 것이 정상이며, 그 메시지가 결과표다. 기대값: 15 적용 후 전부 OK.
-- (15 적용 전에 돌리면 크기 · 횟수 시험이 MISMATCH 로 나온다 = 아직 막지 않는다는 뜻)
-- 시험 행은 내용 없는 가짜 값('__v_…')만 쓰고, 기존 행의 내용은 읽거나 출력하지 않는다(개수만).
-- 덮지 않는 것: 하루 합계 50 MB 한도(시험에 50 MB 를 써야 해서 뺐다) · 하루 개수 한도(10분 한도와 같은 식).
-- ============================================================
do $$
declare
  lines text[] := array[]::text[];
  probes text[][];
  i int; r text; ecode text; oc text; cnt int; role_ text; k int;
  v_old timestamptz;
begin
  lines := lines || format('--   트리거: feedback %s개 · shared_links %s개 / 최근 10분 행: feedback %s · shared_links %s',
    (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.feedback'::regclass),
    (select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.shared_links'::regclass),
    (select count(*) from public.feedback where created_at > now() - interval '10 minutes'),
    (select count(*) from public.shared_links where created_at > now() - interval '10 minutes'));

  -- (설명, 역할, r|w, SQL, 기대값) — 기대값 ROWS:n = 그만큼 들어감 · CHECK = 크기 검사에 걸림 · ERROR PT429 = 횟수 제한
  probes := array[
    ['[feedback] 앱과 같은 모양 insert → 들어감',            'anon', 'w', 'insert into public.feedback(ts,tags,text,abs,ver,ua) values (1, array[''bug''], ''__v_probe__'', 3, ''1.2.0'', ''Mozilla/5.0'')', 'ROWS:1'],
    ['[feedback] 글 2000자 → 들어감',                       'anon', 'w', 'insert into public.feedback(ts,tags,text) values (1, null, repeat(''가'', 2000))', 'ROWS:1'],
    ['[feedback] 글 2001자 → 거부',                         'anon', 'w', 'insert into public.feedback(ts,tags,text) values (1, null, repeat(''가'', 2001))', 'CHECK'],
    ['[feedback] 태그 11개 → 거부',                         'anon', 'w', 'insert into public.feedback(ts,tags,text) values (1, array_fill(''t''::text, array[11]), ''x'')', 'CHECK'],
    ['[feedback] ua 201자 → 거부',                          'anon', 'w', 'insert into public.feedback(ts,text,ua) values (1, ''x'', repeat(''u'', 201))', 'CHECK'],
    ['[shared_links] 앱과 같은 모양 insert → 들어감',        'anon', 'w', 'insert into public.shared_links(id,payload) values (''__v_new__'', ''{"v":2,"abs":[]}'')', 'ROWS:1'],
    ['[shared_links] payload 300 KB → 거부',                'anon', 'w', 'insert into public.shared_links(id,payload) values (''__v_big__'', jsonb_build_object(''x'', repeat(''a'', 300000)))', 'CHECK'],
    ['[shared_links] id 3자 → 거부',                        'anon', 'w', 'insert into public.shared_links(id,payload) values (''abc'', ''{}'')', 'CHECK'],
    ['[shared_links] 목록 읽기 → 여전히 안 보임',            'anon', 'r', 'select count(*)::text from public.shared_links', '0'],
    ['[shared_links] RPC: 시험 링크(__v_probe__) 열기',      'anon', 'r', 'select (public.get_shared_link(''__v_probe__'') = ''{"p":1}''::jsonb)::text', 'true'],
    ['[트리거 함수] anon 이 직접 부르기 → 권한 없음',        'anon', 'r', 'select public.feedback_insert_guard()::text', 'DENIED']
  ];

  -- 시험용 링크 1개(postgres 로 — 롤백됨). 옛날 created_at 을 넣어도 트리거가 now() 로 고친다
  insert into public.shared_links(id, payload, created_at) values ('__v_probe__', '{"p":1}', '2000-01-01') ;
  select created_at into v_old from public.shared_links where id = '__v_probe__';

  for i in 1 .. array_length(probes, 1) loop
    role_ := probes[i][2];
    execute format('set local role %s', role_);
    perform set_config('request.jwt.claim.sub', '', true);
    r := null; ecode := 'OK';
    begin
      if probes[i][3] = 'r' then
        execute probes[i][4] into r;
      else
        execute probes[i][4];
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
      when ecode = 'ERROR 23514' then case when probes[i][5] = 'CHECK'  then 'OK' else 'CHECK(예상 밖)' end
      when ecode = 'ERROR 42501' then case when probes[i][5] = 'DENIED' then 'OK' else 'DENIED(예상 밖)' end
      when ecode <> 'OK'         then case when probes[i][5] = ecode    then 'OK' else ecode end
      when r = probes[i][5]      then 'OK'
      else 'MISMATCH' end;
    lines := lines || format('%02s %s | 기대=%s 실제=%s  %s', i, probes[i][1], probes[i][5], left(coalesce(r, ''), 28), oc);
  end loop;

  i := array_length(probes, 1);
  lines := lines || format('%02s %s | 기대=%s 실제=%s  %s', i + 1, '[트리거] 넣은 옛날 created_at 은 now() 로 고쳐짐', 'now', v_old::text,
    case when v_old = now() then 'OK' else 'MISMATCH' end);

  -- 횟수 제한: 최근 10분 행을 한도(feedback 20 · shared_links 60)까지 postgres 로 채운 뒤, anon 의 다음 한 개가 막히는지
  select count(*) into k from public.feedback where created_at > now() - interval '10 minutes';
  insert into public.feedback(ts, text) select 1, '__v_fill__' from generate_series(1, greatest(0, 20 - k));
  select count(*) into k from public.shared_links where created_at > now() - interval '10 minutes';
  insert into public.shared_links(id, payload) select '__v_fill_' || g || '__', '{}' from generate_series(1, greatest(0, 60 - k)) g;

  probes := array[
    ['[feedback] 10분에 20개가 찬 뒤 하나 더 → 막힘',      'anon', 'w', 'insert into public.feedback(ts,tags,text) values (1, array[''bug''], ''__v_more__'')', 'ERROR PT429'],
    ['[shared_links] 10분에 60개가 찬 뒤 하나 더 → 막힘',  'anon', 'w', 'insert into public.shared_links(id,payload) values (''__v_more__'', ''{}'')', 'ERROR PT429'],
    ['[shared_links] 막혀도 기존 링크 열기는 됨(RPC)',      'anon', 'r', 'select (public.get_shared_link(''__v_probe__'') is not null)::text', 'true']
  ];
  for k in 1 .. array_length(probes, 1) loop
    execute format('set local role %s', probes[k][2]);
    r := null; ecode := 'OK';
    begin
      if probes[k][3] = 'r' then
        execute probes[k][4] into r;
      else
        execute probes[k][4];
        get diagnostics cnt = row_count;
        r := 'ROWS:' || cnt;
        raise exception using errcode = 'P0001', message = 'probe_rollback';
      end if;
    exception
      when sqlstate 'P0001' then null;
      when others then r := sqlerrm; ecode := 'ERROR ' || sqlstate;
    end;
    reset role;
    oc := case when ecode <> 'OK' then case when probes[k][5] = ecode then 'OK' else ecode end
               when r = probes[k][5] then 'OK' else 'MISMATCH' end;
    lines := lines || format('%02s %s | 기대=%s 실제=%s  %s', i + 1 + k, probes[k][1], probes[k][5], left(coalesce(r, ''), 28), oc);
  end loop;

  raise exception E'VERIFY_RESULT (전부 롤백됨 — 데이터 변경 없음)\n%', array_to_string(lines, E'\n');
end $$;
