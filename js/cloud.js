/**
 * SprayLab Cloud Sync v3
 * 로그인 전에는 서버 전송 없음 + Google OAuth + 이메일 매직링크 + 자동 클라우드 동기화 + 팀 기능
 */
(function () {
  'use strict';

  /* ── 설정 ─────────────────────────────────────── */
  var SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
  var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
  var SESSION_KEY = 'sl_cloud_session';

  // innerHTML 에 넣는 값(계정 이름 · 팀 코드 등)용 HTML 이스케이프
  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── 내부 상태 ──────────────────────────────────── */
  var _sb        = null;
  var _user      = null;
  var _online    = typeof navigator !== 'undefined' ? navigator.onLine : true;
  var _debTimer  = null;
  var _pendSync  = false;
  var _startDone = false;
  var _team      = null;   // { id, code, name, owner_id, role: 'owner'|'member' }
  var _rtChannel = null;   // Realtime 채널

  /* ── Supabase 클라이언트 ─────────────────────────── */
  function _client() {
    if (_sb) return _sb;
    if (window.supabase && window.supabase.createClient) {
      _sb = window.supabase.createClient(SURL, SKEY, {
        auth: { persistSession: true, storageKey: SESSION_KEY, flowType: 'pkce' }
      });
    }
    return _sb;
  }

  /* ── 저장 상태 인디케이터 ────────────────────────── */
  function _setStatus(state) {
    var ind = document.getElementById('saveInd');
    if (!ind) return;
    var loggedIn = window._cloudIsLoggedIn && window._cloudIsLoggedIn();
    if (!loggedIn) {
      ind.innerHTML = '<span title="로그인하면 클라우드 저장 가능" style="color:#555;cursor:default;font-size:13px">☁</span>';
      ind.className = 'save-ind';
      return;
    }
    ind.innerHTML = '';
    switch (state) {
      case 'syncing': ind.textContent = '동기화 중...';  ind.className = 'save-ind syncing'; break;
      case 'saved':   ind.textContent = '저장됨 ✓';     ind.className = 'save-ind ok';      break;
      case 'offline': ind.textContent = '오프라인';      ind.className = 'save-ind offline'; break;
      case 'error':   ind.textContent = '클라우드 실패'; ind.className = 'save-ind fail';    break;
      case 'clear':   ind.textContent = '';              ind.className = 'save-ind';          break;
    }
  }

  /* ── 동기화 결과 알림 ─────────────────────────────
     로컬 저장은 이미 끝난 뒤에 호출되므로 여기서 로컬 저장을 막지 않는다.
     실패했는데 "저장됨 ✓" 이 뜨지 않도록 성공/실패 표시는 반드시 이 두 함수를 거친다. */
  var _failToastAt = 0;
  function _syncSaved(ms) {
    _failToastAt = 0;   // 성공하면 다음 실패는 바로 알린다
    _setStatus('saved');
    setTimeout(function () { _setStatus('clear'); }, ms);
  }
  function _notifySyncFail() {
    _setStatus('error');
    setTimeout(function () { _setStatus('clear'); }, 4000);
    var now = Date.now();
    if (now - _failToastAt < 60000) return;   // 타구마다 자동 동기화가 돌므로 토스트는 60초에 한 번만
    _failToastAt = now;
    if (typeof showToast === 'function') showToast('⚠️ 클라우드 저장 실패 · 이 기기에는 저장됨', false);
  }
  window._cloudNotifyFail = _notifySyncFail;   // core.js(팀 코드 동기화)에서도 같은 알림을 쓴다

  /* ── 경기 시각(ts) 정규화 ─────────────────────────────
     서버 games.ts 는 bigint(ms) 인데, 예전 버전이 저장한 경기는 ts 가 ko-KR 로케일 문자열('2026. 5. 17. 오후 4:28:31')이라
     그대로 올리면 400(invalid input syntax for type bigint) 이다. 전송값만 숫자로 바꾼다 — LocalStorage 원본은 건드리지 않는다.
     · 예외를 던지지 않는다. 못 읽으면 ts=0, reliable=false
     · reliable = 경기 자신의 시각을 읽은 경우(gd.ts · 저장 항목 ts · 키 속 에폭). gd.d(날짜만)로 짐작한 값은 reliable=false —
       병합(서버본이 로컬을 덮어쓸지)에는 쓰지 않는다 */
  var _TS_MIN = 946684800000;   // 2000-01-01 — 이보다 이르면 시각이 아니라고 본다
  var _TS_KO = /^(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*[.일]?\s*(?:(오전|오후|AM|PM)\s*)?(?:(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*(AM|PM)?)?\s*$/i;
  function _tsOk(n) { return typeof n === 'number' && isFinite(n) && n >= _TS_MIN && n <= Date.now() + 86400000; }
  function _parseTs(v) {
    try {
      if (v == null || v === '') return null;
      if (v instanceof Date) v = v.getTime();
      if (typeof v === 'number') return _tsOk(v) ? Math.floor(v) : null;
      if (typeof v !== 'string') return null;
      var s = v.trim();
      if (!s) return null;
      if (/^\d{10,16}(\.\d+)?$/.test(s)) { var n = Math.floor(Number(s)); return _tsOk(n) ? n : null; }   // 숫자 문자열(ms)
      // ko-KR 로케일 문자열 — 환경(ICU)마다 공백이 NBSP/NNBSP 로 바뀌므로 \s 로 받는다. 기기의 로컬 시간대로 해석
      var m = _TS_KO.exec(s);
      if (m) {
        var ap = (m[4] || m[8] || '').toUpperCase();
        if (m[5] == null && ap) return null;                       // '오후' 만 있고 시각이 없음
        var h = m[5] == null ? 0 : +m[5], mi = m[6] == null ? 0 : +m[6], sc = m[7] == null ? 0 : +m[7];
        if (ap === '오후' || ap === 'PM') { if (h < 12) h += 12; }  // 오후 4시 → 16시 (12시는 그대로)
        else if (ap === '오전' || ap === 'AM') { if (h === 12) h = 0; }   // 오전 12시 → 0시
        if (h > 23 || mi > 59 || sc > 59) return null;
        var y = +m[1], mo = +m[2], d = +m[3], dt = new Date(y, mo - 1, d, h, mi, sc);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;   // 2월 30일 같은 값
        var t = dt.getTime();
        return _tsOk(t) ? t : null;
      }
      // 그 밖의 로케일/ISO 문자열 — 연도(4자리)가 있을 때만 Date.parse (짧은 숫자를 엉뚱한 날짜로 읽지 않도록)
      if (/\d{4}/.test(s)) { var p = Date.parse(s); if (_tsOk(p)) return p; }
    } catch (e) { /* 아래 null */ }
    return null;
  }
  function _keyEpoch(key) {   // sl_1779530658875 · sl_rec_1779530658875 (밀리초 에폭이 키에 들어간 형식)
    var m = /^sl_(?:rec_)?(\d{12,14})$/.exec(String(key == null ? '' : key));
    return m ? _parseTs(Number(m[1])) : null;
  }
  // gd = 경기 데이터, entry = sl_saves 항목, key = 저장 키 (모두 없어도 된다)
  function _tsInfo(gd, entry, key) {
    var t = _parseTs(gd && gd.ts);
    if (t == null) t = _parseTs(entry && entry.ts);
    if (t == null) t = _keyEpoch(key != null ? key : (entry && entry.key));
    if (t != null) return { ts: t, reliable: true };
    t = _parseTs(gd && gd.d);   // 날짜만 있는 경우(자정으로 짐작): 올릴 때만 쓰는 값
    return t != null ? { ts: t, reliable: false } : { ts: 0, reliable: false };
  }
  window._slParseTs = _parseTs;   // 값 하나 → ms 숫자 | null
  window._slTsInfo = _tsInfo;     // 경기 → { ts, reliable }

  /* ── 로컬 수정 시각 (sl_cloud_mod = { 저장키: 수정한 시각(ms) }) ─────────────
     경기 ts 는 생성 시각이다 — saveGame 은 다시 저장해도 기존 ts 를 유지한다. 그래서 ts 만으로는 "로컬이 서버보다 나중에
     고쳐졌는지" 알 수 없고, 서버 updated_at(업로드 시각)이 늘 더 새롭게 보여 오프라인에서 고친 내용이 서버본에 덮인다.
     → core.js cloudSave(저장 · 타석 수정 · 가져오기 …)와 자동저장 복구가 _markMod 로 수정한 시각을 기록한다(오프라인이어도).
     로컬 수정 시각 = max(기록값, 경기 ts). 서버 user_games.updated_at 도 같은 시계(수정한 시각)로 쓴다.
     ponytail: 지운 경기의 항목은 남는다(맵이 작아 정리하지 않음) */
  var MOD_KEY = 'sl_cloud_mod';
  function _modMap() {
    try { var m = JSON.parse(localStorage.getItem(MOD_KEY) || 'null'); return m && typeof m === 'object' && !Array.isArray(m) ? m : null; } catch (e) { return null; }
  }
  function _markMod(key, ms) {
    try {
      if (typeof key !== 'string' || !key) return;
      var m = _modMap() || {};
      m[key] = ms || Date.now();
      localStorage.setItem(MOD_KEY, JSON.stringify(m));
    } catch (e) { /* 저장 공간 부족 등 — 기록하지 못해도 경기 저장은 막지 않는다 */ }
  }
  function _localMod(gd, entry, key) {   // → { ms, reliable }  (reliable=false: 수정 시각을 알 수 없음)
    var ti = _tsInfo(gd, entry, key), m = _modMap(), s = m ? Number(m[key]) : 0;
    var ms = Math.max(ti.reliable ? ti.ts : 0, isFinite(s) && s > 0 ? s : 0);
    return { ms: ms, reliable: ms > 0 };
  }
  window._slMarkMod = _markMod;
  // 기록이 없는 기존 경기(이 기능 이전부터 있던 것)는 ts 로만 비교한다 — 일부러 "지금"으로 기록하는 전환 처리를 두지 않는다.
  // 전환 때 지금을 찍으면 나중에 처음 열린 기기의 "지금"이 더 늦어, 오래된 기기가 새 기기의 데이터를 덮는다(기기를 여는 순서에 따라 결과가 갈림).
  // ts 만 쓰면 순서와 무관하게 더 새로운 ts 가 이기고, ts 가 같으면(다시 저장만 한 경기) 어느 쪽도 덮지 않는다.
  // 그런 경기도 그 기기에서 한 번 저장하면 수정 시각이 기록되어 그 버전이 최신이 된다.

  /* ── 인증 UI 업데이트 ────────────────────────────── */
  function _updateAuthUI() {
    var isReal = _user && !_user.is_anonymous;
    var name = isReal
      ? ((_user.user_metadata && (_user.user_metadata.full_name || _user.user_metadata.name)) || _user.email || '계정')
      : null;

    // 데스크톱 헤더 버튼
    var btn = document.getElementById('authBtn');
    if (btn) {
      if (isReal) {
        var initial = name.charAt(0).toUpperCase();
        btn.innerHTML = '<span class="auth-avatar">' + _esc(initial) + '</span> 내 계정';
        btn.title = name;
        btn.classList.add('auth-logged');
      } else {
        btn.innerHTML = '👤 로그인';
        btn.title = '로그인하면 다른 기기에서도 이어서 사용할 수 있어요';
        btn.classList.remove('auth-logged');
      }
    }

    // 모바일 액션바 계정 버튼
    var mabAuth = document.getElementById('mabAuthBtn');
    if (mabAuth) {
      if (isReal) {
        var ini = name.charAt(0).toUpperCase();
        mabAuth.innerHTML = '<span class="auth-avatar" style="width:20px;height:20px;font-size:10px">' + _esc(ini) + '</span><span class="mab-label">계정</span>';
        mabAuth.style.color = 'var(--accent)';
      } else {
        mabAuth.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="mab-label">계정</span>';
        mabAuth.style.color = '';
      }
    }

    // 모바일 더보기 시트 계정 버튼
    var mobAcc = document.getElementById('mobAccountBtn');
    if (mobAcc) {
      mobAcc.textContent = isReal ? ('✅ ' + name + ' · 계정/팀 관리') : '👤 로그인 / 계정 관리';
    }

    _updateTeamUI();
  }

  /* ── 팀 UI 업데이트 ─────────────────────────────── */
  function _updateTeamUI() {
    var badge = document.getElementById('teamBadge');
    if (!badge) return;
    if (_team) {
      badge.textContent = (_team.role === 'owner' ? '팀장' : '팀원') + ' · ' + _team.name;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }

    var sec = document.getElementById('teamSection');
    if (!sec) return;
    var isReal = _user && !_user.is_anonymous;
    if (!isReal) {
      sec.innerHTML = '<p class="team-login-hint">팀 기능은 로그인 후 사용할 수 있어요</p>';
      return;
    }
    if (_team) {
      sec.innerHTML =
        '<div class="team-info">' +
          '<div class="team-code-label">팀 코드</div>' +
          '<div class="team-code-big" id="teamCodeDisplay">' + _esc(_team.code) + '</div>' +
          '<button class="btn-team-copy" onclick="window._copyTeamCode()">코드 복사</button>' +
          (_team.role === 'owner'
            ? '<button class="btn-team-leave btn-team-danger" onclick="window.dissolveTeam()">팀 해산</button>'
            : '<button class="btn-team-leave" onclick="window.leaveTeam()">팀 탈퇴</button>') +
        '</div>';
    } else {
      sec.innerHTML =
        '<div class="team-actions">' +
          '<button class="btn-team-create" onclick="window.openCreateTeam()">팀 만들기</button>' +
          '<button class="btn-team-join" onclick="window.openJoinTeam()">코드로 참가</button>' +
        '</div>' +
        '<div id="teamFormArea"></div>';
    }
  }

  /* ── OAuth 리다이렉트 여부 감지 ────────────────── */
  function _isOAuthRedirect() {
    return window.location.search.indexOf('code=') !== -1 ||
           window.location.hash.indexOf('access_token=') !== -1;
  }

  /* ── 인증 확인 (로그인 전에는 서버 전송 없음) ──────── */
  function _ensureAuth() {
    return new Promise(function (resolve) {
      var db = _client();
      if (!db) { resolve(null); return; }
      db.auth.getSession().then(function (res) {
        var sess = res.data && res.data.session;
        if (sess && sess.user && sess.user.is_anonymous) {
          db.auth.signOut();
          localStorage.removeItem('sl_cloud_uid');
          resolve(null);
          return;
        }
        if (sess && sess.user) {
          _user = sess.user;
          localStorage.setItem('sl_cloud_uid', _user.id);
          resolve(_user);
          return;
        }
        // OAuth 리다이렉트 직후면 대기 — 로그인 전에는 서버 전송 없음
        if (_isOAuthRedirect()) { resolve(null); return; }
        resolve(null);
      }).catch(function () { resolve(null); });
    });
  }

  /* ── 게임 단건 upsert ───────────────────────────── */
  function _upsertGame(key, gameData, teamId) {
    return _ensureAuth().then(function (user) {
      if (!user) return false;   // 로그인 전: 전송하지 않음 (실패가 아니므로 성공 표시도 하지 않는다)
      var row = {
        user_id:    user.id,
        game_key:   key,
        team_name:  (gameData.th || '') + ' vs ' + (gameData.ta || ''),
        date:       gameData.d || null,
        data:       gameData,
        updated_at: new Date(_localMod(gameData, null, key).ms || Date.now()).toISOString()   // 업로드 시각이 아니라 수정한 시각
      };
      if (teamId) row.team_id = teamId;
      return _client().from('user_games').upsert(row, { onConflict: 'user_id,game_key' }).then(function (r) {
        if (r.error) { console.warn('[Cloud] upsert:', r.error.message); throw r.error; }   // 호출부 .catch 가 실패로 처리
        return true;
      });
    });
  }

  /* ── 시작 시 양방향 머지 ──────────────────────────── */
  function _startupSync() {
    if (_startDone) return;
    _startDone = true;
    if (!_online) { _setStatus('offline'); return; }
    _setStatus('syncing');

    _ensureAuth().then(function (user) {
      if (!user) { _setStatus('clear'); return; }
      _updateAuthUI();
      var db    = _client();
      var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');

      var upErr = null, sentKeys = {}, entryOf = {};
      saves.forEach(function (s) { if (s && typeof s.key === 'string') entryOf[s.key] = s; });

      // 0. 서버의 현재 updated_at 만 먼저 읽는다. 못 읽으면(네트워크·권한·5xx) 업로드하지 않고 아래 catch 가 실패로 알린다.
      //    (예전에는 로컬 전부를 무조건 올려, 오래된 기기가 로그인하면 더 새로운 클라우드본을 덮어쓸 수 있었다)
      return db.from('user_games').select('game_key,updated_at').eq('user_id', user.id).then(function (r0) {
        if (r0.error) throw r0.error;
        var remoteMs = Object.create(null);
        (r0.data || []).forEach(function (x) { if (x && typeof x.game_key === 'string') remoteMs[x.game_key] = new Date(x.updated_at).getTime() || 0; });

        // 1. 올릴 경기 고르기 — 서버에 없거나, 로컬 수정 시각이 서버보다 새로운 경기만 올린다.
        //    서버가 같거나 더 새로우면 올리지 않는다(아래 내려받기가 서버본을 가져온다). 수정 시각을 알 수 없으면 양쪽 모두 두고 로그만 남긴다
        var byKey = Object.create(null), order = [], unsent = 0, held = 0;
        saves.forEach(function (s) {
          try {
            if (!s || typeof s.key !== 'string') return;
            var gd = JSON.parse(localStorage.getItem(s.key) || 'null');
            if (!gd) return;
            var lm = _localMod(gd, s, s.key), cur = byKey[s.key];
            if (!cur) order.push(s.key);
            if (!cur || lm.ms >= cur.lm.ms) byKey[s.key] = { gd: gd, lm: lm };   // 같은 키가 두 번 있으면 더 최신 항목(한 요청에 같은 행이 두 번 들어가면 서버가 거부한다)
          } catch (e) { unsent++; }   // 깨진 JSON 등 — 읽을 수 없는 경기
        });
        var rows = [];
        order.forEach(function (k) {
          var c = byKey[k];
          if (k in remoteMs) {
            if (!c.lm.reliable) { held++; return; }
            if (c.lm.ms <= remoteMs[k]) return;
          }
          sentKeys[k] = true;
          rows.push({ user_id: user.id, game_key: k,
            team_name: (c.gd.th||'') + ' vs ' + (c.gd.ta||''), date: c.gd.d||null,
            data: c.gd, updated_at: new Date(c.lm.reliable ? c.lm.ms : Date.now()).toISOString() });
        });
        if (unsent) console.warn('[Cloud] startup upload: 읽을 수 없어 올리지 못한 경기 ' + unsent + '개');
        if (held) console.warn('[Cloud] startup upload: 로컬 수정 시각을 읽지 못해 서버에 있는 경기 ' + held + '개는 올리지도 덮지도 않음');

        // 업로드가 실패해도 아래 내려받기는 계속 시도하되(기존 동작), 끝에서 실패로 알린다
        if (!rows.length) return;
        return db.from('user_games').upsert(rows, { onConflict: 'user_id,game_key' }).then(function (ur) {
          if (ur && ur.error) { upErr = ur.error; console.warn('[Cloud] startup upload:', ur.error.message); }
        });
      }).then(function () {
        return db.from('user_games').select('game_key,data,updated_at').eq('user_id', user.id);
      }).then(function (r) {
        if (r.error) throw r.error;
        var existMap = {};
        saves.forEach(function (s) { if (s && typeof s.key === 'string') existMap[s.key] = true; });
        var added = 0;
        (r.data || []).forEach(function (row) {
          var k = row.game_key;
          var clean = _cleanRow(k, row.data);   // 공용 검증: 형식이 맞지 않는 행(설정 키 포함)은 건너뛴다
          if (!clean) return;
          if (sentKeys[k]) return;   // 방금 올린 경기
          var loc = JSON.parse(localStorage.getItem(k) || 'null');
          var remoteTs = row.updated_at ? new Date(row.updated_at).getTime() || 0 : 0;
          var lm = _localMod(loc, entryOf[k], k);   // 로컬 수정 시각을 못 읽으면(예전 형식·없음) 서버본으로 덮어쓰지 않는다
          if (!loc || (lm.reliable && remoteTs > lm.ms)) {
            localStorage.setItem(k, JSON.stringify(row.data));
            if (remoteTs) _markMod(k, remoteTs);   // 서버본을 받았다 → 로컬 수정 시각 = 서버 시각(같은 시계)
            if (!existMap[k]) {
              saves.push(clean);
              added++;
            }
          } else if (!lm.reliable) {
            console.warn('[Cloud] 로컬 경기 시각을 읽지 못해 병합에서 제외:', k);
          }
        });
        if (added) {
          localStorage.setItem('sl_saves', JSON.stringify(saves));
          if (typeof showToast === 'function') showToast('☁️ 클라우드에서 ' + added + '개 경기 복원됨', false);
        }
        if (upErr) _notifySyncFail(); else _syncSaved(3000);
        // 팀 정보 로드
        return _loadMyTeam();
      });
    }).catch(function (e) {
      console.warn('[Cloud] startup sync error:', e);
      _notifySyncFail();
    });
  }

  function _gameLabel(d) {
    return (d&&d.th?d.th:'홈') + ' vs ' + (d&&d.ta?d.ta:'원정') + ' ' + (d&&d.d?d.d:'');
  }

  // 클라우드 행 검증 — core.js 의 공용 검증(_cleanSaveEntry)을 쓴다.
  // 설정 키(sl_cloud_session 등)는 통과하지 못하고, 검증 함수가 아직 없으면 안전하게 건너뛴다
  function _cleanRow(key, data) {
    return typeof window._cleanSaveEntry === 'function'
      ? window._cleanSaveEntry({ key: key, label: _gameLabel(data), ts: (data && data.ts) || 0 }, data) : null;
  }

  /* ── 팀 정보 로드 ──────────────────────────────── */
  function _loadMyTeam() {
    if (!_user || _user.is_anonymous) return Promise.resolve();
    var db = _client();
    // 내가 팀장인 팀 확인
    return db.from('teams').select('*').eq('owner_id', _user.id).maybeSingle().then(function (r) {
      if (r.data) {
        _team = Object.assign({}, r.data, { role: 'owner' });
        _updateTeamUI();
        _subscribeTeam(_team.id);
        return;
      }
      // 내가 멤버인 팀 확인
      return db.from('team_members').select('team_id, teams(*)').eq('user_id', _user.id).maybeSingle().then(function (r2) {
        if (r2.data && r2.data.teams) {
          _team = Object.assign({}, r2.data.teams, { role: 'member' });
          _updateTeamUI();
          _subscribeTeam(_team.id);
        }
      });
    }).catch(function (e) { console.warn('[Cloud] loadMyTeam:', e && e.message); });
  }

  /* ── Realtime 구독 ──────────────────────────────── */
  function _subscribeTeam(teamId) {
    if (_rtChannel) { _client().removeChannel(_rtChannel); _rtChannel = null; }
    var db = _client();
    if (!db) return;
    _rtChannel = db.channel('team_games_' + teamId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_games',
        filter: 'team_id=eq.' + teamId
      }, function (payload) {
        _onTeamGameUpdate(payload.new);
      })
      .subscribe();
  }

  function _onTeamGameUpdate(row) {
    if (!row || !row.game_key || !row.data) return;
    if (!_cleanRow(row.game_key, row.data)) return;   // 공용 검증: 설정 키(sl_cloud_session 등) 덮어쓰기 차단
    // 현재 열려있는 경기와 같은 key면 live 업데이트
    var curKey = window._autoKey || ('sl_auto_' + (window.AS && AS.curGame));
    if (row.game_key === curKey && window.AS) {
      // 원격 타구를 로컬에 머지 (내 타구는 덮어쓰지 않음)
      var remoteAbs = row.data.abs || [];
      var localIds = new Set((AS.abs || []).map(function (a) { return a.id; }));
      var newAbs = remoteAbs.filter(function (a) { return !localIds.has(a.id); });
      if (newAbs.length) {
        AS.abs = (AS.abs || []).concat(newAbs);
        if (typeof updateAll === 'function') updateAll();
        if (typeof showToast === 'function') showToast('🔴 팀원이 ' + newAbs.length + '개 타구 추가', false);
      }
    }
    // localStorage 업데이트
    var loc = JSON.parse(localStorage.getItem(row.game_key) || 'null');
    var remoteTs = row.updated_at ? new Date(row.updated_at).getTime() || 0 : 0;
    var lm = _localMod(loc, null, row.game_key);   // 로컬 수정 시각을 못 읽으면 덮어쓰지 않는다
    if (!loc || (lm.reliable && remoteTs > lm.ms)) {
      localStorage.setItem(row.game_key, JSON.stringify(row.data));
      if (remoteTs) _markMod(row.game_key, remoteTs);
    }
  }

  /* ── 인증 상태 변경 감지 ─────────────────────────── */
  function _initAuthListener() {
    var db = _client();
    if (!db) return;
    db.auth.onAuthStateChange(function (event, session) {
      var prevAnon = !_user || _user.is_anonymous;
      _user = session ? session.user : null;
      _updateAuthUI();

      if (event === 'SIGNED_IN' && _user && !_user.is_anonymous) {
        localStorage.setItem('sl_cloud_uid', _user.id);
        // OAuth 코드 파라미터 URL에서 제거 (만료된 코드로 재교환 방지)
        if (window.location.search.indexOf('code=') !== -1) {
          var cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState(null, '', cleanUrl);
        }
        _startDone = false;
        setTimeout(function () {
          _startupSync();
          _closeLoginModal();
          if (prevAnon && typeof showToast === 'function') {
            showToast('✅ 로그인 완료! 이제 다른 기기에서도 이어서 사용할 수 있어요', false);
          }
        }, 500);
      }
      if (event === 'SIGNED_OUT') {
        _team = null;
        if (_rtChannel) { _client().removeChannel(_rtChannel); _rtChannel = null; }
        _startDone = false;
        setTimeout(_startupSync, 300);
      }
    });
  }

  /* ── 온라인/오프라인 감지 ────────────────────────── */
  window.addEventListener('online', function () {
    _online = true;
    if (_pendSync) { _pendSync = false; _startDone = false; _startupSync(); }
    else { _setStatus('saved'); setTimeout(function () { _setStatus('clear'); }, 2000); }
  });
  window.addEventListener('offline', function () {
    _online = false;
    clearTimeout(_debTimer);
    _setStatus('offline');
  });

  /* ── 모달 헬퍼 ──────────────────────────────────── */
  function _closeLoginModal() {
    var m = document.getElementById('loginModal');
    if (m) m.classList.remove('show');
  }

  /* ═══════════════════════════════════════════════
     외부 인터페이스
  ═══════════════════════════════════════════════ */

  /* saveGame() → cloudSave(key, data) */
  window.cloudSave = function (key, data) {
    if (!_online) { _pendSync = true; return; }
    clearTimeout(_debTimer);
    _setStatus('syncing');
    _debTimer = setTimeout(function () {
      _upsertGame(key, data, _team ? _team.id : null)
        .then(function (ok) { if (ok) _syncSaved(3000); else _setStatus('clear'); })
        .catch(_notifySyncFail);
    }, 3000);
  };

  /* updateAll() → 타구 기록 시 디바운스 3초 자동 동기화 */
  window.cloudAutoSyncRecord = function () {
    if (!_online || !window.AS || !(AS.abs && AS.abs.length)) {
      if (!_online) _pendSync = true;
      return;
    }
    clearTimeout(_debTimer);
    _debTimer = setTimeout(function () {
      var key = window._autoKey || ('sl_auto_' + (AS.curGame || Date.now()));
      _upsertGame(key, {
        abs: AS.abs, hs: AS.hs, as: AS.as, ts: Date.now(),
        th: (document.getElementById('tHome')||{}).value || '홈팀',
        ta: (document.getElementById('tAway')||{}).value || '원정팀',
        home_lineup: AS.home_lineup, away_lineup: AS.away_lineup,
        zoneHistory: AS.zoneHistory || {}, pitchers: AS.pitchers || [],
        d: new Date().toLocaleDateString('ko-KR')
      }, _team ? _team.id : null).then(function (ok) {
        if (ok) _syncSaved(2000); else _setStatus('clear');
      }).catch(_notifySyncFail);
    }, 3000);
  };

  /* 로그인 모달 열기 */
  window.openLoginModal = function () {
    var isReal = _user && !_user.is_anonymous;
    if (isReal) {
      var pm = document.getElementById('profileModal');
      if (pm) {
        var nm = _user.user_metadata && (_user.user_metadata.full_name || _user.user_metadata.name);
        var em = _user.email || '';
        var el = document.getElementById('profileName');
        var ee = document.getElementById('profileEmail');
        if (el) el.textContent = nm || em || '계정';
        if (ee) ee.textContent = em;
        _updateTeamUI();
        pm.classList.add('show');
      }
    } else {
      var lm = document.getElementById('loginModal');
      if (lm) {
        var inp = document.getElementById('magicEmailInput');
        if (inp) inp.value = '';
        var msg = document.getElementById('magicMsg');
        if (msg) { msg.textContent = ''; msg.className = 'magic-msg'; }
        lm.classList.add('show');
      }
    }
  };

  /* Google OAuth */
  window.signInWithGoogle = function () {
    var db = _client();
    if (!db) return;
    var redirect = window.location.href.split('?')[0].split('#')[0];
    var go = function () {
      db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect, queryParams: { prompt: 'select_account' } } });
    };
    // 서버(Supabase 프로젝트)가 일시 중지되면 로그인 페이지로 넘어가지 못하고 브라우저 오류 화면만 남으므로 먼저 연결 확인
    var msg = document.getElementById('magicMsg');
    if (msg) { msg.textContent = '연결 확인 중...'; msg.className = 'magic-msg'; }
    fetch(SURL + '/auth/v1/settings', { headers: { apikey: SKEY } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (msg) { msg.textContent = ''; }
      go();
    }).catch(function () {
      var t = '서버에 연결할 수 없어요 — Supabase 프로젝트가 일시 중지됐을 수 있어요. 관리자가 대시보드에서 복구(Restore)해야 합니다';
      if (msg) { msg.textContent = t; msg.className = 'magic-msg error'; }
      else if (typeof showToast === 'function') showToast(t, false);
    });
  };

  /* 이메일 매직링크 */
  window.sendMagicLink = function () {
    var inp = document.getElementById('magicEmailInput');
    var msg = document.getElementById('magicMsg');
    if (!inp || !msg) return;
    var email = inp.value.trim();
    if (!email || !email.includes('@')) {
      msg.textContent = '올바른 이메일을 입력해 주세요';
      msg.className = 'magic-msg error';
      return;
    }
    var db = _client();
    if (!db) return;
    msg.textContent = '전송 중...';
    msg.className = 'magic-msg';
    var redirect = window.location.href.split('?')[0].split('#')[0];
    var prom;
    if (_user && _user.is_anonymous) {
      prom = db.auth.linkIdentity({ provider: 'email', email: email, options: { emailRedirectTo: redirect } });
    } else {
      prom = db.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: redirect } });
    }
    prom.then(function (r) {
      if (r && r.error) {
        msg.textContent = '오류: ' + r.error.message;
        msg.className = 'magic-msg error';
      } else {
        msg.textContent = '📧 이메일을 확인해 주세요! 링크를 클릭하면 자동으로 로그인됩니다.';
        msg.className = 'magic-msg ok';
        inp.value = '';
      }
    }).catch(function (e) {
      msg.textContent = '오류: ' + (e && e.message || '알 수 없는 오류');
      msg.className = 'magic-msg error';
    });
  };

  /* 로그아웃 */
  window.cloudSignOut = function () {
    var pm = document.getElementById('profileModal');
    if (pm) pm.classList.remove('show');
    var db = _client();
    if (!db) return;
    db.auth.signOut().then(function () {
      _user = null;
      _team = null;
      _updateAuthUI();
      _startDone = false;
      setTimeout(_startupSync, 300);
      if (typeof showToast === 'function') showToast('로그아웃됐습니다', false);
    });
  };

  window.closeLoginModal = _closeLoginModal;

  /* 로그인 상태 확인 (저장 방식 선택 시트에서 사용) */
  window._cloudIsLoggedIn = function () {
    return !!((_user && !_user.is_anonymous));
  };

  /* ──────────────────────────────────────────────
     팀 기능
  ────────────────────────────────────────────── */

  function _rand6() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  window.openCreateTeam = function () {
    var area = document.getElementById('teamFormArea');
    if (!area) return;
    area.innerHTML =
      '<div class="team-form">' +
        '<input id="teamNameInput" type="text" placeholder="팀 이름 입력" class="magic-input" maxlength="20">' +
        '<button class="btn-magic" onclick="window.createTeam()">팀 생성</button>' +
        '<div id="teamFormMsg" class="magic-msg"></div>' +
      '</div>';
    setTimeout(function () {
      var el = document.getElementById('teamNameInput');
      if (el) el.focus();
    }, 100);
  };

  window.openJoinTeam = function () {
    var area = document.getElementById('teamFormArea');
    if (!area) return;
    area.innerHTML =
      '<div class="team-form">' +
        '<input id="teamCodeInput" type="text" placeholder="6자리 팀 코드 입력" class="magic-input" maxlength="6" ' +
          'style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">' +
        '<button class="btn-magic" onclick="window.joinTeam()">참가하기</button>' +
        '<div id="teamFormMsg" class="magic-msg"></div>' +
      '</div>';
    setTimeout(function () {
      var el = document.getElementById('teamCodeInput');
      if (el) el.focus();
    }, 100);
  };

  window.createTeam = function () {
    var nameEl = document.getElementById('teamNameInput');
    var msgEl  = document.getElementById('teamFormMsg');
    if (!nameEl || !msgEl) return;
    var name = nameEl.value.trim();
    if (!name) { msgEl.textContent = '팀 이름을 입력해 주세요'; msgEl.className = 'magic-msg error'; return; }
    if (!_user || _user.is_anonymous) { msgEl.textContent = '로그인이 필요합니다'; msgEl.className = 'magic-msg error'; return; }
    msgEl.textContent = '생성 중...'; msgEl.className = 'magic-msg';
    var db = _client();
    var code = _rand6();
    db.from('teams').insert({ code: code, owner_id: _user.id, name: name })
      .select().single()
      .then(function (r) {
        if (r.error) { msgEl.textContent = '오류: ' + r.error.message; msgEl.className = 'magic-msg error'; return; }
        _team = Object.assign({}, r.data, { role: 'owner' });
        _updateTeamUI();
        _subscribeTeam(_team.id);
        if (typeof showToast === 'function') showToast('🎉 팀 "' + name + '" 생성 완료! 코드: ' + code, false);
      }).catch(function (e) {
        msgEl.textContent = '오류: ' + (e && e.message || '알 수 없는 오류');
        msgEl.className = 'magic-msg error';
      });
  };

  window.joinTeam = function () {
    var codeEl = document.getElementById('teamCodeInput');
    var msgEl  = document.getElementById('teamFormMsg');
    if (!codeEl || !msgEl) return;
    var code = codeEl.value.trim().toUpperCase();
    if (code.length !== 6) { msgEl.textContent = '6자리 코드를 입력해 주세요'; msgEl.className = 'magic-msg error'; return; }
    if (!_user || _user.is_anonymous) { msgEl.textContent = '로그인이 필요합니다'; msgEl.className = 'magic-msg error'; return; }
    msgEl.textContent = '참가 중...'; msgEl.className = 'magic-msg';
    var db = _client();
    // 가입 전(비팀원)에는 RLS 때문에 teams 를 직접 읽을 수 없다 → 코드가 정확히 일치할 때만
    // id / name / is_owner 를 돌려주는 RPC 사용 (sql/04_find_team_by_code_rpc.sql)
    db.rpc('find_team_by_code', { p_code: code }).then(function (r) {
      if (r.error) { msgEl.textContent = '오류: ' + r.error.message; msgEl.className = 'magic-msg error'; return; }
      var found = r.data && r.data[0];
      if (!found) { msgEl.textContent = '팀 코드를 찾을 수 없어요'; msgEl.className = 'magic-msg error'; return; }
      var team = { id: found.id, name: found.name, code: code };
      if (found.is_owner) { msgEl.textContent = '내가 만든 팀이에요'; msgEl.className = 'magic-msg error'; return; }
      return db.from('team_members').insert({ team_id: team.id, user_id: _user.id })
        .then(function (r2) {
          if (r2.error && r2.error.code !== '23505') { // 23505 = already member
            msgEl.textContent = '오류: ' + r2.error.message; msgEl.className = 'magic-msg error'; return;
          }
          _team = Object.assign({}, team, { role: 'member' });
          _updateTeamUI();
          _subscribeTeam(_team.id);
          if (typeof showToast === 'function') showToast('✅ "' + team.name + '" 팀에 참가했어요!', false);
        });
    }).catch(function (e) {
      msgEl.textContent = '오류: ' + (e && e.message || '알 수 없는 오류');
      msgEl.className = 'magic-msg error';
    });
  };

  window.leaveTeam = function () {
    if (!_team || !_user) return;
    if (!confirm('팀에서 탈퇴할까요?')) return;
    var db = _client();
    db.from('team_members').delete().eq('team_id', _team.id).eq('user_id', _user.id).then(function () {
      var name = _team.name;
      _team = null;
      if (_rtChannel) { db.removeChannel(_rtChannel); _rtChannel = null; }
      _updateTeamUI();
      if (typeof showToast === 'function') showToast('"' + name + '" 팀에서 탈퇴했습니다', false);
    });
  };

  window.dissolveTeam = function () {
    if (!_team || !_user || _team.role !== 'owner') return;
    if (!confirm('팀을 해산할까요? 팀원 모두 탈퇴됩니다.')) return;
    var db = _client();
    db.from('teams').delete().eq('id', _team.id).then(function () {
      var name = _team.name;
      _team = null;
      if (_rtChannel) { db.removeChannel(_rtChannel); _rtChannel = null; }
      _updateTeamUI();
      if (typeof showToast === 'function') showToast('"' + name + '" 팀이 해산됐습니다', false);
    });
  };

  window._copyTeamCode = function () {
    if (!_team) return;
    navigator.clipboard.writeText(_team.code).then(function () {
      if (typeof showToast === 'function') showToast('팀 코드 ' + _team.code + ' 복사됨!', false);
    });
  };

  /* ── 앱 시작 ─────────────────────────────────────── */
  // OAuth 리다이렉트 후 URL 해시 토큰을 즉시 감지하기 위해 클라이언트를 바로 생성
  _client();

  document.addEventListener('DOMContentLoaded', function () {
    if (!_online) _setStatus('offline');
    var db = _client();
    if (db) _initAuthListener();
    setTimeout(_startupSync, 1500);
  });

})();
