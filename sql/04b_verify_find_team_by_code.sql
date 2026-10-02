-- ============================================================
-- 04b_verify_find_team_by_code.sql — find_team_by_code 검증 (임시 픽스처, 끝에서 전부 롤백)
-- 03b 와 같은 방식: 가짜 사용자 · 팀을 만들고 마지막에 예외를 던져 취소한다. "VERIFY_RESULT …" 가 결과표.
-- 확인: 정확한 코드만 찾음 / 틀린·부분·와일드카드·대소문자 다름·NULL·빈 문자열은 못 찾음 /
--       teams 직접 조회는 여전히 막힘 / 비로그인은 실행 불가 / RPC 로 찾은 뒤 가입하면 팀이 보임
-- ============================================================
do $$
declare
  uo uuid := gen_random_uuid(); uc uuid := gen_random_uuid(); t1 uuid := gen_random_uuid();
  lines text[] := array[]::text[];
  probes text[][];
  uid uuid; r text; ecode text; oc text; cnt int;
begin
  insert into auth.users(id) values (uo), (uc);
  insert into public.teams(id, code, name, owner_id) values (t1, 'ZZRPC1', 'rpc-team', uo);

  probes := array[
    ['outsider','정확한 코드',               'select coalesce((select name || '' owner='' || is_owner from public.find_team_by_code(''ZZRPC1'')), ''(없음)'')', 'rpc-team owner=false'],
    ['outsider','틀린 코드',                 'select coalesce((select name from public.find_team_by_code(''ZZRPCX'')), ''(없음)'')', '(없음)'],
    ['outsider','부분 코드 ZZRPC',           'select coalesce((select name from public.find_team_by_code(''ZZRPC'')), ''(없음)'')', '(없음)'],
    ['outsider','와일드카드 %',              'select coalesce((select name from public.find_team_by_code(''%'')), ''(없음)'')', '(없음)'],
    ['outsider','와일드카드 _______',        'select coalesce((select name from public.find_team_by_code(''______'')), ''(없음)'')', '(없음)'],
    ['outsider','소문자 zzrpc1',             'select coalesce((select name from public.find_team_by_code(''zzrpc1'')), ''(없음)'')', '(없음)'],
    ['outsider','NULL',                      'select coalesce((select name from public.find_team_by_code(null::text)), ''(없음)'')', '(없음)'],
    ['outsider','빈 문자열',                 'select coalesce((select name from public.find_team_by_code('''')), ''(없음)'')', '(없음)'],
    ['outsider','teams 직접 조회(코드)',     'select count(*)::text from public.teams where code = ''ZZRPC1''', '0'],
    ['owner','정확한 코드',                  'select coalesce((select name || '' owner='' || is_owner from public.find_team_by_code(''ZZRPC1'')), ''(없음)'')', 'rpc-team owner=true'],
    ['anon','RPC 호출',                      'select count(*)::text from public.find_team_by_code(''ZZRPC1'')', 'DENIED']
  ];

  for i in 1 .. array_length(probes, 1) loop
    uid := case probes[i][1] when 'owner' then uo when 'outsider' then uc else null end;
    execute format('set local role %s', case when probes[i][1] = 'anon' then 'anon' else 'authenticated' end);
    perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
    perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
    r := null; ecode := 'OK';
    begin
      execute probes[i][3] into r;
    exception when others then r := sqlerrm; ecode := 'ERROR ' || sqlstate;
    end;
    reset role;
    oc := case
      when ecode = 'ERROR 42501' then case when probes[i][4] = 'DENIED' then 'OK' else 'DENIED(예상 밖)' end
      when ecode <> 'OK'         then ecode
      when r = probes[i][4]      then 'OK'
      else 'MISMATCH' end;
    lines := lines || format('%-8s %-26s expect=%-20s actual=%-24s %s', probes[i][1], probes[i][2], probes[i][4], left(coalesce(r, ''), 40), oc);
  end loop;

  -- 가입 흐름: 비팀원이 RPC 로 팀을 찾고 → team_members 에 자신을 추가(기존 insert 정책) → 이제 teams 가 보인다
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', uc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  begin
    insert into public.team_members(team_id, user_id) select f.id, uc from public.find_team_by_code('ZZRPC1') f;
    get diagnostics cnt = row_count;
    select count(*)::text into r from public.teams where code = 'ZZRPC1';
    lines := lines || format('%-8s %-26s expect=%-20s actual=%-24s %s', 'outsider', '가입(RPC→insert) 후 teams 조회', '1 (가입 1행)', r || ' (가입 ' || cnt || '행)', case when r = '1' and cnt = 1 then 'OK' else 'MISMATCH' end);
  exception when others then
    lines := lines || format('%-8s %-26s %s', 'outsider', '가입 흐름', 'ERROR ' || sqlstate || ' ' || sqlerrm);
  end;
  reset role;

  raise exception E'VERIFY_RESULT (전부 롤백됨 — 데이터 변경 없음)\n%', array_to_string(lines, E'\n');
end $$;
