/**
 * SprayLab Cloud Sync v2
 * 익명 인증 + Google OAuth + 이메일 매직링크 + 자동 클라우드 동기화
 */
(function () {
  'use strict';

  /* ── 설정 ─────────────────────────────────────── */
  var SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
  var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
  var SESSION_KEY = 'sl_cloud_session';

  /* ── 내부 상태 ──────────────────────────────────── */
  var _sb        = null;
  var _user      = null;
  var _online    = typeof navigator !== 'undefined' ? navigator.onLine : true;
  var _debTimer  = null;
  var _pendSync  = false;
  var _startDone = false;

  /* ── Supabase 클라이언트 ─────────────────────────── */
  function _client() {
    if (_sb) return _sb;
    if (window.supabase && window.supabase.createClient) {
      _sb = window.supabase.createClient(SURL, SKEY, {
        auth: { persistSession: true, storageKey: SESSION_KEY }
      });
    }
    return _sb;
  }

  /* ── 저장 상태 인디케이터 ────────────────────────── */
  function _setStatus(state) {
    var ind = document.getElementById('saveInd');
    if (!ind) return;
    switch (state) {
      case 'syncing': ind.textContent = '동기화 중...';  ind.className = 'save-ind syncing'; break;
      case 'saved':   ind.textContent = '저장됨 ✓';     ind.className = 'save-ind ok';      break;
      case 'offline': ind.textContent = '오프라인';      ind.className = 'save-ind offline'; break;
      case 'error':   ind.textContent = '클라우드 실패'; ind.className = 'save-ind fail';    break;
      case 'clear':   ind.textContent = '';              ind.className = 'save-ind';          break;
    }
  }

  /* ── 인증 UI 업데이트 ────────────────────────────── */
  function _updateAuthUI() {
    var btn = document.getElementById('authBtn');
    if (!btn) return;
    var isReal = _user && !_user.is_anonymous;
    if (isReal) {
      var name = (_user.user_metadata && (_user.user_metadata.full_name || _user.user_metadata.name))
               || _user.email || '계정';
      var initial = name.charAt(0).toUpperCase();
      btn.innerHTML = '<span class="auth-avatar">' + initial + '</span>';
      btn.title = name;
      btn.classList.add('auth-logged');
    } else {
      btn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>저장하기</span>';
      btn.title = '로그인하면 다른 기기에서도 이어서 사용할 수 있어요';
      btn.classList.remove('auth-logged');
    }
  }

  /* ── 익명 인증 ──────────────────────────────────── */
  function _ensureAuth() {
    return new Promise(function (resolve) {
      var db = _client();
      if (!db) { resolve(null); return; }
      db.auth.getSession().then(function (res) {
        var sess = res.data && res.data.session;
        if (sess && sess.user) {
          _user = sess.user;
          localStorage.setItem('sl_cloud_uid', _user.id);
          resolve(_user);
          return;
        }
        db.auth.signInAnonymously().then(function (r) {
          if (r.error) { console.warn('[Cloud] anon:', r.error.message); resolve(null); return; }
          _user = r.data.user;
          localStorage.setItem('sl_cloud_uid', _user.id);
          resolve(_user);
        });
      }).catch(function () { resolve(null); });
    });
  }

  /* ── 게임 단건 upsert ───────────────────────────── */
  function _upsertGame(key, gameData) {
    return _ensureAuth().then(function (user) {
      if (!user) return;
      return _client().from('user_games').upsert({
        user_id:    user.id,
        game_key:   key,
        team_name:  (gameData.th || '') + ' vs ' + (gameData.ta || ''),
        date:       gameData.d || null,
        data:       gameData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,game_key' }).then(function (r) {
        if (r.error) console.warn('[Cloud] upsert:', r.error.message);
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

      var rows = saves.map(function (s) {
        try {
          var gd = JSON.parse(localStorage.getItem(s.key) || 'null');
          if (!gd) return null;
          return { user_id: user.id, game_key: s.key,
            team_name: (gd.th||'') + ' vs ' + (gd.ta||''), date: gd.d||null,
            data: gd, updated_at: new Date(gd.ts||Date.now()).toISOString() };
        } catch (e) { return null; }
      }).filter(Boolean);

      var upProm = rows.length
        ? db.from('user_games').upsert(rows, { onConflict: 'user_id,game_key' })
        : Promise.resolve({ error: null });

      return upProm.then(function () {
        return db.from('user_games').select('game_key,data,updated_at').eq('user_id', user.id);
      }).then(function (r) {
        if (r.error) throw r.error;
        var existMap = {};
        saves.forEach(function (s) { existMap[s.key] = true; });
        var added = 0;
        (r.data || []).forEach(function (row) {
          var k = row.game_key;
          var loc = JSON.parse(localStorage.getItem(k) || 'null');
          var remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          if (!loc || remoteTs > (loc.ts || 0)) {
            localStorage.setItem(k, JSON.stringify(row.data));
            if (!existMap[k]) {
              saves.push({ key: k, label: _gameLabel(row.data), ts: row.data.ts || 0 });
              added++;
            }
          }
        });
        if (added) {
          localStorage.setItem('sl_saves', JSON.stringify(saves));
          if (typeof showToast === 'function') showToast('☁️ 클라우드에서 ' + added + '개 경기 복원됨', false);
        }
        _setStatus('saved');
        setTimeout(function () { _setStatus('clear'); }, 3000);
      });
    }).catch(function (e) {
      console.warn('[Cloud] startup sync error:', e);
      _setStatus('error');
      setTimeout(function () { _setStatus('clear'); }, 4000);
    });
  }

  function _gameLabel(d) {
    return (d&&d.th?d.th:'홈') + ' vs ' + (d&&d.ta?d.ta:'원정') + ' ' + (d&&d.d?d.d:'');
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
        // 실제 계정으로 전환됐으면 새로 머지
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
      _upsertGame(key, data)
        .then(function () { _setStatus('saved'); setTimeout(function () { _setStatus('clear'); }, 3000); })
        .catch(function () { _setStatus('error'); setTimeout(function () { _setStatus('clear'); }, 4000); });
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
      }).then(function () {
        _setStatus('saved');
        setTimeout(function () { _setStatus('clear'); }, 2000);
      }).catch(function () {});
    }, 3000);
  };

  /* 로그인 모달 열기 */
  window.openLoginModal = function () {
    var isReal = _user && !_user.is_anonymous;
    if (isReal) {
      // 이미 로그인됨 → 프로필 모달
      var pm = document.getElementById('profileModal');
      if (pm) {
        var nm = _user.user_metadata && (_user.user_metadata.full_name || _user.user_metadata.name);
        var em = _user.email || '';
        var el = document.getElementById('profileName');
        var ee = document.getElementById('profileEmail');
        if (el) el.textContent = nm || em || '계정';
        if (ee) ee.textContent = em;
        pm.classList.add('show');
      }
    } else {
      var lm = document.getElementById('loginModal');
      if (lm) {
        // 매직링크 입력 초기화
        var inp = document.getElementById('magicEmailInput');
        if (inp) inp.value = '';
        var msg = document.getElementById('magicMsg');
        if (msg) { msg.textContent = ''; msg.className = 'magic-msg'; }
        lm.classList.add('show');
      }
    }
  };

  /* Google OAuth 로그인 / 익명 → Google 연결 */
  window.signInWithGoogle = function () {
    var db = _client();
    if (!db) return;
    var redirect = window.location.href.split('?')[0].split('#')[0];
    if (_user && _user.is_anonymous) {
      // 익명 계정에 Google 연결 (데이터 유실 없음)
      db.auth.linkIdentity({ provider: 'google', options: { redirectTo: redirect } })
        .catch(function (e) {
          // linkIdentity는 내부적으로 리다이렉트하므로 에러 무시
          console.warn('[Cloud] linkIdentity:', e && e.message);
        });
    } else {
      db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    }
  };

  /* 이메일 매직링크 전송 */
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

    // 익명 계정이면 이메일로도 linkIdentity
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
      _updateAuthUI();
      _startDone = false;
      setTimeout(_startupSync, 300);
      if (typeof showToast === 'function') showToast('로그아웃됐습니다', false);
    });
  };

  /* 로그인 모달 닫기 */
  window.closeLoginModal = _closeLoginModal;

  /* ── 앱 시작 ─────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (!_online) _setStatus('offline');
    var db = _client();
    if (db) _initAuthListener();
    setTimeout(_startupSync, 1500);
  });

})();
