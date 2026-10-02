-- ============================================================
-- 07b_verify_visits_closed.sql — 07 적용 후 검증 (임시 행을 만들어 시험하고 전부 롤백)
-- 실행하면 "VERIFY_RESULT …" 오류가 나오는 것이 정상이며, 그 메시지가 결과표다.
-- 기대값: 07 적용 후 전부 OK. (07 적용 전에 돌리면 MISMATCH 가 나온다 = 아직 열려 있다는 뜻)
-- ============================================================
do $$
declare
  lines text[] := array[]::text[];
  probes text[][];
  i int; r text; ecode text; oc text; cnt int; role_ text;
begin
  lines := lines || format('--   visits RLS 켜짐: %s, 정책 %s개, 기존 행 %s개',
    (select relrowsecurity from pg_class where oid = 'public.visits'::regclass),
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'visits'),
    (select count(*) from public.visits));
  insert into public.visits(uid, ts, ua) values ('__probe__', 1, 'probe');   -- postgres 로 시험 행 (롤백됨)

  -- (설명, 역할, r|w, SQL, 기대값)
  probes := array[
    ['anon 읽기 → 안 보임',                'anon',          'r', 'select count(*)::text from public.visits', '0'],
    ['authenticated 읽기 → 안 보임',        'authenticated', 'r', 'select count(*)::text from public.visits', '0'],
    ['anon 방문 기록 insert → 거부',        'anon',          'w', 'insert into public.visits(uid, ts, ua) values (''x'', 1, ''u'')', 'DENIED'],
    ['authenticated insert → 거부',         'authenticated', 'w', 'insert into public.visits(uid, ts, ua) values (''x'', 1, ''u'')', 'DENIED'],
    ['anon update → 0행',                   'anon',          'w', 'update public.visits set ua = ''x''', 'ROWS:0'],
    ['anon delete → 0행',                   'anon',          'w', 'delete from public.visits', 'ROWS:0']
  ];
  for i in 1 .. array_length(probes, 1) loop
    role_ := probes[i][2];
    execute format('set local role %s', role_);
    perform set_config('request.jwt.claim.sub', case when role_ = 'authenticated' then gen_random_uuid()::text else '' end, true);
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
      when ecode = 'ERROR 42501' then case when probes[i][5] = 'DENIED' then 'OK' else 'DENIED(예상 밖)' end
      when ecode <> 'OK'         then ecode
      when r = probes[i][5]      then 'OK'
      else 'MISMATCH' end;
    lines := lines || format('%02s %s | 기대=%s 실제=%s  %s', i, probes[i][1], probes[i][5], left(coalesce(r, ''), 28), oc);
  end loop;
  -- service_role / postgres 는 RLS 를 우회하므로 계속 접근 가능해야 한다
  lines := lines || format('%02s %s | 기대=%s 실제=%s  %s', 7, 'postgres(소유자) 는 시험 행이 보임', '1', (select count(*) from public.visits where uid = '__probe__')::text,
    case when (select count(*) from public.visits where uid = '__probe__') = 1 then 'OK' else 'MISMATCH' end);
  raise exception E'VERIFY_RESULT (전부 롤백됨 — 데이터 변경 없음)\n%', array_to_string(lines, E'\n');
end $$;
