-- ============================================================
-- 16_live_follow.sql — 학부모 실시간 따라보기 (기록하는 폰 → 로그인 없는 학부모 화면 live.html)
--
-- 왜 새 표인가 : 지금 공유 링크(shared_links)는 비로그인에게 넣기만 열려 있고 고치기는 없다(05 · 06). 같은 링크로 점수가 바뀌려면
--                기록하는 폰이 같은 행을 계속 고쳐야 하는데, shared_links 에 고치기를 열면 누구나 남의 링크를 바꿀 수 있다.
--                → 따로 표를 두고, 행을 만든 기기만 아는 쓰기 열쇠(p_key)가 맞을 때만 고치게 한다.
-- 변경 : a) public.live_games (id · 쓰기 열쇠 sha256 · 내용 jsonb · 만든 · 고친 시각). RLS 켜고 정책 없음 + anon · authenticated 권한 회수
--           = 표를 직접 읽거나 쓸 수 없다. 아래 두 함수로만
--        b) live_put(id, 열쇠, 내용) — 없으면 만들고(10분에 새 링크 60개까지 · 표 전체), 있으면 열쇠가 맞을 때만 고친다(같은 링크 3초에 1번까지)
--           id 10~32자 영숫자 · 열쇠 20~128자 · 내용 64 KB 이하. 3일 동안 안 고친 행은 새 링크를 만들 때 지운다
--        c) live_get(id) — 그 id 1건의 { payload, at } (3일 지난 것은 없는 것으로). 목록 읽기는 없다
--        틀리면 SQLSTATE: 22023(값 모양) · 42501(열쇠 틀림) · PT429(너무 잦음 — PostgREST 가 HTTP 429 로)
-- 클라이언트 : js/features/livefollow.js(15초마다 바뀐 것만 올림) · live.html + js/live.js(20초마다 live_get). 함수가 없으면(이 파일 적용 전)
--              기록 화면은 「아직 준비 중」 안내만 하고 아무것도 바꾸지 않는다
-- 적용 : SQL Editor 에서 통째로 1회 실행. DROP 없음 · 한 트랜잭션 · 이미 있으면 아무것도 반영하지 않고 중단. 적용 후 16b 로 확인.
-- 되돌림 : 맨 아래 ROLLBACK 블록
-- ============================================================
begin;

do $$
begin
  if to_regclass('public.live_games') is not null or to_regprocedure('public.live_put(text,text,jsonb)') is not null
     or to_regprocedure('public.live_get(text)') is not null then
    raise exception 'live_games · live_put · live_get 이 이미 있습니다(16 이 적용된 것으로 보입니다). 중단합니다.';
  end if;
end $$;

create table public.live_games (
  id         text primary key check (id ~ '^[A-Za-z0-9]{10,32}$'),
  key_hash   text not null,
  payload    jsonb not null check (octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_games_created_at on public.live_games (created_at);
alter table public.live_games enable row level security;   -- 정책을 만들지 않는다 = 함수 밖에서는 못 읽고 못 쓴다
revoke all on table public.live_games from anon, authenticated;

create function public.live_put(p_id text, p_key text, p_payload jsonb) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hash text;
  v_row public.live_games%rowtype;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9]{10,32}$' or p_key is null or length(p_key) not between 20 and 128 then
    raise exception '링크 값이 올바르지 않습니다' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 65536 then
    raise exception '내용이 없거나 너무 큽니다' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  select * into v_row from public.live_games where id = p_id for update;
  if not found then
    perform pg_advisory_xact_lock(hashtext('public.live_games insert'));   -- 동시에 만들어도 차례로 센다
    if (select count(*) from public.live_games where created_at > now() - interval '10 minutes') >= 60 then
      raise exception '새 링크가 너무 많습니다. 잠시 뒤 다시 시도해 주세요' using errcode = 'PT429';
    end if;
    delete from public.live_games where updated_at < now() - interval '3 days';
    insert into public.live_games (id, key_hash, payload) values (p_id, v_hash, p_payload);
    return now();
  end if;
  if v_row.key_hash <> v_hash then
    raise exception '이 링크를 고칠 수 없습니다' using errcode = '42501';
  end if;
  if v_row.updated_at > now() - interval '3 seconds' then
    raise exception '너무 자주 올렸습니다' using errcode = 'PT429';
  end if;
  update public.live_games set payload = p_payload, updated_at = now() where id = p_id;
  return now();
end $$;

create function public.live_get(p_id text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('payload', payload, 'at', updated_at)
  from public.live_games
  where id = p_id and updated_at > now() - interval '3 days';
$$;

revoke all on function public.live_put(text, text, jsonb) from public;
revoke all on function public.live_get(text) from public;
grant execute on function public.live_put(text, text, jsonb) to anon, authenticated;
grant execute on function public.live_get(text) to anon, authenticated;

commit;

-- ── 되돌림 (필요할 때만, 따로 실행) ──
-- begin;
-- drop function public.live_get(text);
-- drop function public.live_put(text, text, jsonb);
-- drop table public.live_games;
-- commit;
