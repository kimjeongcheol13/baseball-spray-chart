/**
 * SprayLab Cloud Sync v1
 * Supabase 익명 인증 + 자동 클라우드 동기화 (wrapper 레이어)
 * 기존 localStorage 로직은 건드리지 않음
 */
(function () {
  'use strict';

  /* ── 설정 ─────────────────────────────────────── */
  var SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
  var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
  var SESSION_STORAGE_KEY = 'sl_cloud_session';

  /* ── 내부 상태 ──────────────────────────────────── */
  var _sb        = null;
  var _user      = null;
  var _online    = typeof navigator !== 'undefined' ? navigator.onLine : true;
  var _debTimer  = null;
  var _pendSync  = false;   // 오프라인 중 변경 발생
  var _startDone = false;

  /* ── Supabase 클라이언트 ─────────────────────────── */
  function _client() {
    if (_sb) return _sb;
    if (window.supabase && window.supabase.createClient) {
      _sb = window.supabase.createClient(SURL, SKEY, {
        auth: { persistSession: true, storageKey: SESSION_STORAGE_KEY }
      });
    }
    return _sb;
  }

  /* ── 상태 인디케이터 ─────────────────────────────── */
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
        // 세션 없으면 익명 로그인
        db.auth.signInAnonymously().then(function (r) {
          if (r.error) {
            console.warn('[Cloud] anon auth:', r.error.message);
            resolve(null);
            return;
          }
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
      var db = _client();
      return db.from('user_games').upsert({
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
      var db   = _client();
      var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');

      // 1. 로컬 → 클라우드
      var rows = saves.map(function (s) {
        try {
          var gd = JSON.parse(localStorage.getItem(s.key) || 'null');
          if (!gd) return null;
          return {
            user_id:    user.id,
            game_key:   s.key,
            team_name:  (gd.th || '') + ' vs ' + (gd.ta || ''),
            date:       gd.d || null,
            data:       gd,
            updated_at: new Date(gd.ts || Date.now()).toISOString()
          };
        } catch (e) { return null; }
      }).filter(Boolean);

      var upProm = rows.length
        ? db.from('user_games').upsert(rows, { onConflict: 'user_id,game_key' })
        : Promise.resolve({ error: null });

      // 2. 클라우드 → 로컬 (updated_at 기준 최신 우선)
      return upProm.then(function () {
        return db.from('user_games').select('game_key, data, updated_at').eq('user_id', user.id);
      }).then(function (r) {
        if (r.error) throw r.error;

        var existMap = {};
        saves.forEach(function (s) { existMap[s.key] = true; });
        var added = 0, updated = 0;

        (r.data || []).forEach(function (row) {
          var k  = row.game_key;
          var loc = JSON.parse(localStorage.getItem(k) || 'null');
          var remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
          var localTs  = loc ? (loc.ts || 0) : 0;

          if (!loc || remoteTs > localTs) {
            localStorage.setItem(k, JSON.stringify(row.data));
            if (!existMap[k]) {
              saves.push({ key: k, label: _gameLabel(row.data), ts: row.data.ts || 0 });
              added++;
            } else { updated++; }
          }
        });

        if (added || updated) {
          localStorage.setItem('sl_saves', JSON.stringify(saves));
          if (added && typeof showToast === 'function') {
            showToast('☁️ 클라우드에서 ' + added + '개 경기 복원됨', false);
          }
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
    return (d && d.th ? d.th : '홈') + ' vs ' + (d && d.ta ? d.ta : '원정') + ' ' + (d && d.d ? d.d : '');
  }

  /* ── 온라인/오프라인 감지 ────────────────────────── */
  window.addEventListener('online', function () {
    _online = true;
    if (_pendSync) {
      _pendSync  = false;
      _startDone = false;
      _startupSync();
    } else {
      _setStatus('saved');
      setTimeout(function () { _setStatus('clear'); }, 2000);
    }
  });

  window.addEventListener('offline', function () {
    _online = false;
    clearTimeout(_debTimer);
    _setStatus('offline');
  });

  /* ── 외부 인터페이스 ─────────────────────────────── */

  /**
   * saveGame() → cloudSave(key, data) 호출 시 진입
   * 기존 team_code 방식 cloudSave 를 완전 대체
   */
  window.cloudSave = function (key, data) {
    if (!_online) { _pendSync = true; return; }
    clearTimeout(_debTimer);
    _setStatus('syncing');
    _debTimer = setTimeout(function () {
      _upsertGame(key, data)
        .then(function () {
          _setStatus('saved');
          setTimeout(function () { _setStatus('clear'); }, 3000);
        })
        .catch(function (e) {
          console.warn('[Cloud] cloudSave error:', e);
          _setStatus('error');
          setTimeout(function () { _setStatus('clear'); }, 4000);
        });
    }, 3000);
  };

  /**
   * 타구 기록/수정 시 updateAll() 에서 호출 — 디바운스 3초
   */
  window.cloudAutoSyncRecord = function () {
    if (!_online || !window.AS || !(AS.abs && AS.abs.length)) {
      if (!_online) _pendSync = true;
      return;
    }
    clearTimeout(_debTimer);
    _debTimer = setTimeout(function () {
      // 현재 자동저장 키 사용 (없으면 임시 키 생성)
      var key = window._autoKey || ('sl_auto_' + (window.AS && AS.curGame ? AS.curGame : Date.now()));
      var gameData = {
        abs:         AS.abs,
        hs:          AS.hs,
        as:          AS.as,
        ts:          Date.now(),
        th:          (document.getElementById('tHome') || {}).value || '홈팀',
        ta:          (document.getElementById('tAway') || {}).value || '원정팀',
        home_lineup: AS.home_lineup,
        away_lineup: AS.away_lineup,
        zoneHistory: AS.zoneHistory || {},
        pitchers:    AS.pitchers    || [],
        d:           new Date().toLocaleDateString('ko-KR')
      };
      _upsertGame(key, gameData)
        .then(function () {
          _setStatus('saved');
          setTimeout(function () { _setStatus('clear'); }, 2000);
        })
        .catch(function () {});
    }, 3000);
  };

  /* ── 앱 시작 ─────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (!_online) _setStatus('offline');
    // 다른 JS 초기화 완료 후 1.5초 뒤 시작
    setTimeout(_startupSync, 1500);
  });

})();
