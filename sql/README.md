# sql/ — Supabase RLS 수동 마이그레이션

GitHub Pages + LocalStorage 구조라 서버 쪽 마이그레이션 도구가 없다. 대시보드 **SQL Editor**에서 번호 순서대로 직접 실행한다.

| 파일 | 하는 일 | DB 변경 |
|---|---|---|
| `01_diagnose_rls.sql` | public 정책 전체 · RLS 상태 · 정책 간 순환(재귀 위험) 점검 | 없음 (읽기 전용) |
| `02_fix_teams_rls_recursion.sql` | `teams` ↔ `team_members` 무한 재귀 제거 (`is_team_owner` / `is_team_member` + 정책 2개 교체) | 함수 2개 생성, 정책 2개 USING 교체 |
| `03_verify_team_rls.sql` | 소유자 / 팀원 / 비팀원 / 비로그인 4가지로 읽기·쓰기 권한 확인 (실제 팀이 있어야 함) | 없음 (쓰기 시험은 전부 취소, 임시 표만 생성) |
| `03b_verify_team_rls_fixture.sql` | 03 과 같은 확인을 **임시 가짜 사용자·팀**으로 수행 (팀이 없어도 됨). 끝에서 일부러 예외를 던져 전부 롤백 → `VERIFY_RESULT` 오류가 나오는 것이 정상 | 없음 (전부 롤백) |
| `04_find_team_by_code_rpc.sql` | 팀 코드 "정확히 일치" 조회 RPC `find_team_by_code` (가입 화면용. `teams_select` 는 풀지 않음) | 함수 1개 생성 (authenticated 만 실행) |
| `04b_verify_find_team_by_code.sql` | 04 검증 (임시 픽스처, 전부 롤백) | 없음 (전부 롤백) |
| `05_public_policies_phase1_additive.sql` | [Phase 1] `request_team_code()` · `get_shared_link()` 추가 (동작 변화 없음) | 함수 2개 생성 |
| `06_public_policies_phase3_close.sql` | [Phase 3] `games` 헤더 방식 RLS 로 교체 · `feedback.allow_select` / `shared_links.public_read` 삭제 | 정책 교체·삭제 (다시 열려면 파일 맨 아래 ROLLBACK) |
| `06b_verify_public_policies_closed.sql` | Phase 3 검증 (기존 팀 코드로 시험, 코드·내용 비출력, 전부 롤백) | 없음 (전부 롤백) |
| `07_enable_rls_visits.sql` | `public.visits` RLS 켜기 (정책 없음 = 전면 차단). 06 과 **독립**(순서 무관). 어드바이저 ERROR `rls_disabled_in_public` | RLS 활성화 1줄 (되돌리면 `disable row level security`) |
| `07b_verify_visits_closed.sql` | 07 검증 (임시 행, 전부 롤백) | 없음 (전부 롤백) |
| `08_team_write_guards.sql` | `user_games` insert/update 정책에 "내 행 + 내 팀의 team_id 만" 조건 추가, 가입 RPC `join_team_by_code` 생성. **클라이언트 배포 전에** 적용 | 정책 2개 교체, 함수 1개 생성 (DROP 없음) |
| `09_drop_team_members_insert.sql` | `team_members_insert` 정책 삭제(가입은 RPC 로만). **클라이언트 배포 후** SQL Editor 에서 수동 실행 | 정책 1개 삭제 (DROP) |
| `10_one_team_per_user.sql` | 한 사람당 팀 하나를 DB 가 강제: `teams(owner_id)` · `team_members(user_id)` unique index, `join_team_by_code` 재정의(다른 팀 소속이면 예외), `teams_insert` 에 "팀원 아님" 조건 + `is_in_any_team()`. 08 선행(가정 확인이 검사). **클라이언트 배포 전에** 적용 | 인덱스 2개·함수 1개 생성, 함수 1개 교체, 정책 1개 교체 (DROP 없음) |
| `11_owner_reads_team_games.sql` | `user_games_select` 에 "내가 소유한 팀의 `team_id`" 조건 추가 — 팀장이 팀원 경기를 읽는다(Realtime 도 같은 정책). 10 선행(가정 확인이 검사). **2026-10-15 적용** — 팀장용 목록 화면(#75 · #79 를 main 에 옮긴 PR)과 함께 | 정책 1개 교체 (DROP 없음) |
| `12_anonymize_existing_shared_links.sql` | 이미 만들어진 `?gid=` 공유 링크(`shared_links.payload`)의 선수 이름 필드(`hl.n` · `al.n` · `pitchers.nm` · `abs.bn`)를 `#등번호` / `성OO` 로 치환(클라이언트 `_anonSharePayload` 와 같은 규칙). **기본값은 미리보기**(`DRY_RUN` 예외로 전부 롤백) · `cutoff`(치환된 클라이언트 배포 시각) 필수 · 적용 시 원본을 `sl_maint.shared_links_backup` 에 먼저 백업 · 치환 후 이전 이름이 남으면 전부 롤백. PR #121 배포 후에 실행 | `shared_links` UPDATE(payload) · `sl_maint` 스키마 + 백업 표 생성 (DROP 없음 — 정리 블록만 DROP) |
| `13_team_display_name.sql` | 팀원이 가입할 때 정하는 "팀에서 쓸 이름": `team_members.display_name`(null 허용, 1~20자 check), `join_team_by_code(text, text)` 오버로드(이름 검사 후 1인자 함수 호출 · 이름 저장 — 1인자 함수는 그대로), `set_my_team_name(text)`(본인 행만). 구글 계정 이름은 쓰지 않는다(유소년 팀). 08 · 10 선행(가정 확인이 검사). **2026-10-15 적용** — 순서: ① 11 → ② 13 → ③ 클라이언트 머지·배포(새 가입 폼이 2인자 함수를 부른다) | 컬럼 1개 + check 1개 추가, 함수 2개 생성 (DROP 없음) |
| `14_user_games_label.sql` | 경기 이름 바꾸기를 다른 기기로: `user_games.label` · `label_at`(둘 다 null 허용). 클라이언트는 이름을 바꿀 때 이 두 열만 update 한다(data · updated_at 은 그대로 — 내용이 오래된 기기가 서버를 덮지 않게). 새 정책 없음(08 의 `user_games_update` 가 내 행만). 08 선행 · 사용자 트리거 없음 · 새 열의 열 권한을 가정 확인이 검사. **순서: ① 이 파일 → ② 클라이언트 머지·배포** | 컬럼 2개 추가 (DROP 없음) |

## 공개 정책 닫기 런북 (games / feedback / shared_links)
순서를 바꾸지 않는다: **05 → 클라이언트 배포 → 06**.
1. **Phase 1** `05` 실행 (추가만 · 안전). `get_shared_link` 가 있어야 새 클라이언트의 공유 링크 열기가 동작한다.
2. **Phase 2** 클라이언트 배포 (`core.js ?v=122`, `sw.js` 캐시 v45) 후 **게이트 확인**
   - 배포된 페이지가 `core.js?v=122` 를 로드하는지
   - 실서비스에서 팀 코드를 설정하고 동기화 → Network 의 `/rest/v1/games` 요청에 `x-team-code` 헤더가 있고 **200** (프리플라이트 OPTIONS 포함)
   - 공유 링크(`?gid=…`)가 열리는지 (`rpc/get_shared_link` 200)
   - 배포 후 충분히 지났는지(구버전 탭 정리). 로그 확인: `edge_logs` 에서 `request.path = '/rest/v1/games'` 요청량(2026-10-02 기준 24시간 4건 — 사용량이 매우 작다)
3. **Phase 3** `06` 실행 → `06b` 실행(전부 OK) → 실서비스에서 기존 팀 코드로 동기화(GET/POST 200), 피드백 보내기, 공유 링크 열기 재확인
4. 문제 시 `06` 맨 아래 ROLLBACK 블록으로 즉시 되돌린다. 구버전 탭은 새로고침하면 된다(실패 시 "클라우드 저장 실패 · 이 기기에는 저장됨" 알림이 뜬다).

## 적용 이력 (Supabase 프로젝트 `bsmbrngkpsdmbwoqcrps`)
| 날짜 | 마이그레이션 | 내용 |
|---|---|---|
| 2026-10-02 | `fix_teams_rls_recursion` | `02` — `is_team_owner` / `is_team_member` 생성, `teams_select` / `team_members_select` USING 교체 |
| 2026-10-02 | `add_find_team_by_code_rpc` | `04` — `find_team_by_code` 생성 |
| 2026-10-02 | `add_public_policy_helpers_phase1` | `05` (Phase 1) — `request_team_code()` · `get_shared_link()` 생성. 정책 변경 없음(공개 정책은 아직 열려 있음). 적용 후 10개 시험 전부 OK |
| 2026-10-02 | **(기록 없음 — SQL Editor 수동 적용)** | `06` (Phase 3) — `games_select/insert/update/delete`(헤더 방식) 생성, `pub_r/pub_i/pub_u/pub_d` 삭제, `feedback.allow_select` · `shared_links.public_read` 삭제. 적용 후 `06b` 23개 시험 전부 OK, 정책 상태 직접 확인 |
| 2026-10-02 | `enable_rls_visits` | `07` — `public.visits` RLS 켜기(정책 없음 = anon/authenticated 전면 차단). MCP 도구로 적용(마이그레이션 기록 있음). 적용 후 `07b` 7/7 OK, 시험 행 잔존 0, 어드바이저 ERROR `rls_disabled_in_public` 해소(남은 INFO `rls_enabled_no_policy` 는 의도한 상태) |
| 2026-10-05 | **(기록 없음 — SQL Editor 수동 적용)** | `08` — `user_games_update` USING/WITH CHECK · `user_games_insert` WITH CHECK 교체(내 행 + 내가 속한/소유한 팀의 `team_id` 만), `join_team_by_code` 생성(authenticated 만 실행, anon 차단). 적용 후 `pg_policies` · `pg_proc` 조회로 반영 확인 |
| 2026-10-05 | **(기록 없음 — SQL Editor 수동 적용)** | `10` — `teams(owner_id)` · `team_members(user_id)` unique index, `is_in_any_team()` 생성, `teams_insert` WITH CHECK 에 "팀원 아님" 추가, `join_team_by_code` 교체(다른 팀 소속이면 P0001). 적용 후 인덱스 · `pg_policies` · `pg_proc` 조회로 반영 확인. `11` 은 미적용(팀장 목록 화면 PR 과 함께 적용) |
| 2026-10-05 | **(기록 없음 — SQL Editor 수동 적용)** | `09` — `team_members_insert` 정책 삭제(DROP). 가입은 `join_team_by_code` RPC 로만. 적용 후 `pg_policies` 조회로 `team_members` 에 SELECT · DELETE 정책만 남은 것 확인. 하루 대기 없이 적용한 이유: 구버전 클라이언트는 입력칸 id 중복(#73 이전)으로 가입이 원래 불가능했고, 적용 시점 팀 0개 |
| 2026-10-12 | **(기록 없음 — Supabase MCP `execute_sql` 로 적용)** | `12` — `shared_links` 32행 중 18행의 선수 이름 필드를 `#등번호` / `성OO` 로 치환. `cutoff` = `2026-10-12 21:05:00+09`(클라이언트 PR #121 배포 #231 완료 직후). 미리보기 → 적용 순서. 미리보기: 대상 18 · 이미 같음 13(이름이 없는 빈 경기 9 + v1 형식 4) · 건너뜀 1(`test` 키만 있는 비경기 행) · 이름 잔존 0. 적용 후 확인: 백업 32행 · 변경 18행 · 이름 필드 외 변경 0 · 이전 이름 잔존 0 · 이름으로 집계해 선수가 합쳐지는 행 0 · `get_shared_link` RPC 결과 = 테이블 · 백업 표 RLS 켬, anon/authenticated 읽기 불가. 적용한 SQL 은 병합본에서 "이름 필드가 없는 원소(v1 형식 타석 — 지울 이름이 없음)는 건드리지 않는다" 2줄을 고친 것(그대로면 v1 행 4개에 `bn` 이 새로 생겨 옛 링크 표시가 바뀜 — 첫 미리보기가 이 4행을 대상 22로 잡아 발견). 원본(실명 포함) 백업 표 `sl_maint.shared_links_backup` 과 `sl_maint` 스키마는 **같은 날(2026-10-12) 삭제**했다 — SQL Editor 에서 직접 실행(`drop table` → `drop schema`, 둘 다 성공). MCP 의 `execute_sql` · `apply_migration` 은 DROP 이 사용자 승인 대기로 멈춰 4회 모두 타임아웃, 삭제되지 않았다(삭제 여부는 읽기 전용 조회로 확인: 표 · 스키마 없음, `shared_links` 32행 그대로). 삭제로 12 의 ROLLBACK 블록은 더 쓸 수 없고, 복구는 Supabase 자체 백업 보존 기간 안에서만 가능하다. 브라우저에서 기존 `?gid=` 링크를 열어 본 결과는 이 기록에 없다 |
| 2026-10-15 | **(기록 없음 — Supabase MCP `execute_sql` 로 적용)** | `11` — `user_games_select` USING 을 `user_id = auth.uid() or (team_id is not null and (is_team_member(team_id) or is_team_owner(team_id)))` 로 교체. 적용 전 가정 확인(10 · 02 · 기존 식) 통과, 적용 전 `teams` 0행 · `team_members` 0행. 적용 후 `pg_policies` 조회로 SELECT 식 확인, INSERT/UPDATE/DELETE 정책 그대로 |
| 2026-10-15 | **(기록 없음 — Supabase MCP `execute_sql` 로 적용)** | `13` — `team_members.display_name`(text, null 허용) + `team_members_display_name_len` check(1~20자), `join_team_by_code(text, text)` · `set_my_team_name(text)` 생성(security definer · authenticated 만 실행, anon 불가 — `has_function_privilege` 로 확인). 1인자 `join_team_by_code(text)` 그대로. 보안 어드바이저: 새 경고는 두 함수의 `authenticated_security_definer_function_executable`(의도 — 본인 행만 바꾼다)뿐 |

적용 후 `03b`(36개 시험)와 `04b`(12개 시험) 모두 통과, 재귀 0건. `06`(Phase 3)은 클라이언트 배포·게이트 1~4 확인 후 사용자 승인을 받아 적용했고, `06b` 23개 시험이 전부 통과했다. 단, `03b` 의 `teams BY CODE` 2건은 `02` 단계에서는 MISMATCH 로 남고 `04` + 프론트(`cloud.js` ?v=7)로 해소된다.

> **`06` 은 `supabase_migrations.schema_migrations` 에 기록되지 않는다.** Supabase MCP 도구는 `DROP` 이 들어간 문장을 사용자 확인 대기로 멈춰, 클라우드 세션에서 `06` 을 적용할 수 없었다(6회 시도, 모두 60초 타임아웃, DB 변경 없음 확인). 그래서 사용자가 SQL Editor 에서 같은 파일을 직접 실행했다. 이 표가 아니라 **`pg_policies` 가 실제 상태의 기준**이다 — 의심스러우면 `01_diagnose_rls.sql` 을 실행한다.

## 순서
1. `01` 실행 → `kind=cycle` / `affected` 행 확인 (결과 표를 그대로 공유하면 점검 가능)
2. `02` 실행 (트랜잭션 — 가정이 틀리면 아무것도 반영하지 않고 중단)
3. `03`(팀이 있을 때) 또는 `03b`(팀이 없을 때) 실행 → `42P17`/`재귀` 표시가 없어야 함
4. 브라우저 확인: 로그인 후 **타구를 1개 기록하고 3초 대기**(또는 새로고침) → DevTools Network 에서 `user_games` 요청이 200, 콘솔에 `recursion` 없음
   - 참고: 로그인 상태의 **"경기 저장" 버튼 자체는 `user_games`로 올리지 않는다** (`core.js`의 `cloudSave`(팀 코드/`games`)가 `cloud.js`의 것을 덮어씀). 자동 동기화(타구 기록 후 3초)와 시작 동기화만 `user_games`를 쓴다.

## 새 마이그레이션을 추가할 때
- 파일명 `NN_설명.sql`, `begin; … commit;`, 파일 맨 아래에 롤백 블록을 주석으로 남긴다.
- 정책을 바꿀 땐 `drop/create` 대신 `alter policy … using (…)` — 이름·대상 역할·명령이 그대로 유지된다.
- 정책 안에서 다른 RLS 테이블을 서브쿼리로 읽지 않는다. 판정은 `security definer` 함수로 뺀다 (`stable`, `set search_path = public`, `auth.uid()` 는 함수 안에서 읽기).
- 적용 후 `01`(순환 0건)과 `03`을 다시 실행한다.
- `DROP` 이 들어가는 마이그레이션은 MCP 도구로 적용이 안 될 수 있다 → SQL Editor 에서 직접 실행하고, 위 이력 표에 **"수동 적용"** 으로 남긴다(마이그레이션 기록에는 안 남는다).
- 이 폴더는 GitHub Pages 배포(`path: '.'`)에 포함되어 공개된다. service_role 키 · 실제 사용자 데이터는 넣지 않는다.
