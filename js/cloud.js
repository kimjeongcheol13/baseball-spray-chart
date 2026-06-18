/**
 * SprayLab Cloud Sync v3
 * 익명 인증 + Google OAuth + 이메일 매직링크 + 자동 클라우드 동기화 + 팀 기능
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
  var _team      = null;   // { id, code, name, owner_id, role: 'owner'|'member' }
  var _rtChannel = null;   // Realtime 채널

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
          '<div class="team-code-big" id="teamCodeDisplay">' + _team.code + '</div>' +
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
  function _upsertGame(key, gameData, teamId) {
    return _ensureAuth().then(function (user) {
      if (!user) return;
      var row = {
        user_id:    user.id,
        game_key:   key,
        team_name:  (gameData.th || '') + ' vs ' + (gameData.ta || ''),
        date:       gameData.d || null,
        data:       gameData,
        updated_at: new Date().toISOString()
      };
      if (teamId) row.team_id = teamId;
      return _client().from('user_games').upsert(row, { onConflict: 'user_id,game_key' }).then(function (r) {
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
        // 팀 정보 로드
        return _loadMyTeam();
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
    var remoteTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (!loc || remoteTs > (loc.ts || 0)) {
      localStorage.setItem(row.game_key, JSON.stringify(row.data));
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
      }, _team ? _team.id : null).then(function () {
        _setStatus('saved');
        setTimeout(function () { _setStatus('clear'); }, 2000);
      }).catch(function () {});
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
    db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
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
    db.from('teams').select('*').eq('code', code).single().then(function (r) {
      if (r.error || !r.data) { msgEl.textContent = '팀 코드를 찾을 수 없어요'; msgEl.className = 'magic-msg error'; return; }
      var team = r.data;
      if (team.owner_id === _user.id) { msgEl.textContent = '내가 만든 팀이에요'; msgEl.className = 'magic-msg error'; return; }
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
  document.addEventListener('DOMContentLoaded', function () {
    if (!_online) _setStatus('offline');
    var db = _client();
    if (db) _initAuthListener();
    setTimeout(_startupSync, 1500);
  });

})();
