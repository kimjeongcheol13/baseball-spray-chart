# sql/ — Supabase RLS 수동 마이그레이션

GitHub Pages + LocalStorage 구조라 서버 쪽 마이그레이션 도구가 없다. 대시보드 **SQL Editor**에서 번호 순서대로 직접 실행한다.

| 파일 | 하는 일 | DB 변경 |
|---|---|---|
| `01_diagnose_rls.sql` | public 정책 전체 · RLS 상태 · 정책 간 순환(재귀 위험) 점검 | 없음 (읽기 전용) |
| `02_fix_teams_rls_recursion.sql` | `teams` ↔ `team_members` 무한 재귀 제거 (`is_team_owner` / `is_team_member` + 정책 2개 교체) | 함수 2개 생성, 정책 2개 USING 교체 |
| `03_verify_team_rls.sql` | 소유자 / 팀원 / 비팀원 / 비로그인 4가지로 읽기·쓰기 권한 확인 (실제 팀이 있어야 함) | 없음 (쓰기 시험은 전부 취소, 임시 표만 생성) |
| `03b_verify_team_rls_fixture.sql` | 03 과 같은 확인을 **임시 가짜 사용자·팀**으로 수행 (팀이 없어도 됨). 끝에서 일부러 예외를 던져 전부 롤백 → `VERIFY_RESULT` 오류가 나오는 것이 정상 | 없음 (전부 롤백) |

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
- 이 폴더는 GitHub Pages 배포(`path: '.'`)에 포함되어 공개된다. service_role 키 · 실제 사용자 데이터는 넣지 않는다.
