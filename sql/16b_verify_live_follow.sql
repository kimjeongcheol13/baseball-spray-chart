-- 16b_verify_live_follow.sql — 16 적용 뒤 확인 (읽기 전용 · 각 줄 ok = true 여야 한다)
select 'live_games 있음' as what, to_regclass('public.live_games') is not null as ok
union all select 'RLS 켜짐', (select relrowsecurity from pg_class where oid = 'public.live_games'::regclass)
union all select '표 정책 없음(직접 읽기 · 쓰기 불가)', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'live_games')
union all select 'anon 표 권한 없음', not has_table_privilege('anon', 'public.live_games', 'SELECT,INSERT,UPDATE,DELETE')
union all select 'anon live_put 실행 가능', has_function_privilege('anon', 'public.live_put(text,text,jsonb)', 'EXECUTE')
union all select 'anon live_get 실행 가능', has_function_privilege('anon', 'public.live_get(text)', 'EXECUTE')
union all select 'live_put security definer', (select prosecdef from pg_proc where oid = 'public.live_put(text,text,jsonb)'::regprocedure)
union all select 'live_get security definer', (select prosecdef from pg_proc where oid = 'public.live_get(text)'::regprocedure);
