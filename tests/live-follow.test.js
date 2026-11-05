// 학부모 실시간 링크 (js/features/livefollow.js · live.html · js/live.js · sql/16)
//  · ☰ 메뉴 → 창 → 「링크 만들고 중계 시작」 = live_put(새 id, 쓰기 열쇠, 요약) · 열쇠는 sl_live 에만, 링크엔 id 만
//  · 이름은 기본으로 가림(#등번호 · 김OO), 체크하면 실명 · 바뀐 게 없으면 다시 올리지 않음 · 「중계 끄기」 = end:true 를 마지막으로 올림
//  · 다른 열쇠(42501)면 중계를 멈추고 안내 · 보는 화면 liveHtml 은 글자를 이스케이프하고 끝 · 끊김 · 오래됨을 알려 준다
//  · 경기종료 = fin(경기 끝)만 올리고 링크는 그대로 — 그 뒤에 친 타석이 생길 때까지(새 경기 첫 타석 전) 끝난 경기를 그대로 둔다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$, srv = window.__srv;
  var id = 2e12;
  var pa = function (name, num, res, o) { return Object.assign({ id: ++id, bid: 'b-' + name, bname: name, bnum: num, team: 'home', res: res, rbi: 0, inn: '1회말' }, o || {}); };
  var puts = function () { return srv.log.filter(function (l) { return l.op === 'rpc' && l.fn === 'live_put'; }); };
  var h44 = function (el) { return el && el.getBoundingClientRect().height >= 44; };

  test('학부모 실시간 링크: 시작 · 이름 가림 · 바뀔 때만 올림 · 끄기(end) · 다른 열쇠면 멈춤', async function () {
    var keep = { abs: AS.abs, hs: AS.hs, as: AS.as, th: $('tHome').value, ta: $('tAway').value, gf: JSON.stringify(GF) };
    try {
      srv.reset(); localStorage.removeItem('sl_live');
      AS.abs = [pa('김타자', '7', '홈런', { rbi: 2 }), pa('이타자', '', '안타'), pa('이타자', '', '볼넷'), pa('상대', '', '삼진', { team: 'away', inn: '2회초' })];
      AS.hs = 2; AS.as = 0; $('tHome').value = '불꽃'; $('tAway').value = '번개'; GF.active = false;

      var mi = document.querySelector('.slm-item[onclick^="openLiveFollow"]');
      ok(mi && /학부모 실시간 링크/.test(mi.textContent), '☰ 메뉴에 학부모 실시간 링크');
      mi.click();
      ok($('liveOverlay') && $('liveOverlay').classList.contains('show'), '창이 열림');
      var nm = $('liveNames');
      ok(nm && !nm.checked, '「선수 실명 포함」 기본 꺼짐');
      ok(h44(nm.closest('label')) && h44($('liveStart')), '실명 줄 · 시작 버튼 44px 이상');

      $('liveStart').click();
      await T.sleep(50);
      var s = T.ls('sl_live');
      ok(s && /^[A-Za-z0-9]{12}$/.test(s.id) && s.key.length === 32 && s.on && !s.names, 'sl_live = 12자 id · 32자 열쇠 · 이름 가림 — ' + JSON.stringify(s));
      eq(puts().length, 1, '시작 = live_put 1번');
      var p = srv.live[s.id].payload;
      eq([p.th, p.ta, p.hs, p.as, p.h], ['불꽃', '번개', 2, 0, { home: 2, away: 0 }], '팀 · 점수 · 안타');
      eq(p.bat, [{ n: '#7', pa: 1, ab: 1, h: 1, rbi: 2 }, { n: '이OO', pa: 2, ab: 1, h: 1, rbi: 0 }], '우리 타자 = #등번호 · 성OO, 볼넷은 타수에서 뺌');
      eq(p.plays.map(function (x) { return x.n + ' ' + x.r; }), ['상OO 삼진', '이OO 볼넷', '이OO 안타', '#7 홈런'], '최근 타석 = 최신 먼저');
      ok(!/김타자|이타자/.test(JSON.stringify(p)), '실명이 올린 내용 어디에도 없음');
      ok(!JSON.stringify(srv.live[s.id].payload).includes(s.key), '열쇠는 내용에 없음');
      var url = $('liveUrl');
      ok(url && url.value.endsWith('live.html?g=' + s.id) && url.value.indexOf(s.key) < 0, '링크 = live.html?g=id (열쇠 없음) — ' + (url && url.value));
      ok(/중계 중/.test($('liveBody').textContent) && /이름 가림/.test($('liveBody').textContent), '상태 줄');
      ok(Array.prototype.every.call($('liveBody').querySelectorAll('.lv-btns .btn'), h44), '링크 보내기 · 중계 끄기 44px 이상');

      await slLive.tick();
      eq(puts().length, 1, '바뀐 게 없으면 올리지 않음');
      AS.abs.push(pa('김타자', '7', '2루타', { rbi: 1, inn: '3회말' })); AS.hs = 3;
      GF.active = true; GF.inning = 3; GF.half = 'bottom'; GF.outs = 1; GF.bases = [false, true, false];
      await slLive.tick();
      eq(puts().length, 2, '바뀌면 올림');
      p = srv.live[s.id].payload;
      eq([p.hs, p.st, p.bat[0].h], [3, { t: '3회말', o: 1, b: [0, 1, 0] }, 2], '점수 · 이닝 · 아웃 · 주자 · 타자 기록이 따라옴');

      srv.liveBusy = true; AS.hs = 4;
      await slLive.tick();
      ok(T.ls('sl_live') && !$('liveBody').querySelector('.lv-err'), '3초 제한(PT429)은 조용히 다음 차례에');
      srv.liveBusy = false;

      slLive.stop();
      await T.sleep(50);
      eq(T.ls('sl_live'), null, '끄면 sl_live 지움');
      ok(srv.live[s.id].payload.end === true, '마지막으로 end:true 를 올림');
      ok($('liveStart') && $('liveNames'), '꺼지면 다시 시작 화면');

      $('liveNames').checked = true;
      $('liveStart').click();
      await T.sleep(50);
      var s2 = T.ls('sl_live');
      ok(s2 && s2.id !== s.id && s2.names, '다시 켜면 새 링크');
      ok(/김타자/.test(JSON.stringify(srv.live[s2.id].payload.bat)), '실명 체크 → 실명');
      srv.live[s2.id].key = 'X'.repeat(32); AS.hs = 9;
      await slLive.tick();
      eq(T.ls('sl_live'), null, '다른 열쇠(42501)면 중계를 멈춤');
      ok(/이 폰에서 만든 것이 아니라/.test($('liveBody').textContent), '안내 — ' + $('liveBody').textContent);
    } finally {
      localStorage.removeItem('sl_live'); slLive.tick();   // 상태가 없으면 타이머도 멈춘다
      AS.abs = keep.abs; AS.hs = keep.hs; AS.as = keep.as; $('tHome').value = keep.th; $('tAway').value = keep.ta; Object.assign(GF, JSON.parse(keep.gf));
      if ($('liveOverlay')) closeOverlay('liveOverlay');
    }
  });

  test('학부모 보기 화면(live.js liveHtml): 점수 · 이닝 · 최근 타석 · 이스케이프 · 끝 · 끊김 · 오래됨 · 없음', async function () {
    var m = await import(new URL('js/live.js?v=2', location.href).href);
    var now = Date.parse('2026-11-05T10:00:00Z');
    var d = { at: '2026-11-05T09:59:40Z', payload: { th: '불꽃', ta: '<b>번개</b>', hs: 3, as: 1, h: { home: 4, away: 2 },
      st: { t: '5회말', o: 2, b: [1, 0, 1] }, ls: { away: [0, 1, 0, 0], home: [2, 0, 1] },
      plays: [{ t: '5회말', s: 'home', n: '#7', r: '2루타', rbi: 1 }, { t: '5회초', s: 'away', n: '<img src=x onerror=alert(1)>', r: '삼진', rbi: 0 }],
      bat: [{ n: '#7', pa: 3, ab: 3, h: 2, rbi: 1 }] } };
    var html = m.liveHtml(d, now), box = document.createElement('div');
    box.innerHTML = html;
    ok(!box.querySelector('img') && !box.querySelector('.lv-team b b'), '이름 · 팀 이름은 글자로만 (태그 안 됨)');
    ok(/&lt;img src=x/.test(html), '이스케이프');
    eq(Array.prototype.map.call(box.querySelectorAll('.lv-team b'), function (x) { return x.textContent; }), ['1', '3'], '원정 · 홈 점수');
    ok(/5회말/.test(box.querySelector('.lv-now').textContent) && /2아웃/.test(box.querySelector('.lv-now').textContent), '이닝 · 아웃');
    eq(box.querySelector('.lv-bases').getAttribute('aria-label'), '주자: 1루 · 3루', '주자');
    eq(box.querySelectorAll('.lv-ls thead th').length, 1 + 4 + 2, '이닝별 점수표 4이닝 + R H');
    eq(box.querySelectorAll('.lv-plays li').length, 2, '최근 타석');
    ok(/● 실시간/.test(box.textContent) && !box.querySelector('.lv-note'), '실시간 · 안내 없음');
    ok(/경기 끝/.test(m.liveHtml({ at: d.at, payload: Object.assign({}, d.payload, { end: true }) }, now)), '끝');
    ok(/연결이 끊겼어요/.test(m.liveHtml(d, now, true)), '끊김 → 지난 값 + 안내');
    ok(/한동안 소식이 없어요/.test(m.liveHtml(d, now + 20 * 60e3)), '15분 넘게 그대로면 안내');
    ok(/찾을 수 없어요/.test(m.liveHtml(null, now)), '없는 · 만료된 링크');
    ok(/R/.test(m.liveHtml({ at: d.at, payload: { hs: 0, as: 0 } }, now)), '이닝별 득점이 없어도 R H 는 그림');
    var fin = m.liveHtml({ at: d.at, payload: Object.assign({}, d.payload, { fin: 1 }) }, now + 60 * 60e3);
    box.innerHTML = fin;
    ok(/경기 끝/.test(box.querySelector('.lv-tag').textContent) && /최종 점수/.test(box.querySelector('.lv-now').textContent) && !box.querySelector('.lv-bases'),
      '경기 끝(fin) = 태그 · 「최종 점수」 (이닝 · 주자 대신)');
    ok(/이 링크에서 이어서/.test(fin) && /1분마다/.test(fin) && !/한동안 소식이 없어요/.test(fin), '다음 경기 안내 · 1시간이 지나도 「소식 없음」은 안 띄움');
    ok(!/이 링크에서 이어서/.test(m.liveHtml({ at: d.at, payload: Object.assign({}, d.payload, { fin: 1, end: true }) }, now)), '끈 링크(end)엔 다음 경기 안내 없음');
  });

  test('학부모 실시간 링크: 경기종료 → 「경기 끝」(fin) · 링크 그대로 · 새 경기 첫 타석 전엔 끝난 경기 그대로 · 첫 타석부터 이어서', async function () {
    var keep = { abs: AS.abs, hs: AS.hs, as: AS.as, th: $('tHome').value, ta: $('tAway').value, gf: JSON.stringify(GF) };
    var t0 = Date.now() - 6e5, k = 0;
    var old = function (name, res, o) { return pa(name, '', res, Object.assign({ id: t0 + (++k) }, o)); };   // 경기 끝 전에 친 타석 (id = 친 시각)
    try {
      srv.reset(); localStorage.removeItem('sl_live');
      AS.abs = [old('김타자', '홈런', { rbi: 1 }), old('상대', '삼진', { team: 'away', inn: '2회초' })];
      AS.hs = 1; AS.as = 0; $('tHome').value = '불꽃'; $('tAway').value = '번개';
      Object.assign(GF, { active: true, inning: 2, half: 'bottom', outs: 0, bases: [false, false, false] });
      openLiveFollow(); $('liveStart').click();
      await T.sleep(50);
      var s = T.ls('sl_live');
      ok(s && s.on && !s.fin, '중계 시작');

      gfEndGame(); await T.sleep(400);
      var ln = $('pgLiveNote');
      ok(ln && $('pgCard').contains(ln) && /「경기 끝」을 보냈어요/.test(ln.textContent), '경기 리포트 맨 아래 한 줄 (토스트는 리포트 밑에 깔림)');
      closePgReport(); await T.sleep(50);
      s = T.ls('sl_live');
      ok(s && s.on && s.fin > 0 && s.fid === String(AS.abs[0].id), '경기종료 → 링크는 그대로 · 경기 끝 표시 — ' + JSON.stringify(s));
      var p = srv.live[s.id].payload;
      ok(p.fin === 1 && !p.end && p.hs === 1 && p.ta === '번개', '학부모 화면에 「경기 끝」(fin) + 최종 점수');
      ok(/경기 끝을 보냈어요/.test($('liveBody').textContent), '창 상태 줄 — ' + $('liveBody').textContent);

      var n = puts().length;
      AS.abs = []; AS.hs = 0; AS.as = 0; $('tAway').value = '천둥';
      Object.assign(GF, { active: true, inning: 1, half: 'top', outs: 0 });
      await slLive.tick(); await slLive.tick(true);
      eq(puts().length, n, '새 경기 첫 타석 전 = 안 올림 (경기 운영을 다시 켜도)');
      eq([srv.live[s.id].payload.ta, srv.live[s.id].payload.hs, srv.live[s.id].payload.fin], ['번개', 1, 1], '학부모 화면엔 끝난 경기 그대로');
      AS.abs = [old('박타자', '안타')];
      await slLive.tick(true);
      eq(puts().length, n, '예전에 친 타석뿐인 경기(저장 목록에서 열어 봄)도 안 올림');

      AS.abs = [pa('최타자', '', '안타', { id: Date.now() })];   // 경기 끝(400ms 전)보다 늦게 친 타석
      await slLive.tick();
      eq(puts().length, n + 1, '새 경기 첫 타석 → 올림');
      p = srv.live[s.id].payload; s = T.ls('sl_live');
      ok(!p.fin && !p.end && p.ta === '천둥' && p.st.t === '1회초', '다음 경기가 같은 링크로 실시간 — ' + JSON.stringify([p.ta, p.st]));
      ok(s && s.on && !s.fin && !s.fid, '경기 끝 표시를 지움');

      await T.sleep(20);   // 경기 끝은 마지막 타석보다 늦다 (가상 시간은 그냥 두면 안 흐름)
      gfEndGame(); await T.sleep(400); closePgReport(); await T.sleep(50);
      AS.abs = []; $('tAway').value = '폭풍';
      slLive.stop();
      await T.sleep(50);
      p = srv.live[s.id].payload;
      ok(p.end === true && p.ta === '천둥', '경기 끝 → 새 경기 첫 타석 전에 끄면 끝난 경기에 end (새 경기 0:0 아님) — ' + p.ta);
    } finally {
      localStorage.removeItem('sl_live'); slLive.tick();
      AS.abs = keep.abs; AS.hs = keep.hs; AS.as = keep.as; $('tHome').value = keep.th; $('tAway').value = keep.ta; Object.assign(GF, JSON.parse(keep.gf));
      if ($('liveOverlay')) closeOverlay('liveOverlay');
    }
  });
})();
