// 리포트·엑셀 표현 4단계 검증 (xlsxreport.js) + 3단계 남은 2건(core.js 필드 방향 레이블 · 경기 날짜순)
//  · 빈 열 숨김(타구속도 · 발사각 · 타구 유형) · 타구 유형은 내보낼 때 결과 이름에서(직접 입력 우선) · 핫/콜드 3타수 미만 = 안타/타수만
//  · 차트: 타구 점마다 타석 번호 라벨 · 투구 위치 코스만 = 속 빈 원(별도 시리즈) + 범례 '코스만(칸 안 임의 위치)'
//  · 주요 분석 규칙 a~d(표본 기준 미달 줄 생략 · 줄 끝 n) · 투수별 성적 · 데이터 설명 시트(맨 뒤) · 요약표 SUBTOTAL 수식(필터 연동)
//  · 5단계: 주요 분석 확정 기준(방향 10개 · 2S 개수만 · n < 10 이면 % 없음) · 등번호 빈칸 유지 · APP_VERSION · 투수 엑셀 데이터 설명
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function snapLS() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }
  function restoreLS(o) {
    var now = []; for (var i = 0; i < localStorage.length; i++) now.push(localStorage.key(i));
    now.forEach(function (k) { if (!(k in o)) localStorage.removeItem(k); });
    Object.keys(o).forEach(function (k) { if (localStorage.getItem(k) !== o[k]) localStorage.setItem(k, o[k]); });
  }
  // 저장 경기만 쓰는 테스트 — 현재 경기(AS.abs)는 비우고 끝나면 localStorage 까지 통째로 되돌린다
  function run(name, fn) {
    test(name, async function () {
      var S = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, batter: AS.batter, pitchers: AS.pitchers, ls: snapLS() };
      var sync0 = window.cloudAutoSyncRecord, cs0 = window.cloudSave;
      window.cloudAutoSyncRecord = function () {}; window.cloudSave = function () {};
      try {
        AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.batter = null; AS.pitchers = [];
        await fn();
      } finally {
        AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.batter = S.batter; AS.pitchers = S.pitchers;
        restoreLS(S.ls);
        window.cloudAutoSyncRecord = sync0; window.cloudSave = cs0;
      }
    });
  }
  function xy(deg, dist) { var ang = deg * Math.PI / 180 - Math.PI; dist = dist || 0.6; return { x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist }; }
  var id0 = 77000;
  function ab(bid, bname, res, deg, inn, extra) {
    var p = deg == null ? { x: null, y: null } : xy(deg);
    return Object.assign({ id: ++id0, bid: bid, bname: bname, bnum: '', team: 'home', res: res, pt: null, zone: null, rbi: 0,
      x: p.x, y: p.y, deg: deg, dir: null, ft: deg == null ? null : 300, inn: inn || '1회말', ts: '10:00', count: { b: 0, s: 0, o: 0 }, pitches: [] }, extra || {});
  }
  function Q(pt, zone, result, pitcher, pos) { return { pt: pt, zone: zone, x: pos ? pos[0] : null, y: pos ? pos[1] : null, result: result, pitcher: pitcher || '' }; }
  function stored(key, g) {
    localStorage.setItem(key, JSON.stringify(g));
    localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(localStorage.getItem('sl_saves') || '[]')).concat([{ key: key, label: g.th + ' vs ' + g.ta, ts: g.ts }])));
  }
  function game(key, date, ts, lineup, abs, pitchers) {
    stored(key, { th: '우리', ta: '상대' + key.slice(-1), d: date, ts: ts, home_lineup: lineup, away_lineup: [], pitchers: pitchers || [], abs: abs });
  }
  // 무압축(STORE) xlsx → { files: 경로 → 글자, sheets: 시트 이름 → [[값]] , xml: 시트 이름 → 시트 XML }
  async function readZip(blob) {
    var u8 = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u8.buffer), files = {}, i = 0, dec = new TextDecoder();
    while (i + 30 <= u8.length && dv.getUint32(i, true) === 0x04034b50) {
      var size = dv.getUint32(i + 18, true), nl = dv.getUint16(i + 26, true), xl = dv.getUint16(i + 28, true);
      files[dec.decode(u8.subarray(i + 30, i + 30 + nl))] = dec.decode(u8.subarray(i + 30 + nl + xl, i + 30 + nl + xl + size));
      i += 30 + nl + xl + size;
    }
    var P = new DOMParser(), sheets = {}, xml = {};
    var wb = P.parseFromString(files['xl/workbook.xml'], 'application/xml');
    [].forEach.call(wb.getElementsByTagName('sheet'), function (sh, k) {
      var src = files['xl/worksheets/sheet' + (k + 1) + '.xml'];
      xml[sh.getAttribute('name')] = src;
      sheets[sh.getAttribute('name')] = [].map.call(P.parseFromString(src, 'application/xml').getElementsByTagName('row'), function (row) {
        var r = [];
        [].forEach.call(row.getElementsByTagName('c'), function (c) {
          var col = c.getAttribute('r').replace(/\d+/g, ''), ci = 0;
          for (var j = 0; j < col.length; j++) ci = ci * 26 + col.charCodeAt(j) - 64;
          var t = c.getElementsByTagName('t')[0], v = c.getElementsByTagName('v')[0];
          r[ci - 1] = t ? t.textContent : v ? (c.getAttribute('t') === 'str' ? v.textContent : +v.textContent) : '';
        });
        return r;
      });
    });
    return { files: files, sheets: sheets, xml: xml, names: [].map.call(wb.getElementsByTagName('sheet'), function (s) { return s.getAttribute('name'); }) };
  }
  // 내보내기 → { wb: 파일, sheets: Sheet 객체 배열, texts: 캔버스에 쓴 글자(핫/콜드 그림) }
  async function exportOf(name) {
    var B = await import('/js/features/batdata.js?v=10'), X = await import('/js/features/xlsxreport.js?v=14');
    var blob = null, u0 = URL.createObjectURL, ft0 = CanvasRenderingContext2D.prototype.fillText, texts = [];
    URL.createObjectURL = function (b) { blob = b; return u0.call(URL, b); };
    CanvasRenderingContext2D.prototype.fillText = function (t) { texts.push(String(t)); return ft0.apply(this, arguments); };
    var sheets;
    try { sheets = X.exportBatterXlsx(B.playerData(B.buildData(), name)); } finally { URL.createObjectURL = u0; CanvasRenderingContext2D.prototype.fillText = ft0; }
    ok(blob, name + ' 엑셀 생성');
    return { wb: await readZip(blob), sheets: sheets, texts: texts };
  }
  function rowsAfter(rows, title, n) {
    var i = rows.findIndex(function (r) { return r && r[0] === title; });
    return i < 0 ? null : rows.slice(i + 1, i + 1 + n);
  }
  function chartWith(files, title) {
    return Object.keys(files).filter(function (k) { return /^xl\/charts\/chart\d+\.xml$/.test(k); }).map(function (k) { return files[k]; })
      .find(function (x) { return x.indexOf('<a:t>' + title + '</a:t>') >= 0; });
  }

  // ── 정타자 픽스처: 우타 · 등번호 9 · 3경기 12타석 (모든 공 결과 = B-S 자동 10타석 · 2스트라이크 6타석 · 결정구 존 밖 5/12 · 당겨 6/8) ──
  var KIM = '김투수', PARK = '박투수';
  function jungFixture() {
    var L = [{ id: 'j1', name: '정타자', num: '9', pos: '', bh: 'R' }];
    var J = function (res, deg, inn, extra) { return ab('j1', '정타자', res, deg, inn, extra); };
    game('sl_900000000071', '2026. 6. 28.', 1792000000000, L, [
      J('삼진', null, '1회말', { pitches: [Q('직구', '중앙 높음', 'called_strike', KIM, [0.5, 0.3]), Q('슬라이더', '외각 낮음', 'swinging_strike', KIM), Q('직구', '볼 위', 'ball', KIM), Q('포크볼', '볼 아래', 'swinging_strike', KIM, [0.55, 0.93])] }),
      J('안타', 40, '3회말', { pitches: [Q('직구', '내각 중간', 'ball', KIM), Q('직구', '중앙 중간', 'in_play', KIM, [0.48, 0.52])] }),
      J('땅볼 아웃', 35, '5회말', { pitches: [Q('슬라이더', '외각 중간', 'called_strike', KIM), Q('커브', '볼 아래', 'foul', KIM), Q('직구', '내각 낮음', 'in_play', KIM, [0.3, 0.75])] }),
      J('볼넷', null, '7회말', { pitches: [Q('직구', '볼 위', 'ball', KIM), Q('직구', '볼 외', 'ball', KIM), Q('슬라이더', '중앙 낮음', 'called_strike', KIM), Q('직구', '볼 내', 'ball', KIM), Q('커브', '볼 아래', 'ball', KIM, [0.45, 0.95])] }),
    ]);
    game('sl_900000000072', '2026. 7. 5.', 1792600000000, L, [
      J('플라이 아웃', 60, '1회말', { pitches: [Q('직구', '중앙 높음', 'foul', PARK), Q('직구', '중앙 높음', 'swinging_strike', PARK), Q('직구', '볼 위', 'in_play', PARK, [0.5, 0.06])] }),
      J('2루타', 30, '3회말', { pitches: [Q('체인지업', '외각 낮음', 'ball', PARK), Q('직구', '중앙 중간', 'in_play', PARK, [0.52, 0.47])] }),
      J('삼진', null, '5회말', { pitches: [Q('직구', '외각 높음', 'called_strike', PARK), Q('직구', '외각 높음', 'foul', PARK), Q('슬라이더', '볼 외', 'swinging_strike', PARK, [0.9, 0.6])] }),
      J('안타', 50, '7회말', { pitches: [Q('슬라이더', '볼 아래', 'foul', PARK), Q('직구', '볼 위', 'foul', PARK), Q('커브', '내각 낮음', 'in_play', PARK)] }),
    ]);
    game('sl_900000000073', '2026. 7. 12.', 1793200000000, L, [
      J('땅볼 아웃', 80, '1회말', { pt: '직구', zone: '중앙 낮음' }),
      J('플라이 아웃', 100, '3회말', { ev: 135, launchAngle: 32, launchType: '플라이볼', pitches: [Q('직구', '중앙 중간', 'in_play', KIM)] }),
      J('안타', 45, '5회말', { ev: 150, launchAngle: 15, launchType: '라인드라이브',
        pitches: [Q('커브', '중앙 낮음', 'ball', KIM), Q('커브', '중앙 낮음', 'called_strike', KIM), Q('직구', '외각 중간', 'ball', KIM), Q('직구', '중앙 높음', 'foul', KIM), Q('직구', '중앙 높음', 'in_play', KIM, [0.5, 0.3])] }),
      J('삼진', null, '7회말', { count: { b: 0, s: 2, o: 1 }, pitches: [Q('직구', '중앙 높음', null, KIM), Q('슬라이더', '외각 낮음', 'swinging_strike', KIM), Q('포크볼', '볼 아래', 'swinging_strike', KIM)] }),
    ]);
  }

  run('빈 열 숨김: 타구속도 · 발사각 · 타구 유형은 값이 하나도 없으면 숨김(열 위치 그대로) · 타구 유형은 결과 이름에서, 직접 입력(발사각) 우선', async function () {
    var L = [{ id: 'h1', name: '숨김타자', num: '3', bh: 'R' }, { id: 'h2', name: '빈유형', num: '4', bh: 'R' }];
    game('sl_900000000061', '2026. 5. 3.', 1790000000000, L, [
      ab('h1', '숨김타자', '땅볼 아웃', 100, '1회말'), ab('h1', '숨김타자', '플라이 아웃', 60, '3회말'), ab('h1', '숨김타자', '라이너 아웃', 90, '5회말'),
      ab('h1', '숨김타자', '안타', 40, '7회말'), ab('h1', '숨김타자', '병살', 80, '8회말'),
      ab('h2', '빈유형', '안타', 40, '1회말'), ab('h2', '빈유형', '삼진', null, '3회말')]);
    var r = await exportOf('숨김타자');
    var rec = r.wb.sheets['타석 기록'];
    eq(rec[0].slice(8, 11), ['타구속도', '발사각', '타구 유형'], '열 위치 그대로');
    eq(rec.slice(1).map(function (x) { return x[10] === undefined ? '' : x[10]; }), ['땅볼', '플라이', '라이너', '', ''], '결과 이름에서 땅볼 · 플라이 · 라이너, 그 외 빈칸');
    ok(/<col min="9" max="9"[^>]*hidden="1"\/>/.test(r.wb.xml['타석 기록']) && /<col min="10" max="10"[^>]*hidden="1"\/>/.test(r.wb.xml['타석 기록']), '타구속도 · 발사각 열 hidden');
    ok(!/<col min="11" max="11"[^>]*hidden="1"\/>/.test(r.wb.xml['타석 기록']), '타구 유형은 값이 있어 보임');
    var r2 = await exportOf('빈유형');
    ok(/<col min="11" max="11"[^>]*hidden="1"\/>/.test(r2.wb.xml['타석 기록']), '타구 유형도 전부 비면 숨김');
    eq(r2.wb.sheets['타석 기록'][0][10], '타구 유형', '숨겨도 머리글은 그대로(삭제 아님)');
    var dict = r.wb.sheets['데이터 설명'];
    ok(dict.some(function (x) { return x[1] === '타구속도' && /숨긴 열: 타구속도 · 발사각/.test(x[2]); }), '데이터 설명에 숨긴 열 안내');
  });

  run('타구 유형: 발사각 입력값(앱이 정한 유형)이 결과 이름보다 우선 · 이름은 땅볼/라이너/플라이로 통일 · 값 있으면 열 보임', async function () {
    var L = [{ id: 'k1', name: '입력타자', num: '', bh: 'L' }];
    game('sl_900000000062', '2026. 5. 4.', 1790000000000, L, [
      ab('k1', '입력타자', '땅볼 아웃', 100, '1회말', { ev: 140, launchAngle: 18, launchType: '라인드라이브' }),
      ab('k1', '입력타자', '안타', 40, '3회말', { launchAngle: 30, launchType: '플라이볼' }), ab('k1', '입력타자', '플라이 아웃', 60, '5회말')]);
    var r = await exportOf('입력타자');
    var rec = r.wb.sheets['타석 기록'];
    var u = function (v) { return v === undefined ? '' : v; };
    eq(rec.slice(1).map(function (x) { return [u(x[8]), u(x[9]), u(x[10])]; }), [[140, 18, '라이너'], ['', 30, '플라이'], ['', '', '플라이']], '직접 입력 우선 · 이름 통일');
    ok(!/hidden="1"/.test(r.wb.xml['타석 기록'].split('</cols>')[0]), '값이 있으면 숨기지 않음');
    ok(!/등번호/.test(r.wb.sheets['리포트'][1][0]), '등번호 칸이 비면 부제목에 등번호 없음 — ' + r.wb.sheets['리포트'][1][0]);
  });

  run('핫/콜드: 3타수 미만 칸은 타율(.000) 대신 안타/타수 · 색 없음 — 3타수 이상만 타율', async function () {
    var L = [{ id: 'z1', name: '존타자', num: '8', bh: 'R' }];
    game('sl_900000000063', '2026. 5. 5.', 1790000000000, L, [
      ab('z1', '존타자', '삼진', null, '1회말', { pt: '직구', zone: '내각 높음' }),
      ab('z1', '존타자', '안타', 40, '2회말', { pt: '직구', zone: '중앙 중간' }), ab('z1', '존타자', '땅볼 아웃', 80, '3회말', { pt: '직구', zone: '중앙 중간' }),
      ab('z1', '존타자', '플라이 아웃', 60, '4회말', { pt: '직구', zone: '중앙 중간' }), ab('z1', '존타자', '볼넷', null, '5회말', { pt: '직구', zone: '볼 위' })]);
    var r = await exportOf('존타자');
    var hz = r.sheets.find(function (s) { return s.name === '핫콜드존'; });
    ok(hz.images.length === 1, '스트라이크존 그림');
    ok(r.texts.indexOf('0/1') >= 0, '1타수 칸 = 0/1 — ' + r.texts.join(','));
    ok(r.texts.indexOf('.333') >= 0, '3타수 칸 = 타율 .333');
    ok(r.texts.indexOf('.000') < 0, '3타수 미만 칸에 .000 없음');
    ok(r.texts.some(function (t) { return /1타석 · 3타수 미만/.test(t); }), '아래 줄 = 타석 · 3타수 미만');
  });

  run('차트: 타구 점마다 타석 번호 라벨 · 투구 위치 코스만 = 속 빈 원(별도 시리즈) · 정확 = 채운 원 · 범례 코스만(칸 안 임의 위치)', async function () {
    jungFixture();
    var r = await exportOf('정타자');
    var c1 = chartWith(r.wb.files, '결과별 타구');
    ok(c1, '결과별 타구 차트');
    var labels = [], re = /<c:dLbl><c:idx val="(\d+)"\/>.*?<a:t>([^<]*)<\/a:t>/g, m;
    while ((m = re.exec(c1))) labels.push([+m[1] + 1, m[2]]);
    labels.sort(function (a, b) { return a[0] - b[0]; });
    eq(labels.map(function (x) { return x[1]; }), ['2', '3', '5', '6', '8', '9', '10', '11'], '좌표 있는 타석만, 라벨 = 타석 번호');
    ok(labels.every(function (x) { return String(x[0]) === x[1]; }), '라벨이 그 행(타석 번호)의 점에 붙음');
    var c2 = chartWith(r.wb.files, '구종별 투구 위치');
    ok(c2, '구종별 투구 위치 차트');
    var ser = function (name) { var i = c2.indexOf('<c:v>' + name + '</c:v>'); return i < 0 ? '' : c2.slice(i, c2.indexOf('</c:ser>', i)); };
    ok(/<c:marker><c:symbol val="circle"\/><c:size val="7"\/><c:spPr><a:solidFill>/.test(ser('직구')), '정확 = 채운 원');
    ok(/<c:marker><c:symbol val="circle"\/><c:size val="7"\/><c:spPr><a:noFill\/><a:ln/.test(ser('직구 · 코스만')), '코스만 = 속 빈 원(테두리만)');
    ok(/<c:marker><c:symbol val="circle"\/>.*<a:noFill\/><a:ln/.test(ser('코스만(칸 안 임의 위치)')), '범례용 코스만 시리즈');
    var leg = c2.slice(c2.indexOf('<c:legend>'), c2.indexOf('</c:legend>'));
    var names = (c2.match(/<c:tx><c:v>[^<]*<\/c:v><\/c:tx>/g) || []).map(function (s) { return s.replace(/<[^>]+>/g, ''); });
    var hidden = (leg.match(/<c:legendEntry><c:idx val="(\d+)"\/><c:delete val="1"\/><\/c:legendEntry>/g) || []).map(function (s) { return +/val="(\d+)"/.exec(s)[1]; });
    var shown = names.filter(function (n, i) { return hidden.indexOf(i) < 0; });
    ok(shown.indexOf('코스만(칸 안 임의 위치)') >= 0 && shown.indexOf('직구') >= 0 && shown.indexOf('직구 · 코스만') < 0, '범례: 구종 + 코스만 하나 — ' + shown.join(','));
    var pit = r.wb.sheets['투구 기록'];
    var nExact = pit.slice(1).filter(function (x) { return x[8] === '정확'; }).length, nZo = pit.slice(1).filter(function (x) { return x[8] === '코스만'; }).length;
    eq([nExact, nZo], [9, 26], '정확 9 · 코스만 26 (투구 기록 위치 기록 열)');
  });

  run('주요 분석(5단계 확정 기준): 수치만 · 줄 끝 n · 평가어 없음 · 방향은 10개부터 · 2S 이후는 개수만 · n < 10 이면 % 없음 / 표본 미달 줄 생략', async function () {
    jungFixture();
    var r = await exportOf('정타자');
    var hz = r.wb.sheets['핫콜드존'];
    var lines = rowsAfter(hz, '■ 주요 분석', 4).map(function (x) { return x && x[0]; });
    eq(lines.slice(0, 3), [
      '• 볼넷 1/12 (8.3%) · 삼진 3/12 (25.0%) — 삼진이 16.7%p 많음 · n = 12타석',
      '• 결정구 존 밖 5/12 (41.7%) — 그 타석 결과: 안타 0 · 삼진 3 · 볼넷 1 · 그 외 1 · n = 12 코스 기록 타석',
      '• 2S 이후 6타석: 안타 2·삼진 2·볼넷 0·그 외 2 (B-S 자동 계산 타석만) · n = 6타석',
    ], '3줄 — 방향 기록 8개(< 10)라 쏠림 줄 없음 · 2S 이후는 개수만');
    ok(!/%|타율/.test(lines[2]), '2S 이후(n = 6 < 10): 비율 없음');
    ok(/^표본 기준 — .*방향 기록 10개 이상.*2스트라이크까지 간 타석 5개 이상\(개수만\).*10 미만이면 %를 쓰지 않아요/.test(lines[3]), '표본 기준 안내 — ' + lines[3]);
    var all = hz.map(function (x) { return (x || []).join(' '); }).join('\n');
    ok(!/강점|약점|강한 코스|약한 코스/.test(all), '평가어 없음');
    // 표본 미달: 9타석 · 방향 기록 6개 중 3/3 동률 → 쏠림 줄 없음
    var L = [{ id: 's1', name: '소표본', num: '2', bh: 'R' }];
    game('sl_900000000064', '2026. 5. 6.', 1790000000000, L, [
      ab('s1', '소표본', '안타', 40), ab('s1', '소표본', '안타', 40, '2회말'), ab('s1', '소표본', '안타', 40, '3회말'),
      ab('s1', '소표본', '안타', 90, '4회말'), ab('s1', '소표본', '안타', 90, '5회말'), ab('s1', '소표본', '안타', 90, '6회말'),
      ab('s1', '소표본', '삼진', null, '7회말'), ab('s1', '소표본', '삼진', null, '8회말'), ab('s1', '소표본', '삼진', null, '9회말')]);
    var s = await exportOf('소표본');
    eq(rowsAfter(s.wb.sheets['핫콜드존'], '■ 주요 분석', 1)[0][0], '• 아래 표본 기준을 넘는 항목이 아직 없어요.', '기준 미달이면 억지 문장 없이 한 줄');
  });

  run('주요 분석 방향 쏠림 기준: 방향 기록 9개는 줄 없음 · 10개부터 줄(이때만 %) — 1위 하나 · 50% 이상 조건은 그대로', async function () {
    var L = [{ id: 'd1', name: '방향9', num: '', bh: 'R' }, { id: 'd2', name: '방향10', num: '', bh: 'R' }];
    var list = [];
    for (var i = 0; i < 9; i++) list.push(ab('d1', '방향9', '안타', 40, (i + 1) + '회말'));
    list.push(ab('d1', '방향9', '삼진', null, '연장'));
    for (var j = 0; j < 7; j++) list.push(ab('d2', '방향10', '안타', 40, (j + 1) + '회말'));
    list.push(ab('d2', '방향10', '안타', 90, '8회말'), ab('d2', '방향10', '안타', 90, '9회말'), ab('d2', '방향10', '안타', 140, '연장'));
    game('sl_900000000066', '2026. 5. 8.', 1790000000000, L, list);
    var ins = function (wb) { return rowsAfter(wb.sheets['핫콜드존'], '■ 주요 분석', 3).map(function (x) { return x && x[0]; }); };
    var a = ins((await exportOf('방향9')).wb);
    ok(a.every(function (t) { return !/타구 방향/.test(t || ''); }), '9개 — 쏠림 줄 없음: ' + a.join(' / '));
    eq(a[0], '• 볼넷 0/10 (0.0%) · 삼진 1/10 (10.0%) — 삼진이 10.0%p 많음 · n = 10타석', '볼넷·삼진 줄은 10타석부터 %');
    var b = ins((await exportOf('방향10')).wb);
    eq(b.filter(function (t) { return /타구 방향/.test(t || ''); }), ['• 타구 방향 당겨치기 쏠림 — 당겨치기 7/10 (70.0%) · 센터 2/10 (20.0%) · 밀어치기 1/10 (10.0%) · n = 10 방향 기록'], '10개 — 줄 + %');
  });

  run('투수별 성적(리포트): 투수가 연결된 타석만 · 투수 · 타석 · 타수 · 안타 · 삼진 · 볼넷 · 타율 / 투수 기록 없으면 표 생략', async function () {
    jungFixture();
    var r = await exportOf('정타자');
    var rep = r.wb.sheets['리포트'];
    var hi = rep.findIndex(function (x) { return x && x[0] === '■ 투수별 성적'; });
    ok(hi > 0, '표 있음');
    eq(rep[hi][3], '투수가 연결된 11타석 / 전체 12타석', '연결 타석 수');
    eq(rep[hi + 1].slice(0, 7), ['투수', '타석', '타수', '안타', '삼진', '볼넷', '타율'], '머리글');
    eq(rep.slice(hi + 2, hi + 4).map(function (x) { return [x[0], x[1], x[2], x[3], x[4], x[5], Math.round(x[6] * 1000)]; }),
      [['김투수', 7, 6, 2, 2, 1, 333], ['박투수', 4, 4, 2, 1, 0, 500]], '투수별 값');
    ok(rep.findIndex(function (x) { return x && x[0] === '■ 구종별 성적'; }) < hi && hi < rep.findIndex(function (x) { return x && x[0] === '■ 경기별 기록'; }), '구종별 성적 다음 · 경기별 기록 앞');
    var L = [{ id: 'n1', name: '무투수', num: '1', bh: 'R' }];
    game('sl_900000000065', '2026. 5. 7.', 1790000000000, L, [ab('n1', '무투수', '안타', 40, '1회말', { pt: '직구', zone: '중앙 중간' })]);
    var n = await exportOf('무투수');
    ok(!n.wb.sheets['리포트'].some(function (x) { return x && x[0] === '■ 투수별 성적'; }), '투수 기록 없으면 생략');
  });

  run('시트 순서 그대로 + 데이터 설명 맨 뒤: wOBA 가중치 = 코드 값 · 확인 필요 7종 · 앱 버전/생성일/URL · 부제목 등번호', async function () {
    jungFixture();
    var r = await exportOf('정타자');
    eq(r.wb.names, ['리포트', '타구 차트', '투구 위치', '핫콜드존', '타석 기록', '투구 기록', '차트 배경', '데이터 설명'], '시트 순서');
    ok(/^등번호 9  ·  우타/.test(r.wb.sheets['리포트'][1][0]), '부제목 — ' + r.wb.sheets['리포트'][1][0]);
    var d = r.wb.sheets['데이터 설명'], C = await import('/js/constants.js');
    var row = function (a, b) { return d.find(function (x) { return x && x[0] === a && (b == null || x[1] === b); }); };
    var W = C.WOBA_W;
    eq(W, { bb: 0.690, hbp: 0.722, s1: 0.888, s2: 1.271, s3: 1.616, hr: 2.101 }, 'WOBA_W = FanGraphs Guts 2013 원표 3자리');
    eq(row('가중치')[2], '볼넷 0.690 · 사구 0.722 · 단타 0.888 · 2루타 1.271 · 3루타 1.616 · 홈런 2.101', 'wOBA 가중치 = WOBA_W(3자리)');
    eq(row('출처')[2], 'FanGraphs Guts 2013시즌 선형 가중치 (fangraphs.com/guts.aspx?type=cn)', '출처(사용자가 원표로 대조해 확정)');
    eq(row('기준')[2], 'MLB 기준 선형 가중치이며 아마추어 환경 보정은 하지 않음', 'MLB 기준 안내 한 줄');
    var w7 = d.slice(d.findIndex(function (x) { return x && x[0] === '■ 확인 필요 (7종)'; }) + 2).slice(0, 7).map(function (x) { return x[1]; });
    eq(w7, ['삼진인데 스트라이크 n개', '볼넷인데 볼 n개', '(결과)인데 마지막 공이 …', '삼진/볼넷인데 마지막 공이 인플레이', '투구 결과 일부 누락', '초/말 섞임', '같은 이닝 3타석 이상'], '7종 이름');
    ok(/^\d{4}\.\d{2}\.\d{2}$/.test(APP_VERSION), 'APP_VERSION 날짜형 — ' + APP_VERSION);
    eq(row('앱 버전')[3], APP_VERSION, '앱 버전 = core.js APP_VERSION');
    ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(row('생성일')[3]), '생성일');
    eq(row('앱')[3], 'https://kimjeongcheol13.github.io/baseball-spray-chart/', '앱 URL');
    eq(row('선수')[3], '등번호 9', '등번호');
    ok(/라인업 순서 번호가 자동으로/.test(row('선수')[2]), '빈 칸이면 자동 번호라는 안내');
  });

  run('필터 연동: 타구 차트 · 투구 위치 요약표는 SUBTOTAL 수식(처음 값 = 필터 없는 값) · 리포트는 고정 값 · 다시 계산 지시', async function () {
    jungFixture();
    var r = await exportOf('정타자');
    var spr = r.sheets.find(function (s) { return s.name === '타구 차트'; }), loc = r.sheets.find(function (s) { return s.name === '투구 위치'; });
    var cells = function (sh) { var out = []; sh.rows.forEach(function (m, ri) { m.forEach(function (c, ci) { if (c.v && typeof c.v === 'object' && c.v.f) out.push({ r: ri, c: ci, f: c.v.f, v: c.v.v }); }); }); return out; };
    var sf = cells(spr), lf = cells(loc);
    ok(sf.length >= 11 && sf.every(function (x) { return /SUBTOTAL\((109|102),'타석 기록'!/.test(x.f); }), '타구 차트 수식 ' + sf.length + '개 — 타석 기록 범위');
    ok(lf.length >= 15 && lf.every(function (x) { return /SUBTOTAL\(109,'투구 기록'!/.test(x.f); }), '투구 위치 수식 ' + lf.length + '개 — 투구 기록 범위');
    var t = r.wb.sheets['타구 차트'];
    var dirRow = rowsAfter(t, '■ 타구 방향', 2)[1];
    eq(dirRow.slice(0, 4).map(function (v) { return Math.round(v * 1000) / 1000; }), [0.75, 0.25, 0, 8], '방향 처음 값');
    eq(rowsAfter(t, '■ 결과별 타구 수', 2)[1].slice(0, 4), [3, 1, 0, 4], '결과별 처음 값');
    ok(/<f>SUBTOTAL\(102,'타석 기록'!\$[A-Z]+\$2:\$[A-Z]+\$13\)<\/f><v>3<\/v>/.test(r.wb.xml['타구 차트']), '파일에 수식 + 처음 값');
    ok(/<calcPr calcId="\d+" fullCalcOnLoad="1"\/>/.test(r.wb.files['xl/workbook.xml']), '열 때 다시 계산');
    ok(t.some(function (x) { return x && /필터\(▼\)를 걸면 이 차트와 위 표/.test(String(x[0])); }), '타구 차트 안내 = 표도 바뀜(수식이라 사실)');
    var rep = r.sheets.find(function (s) { return s.name === '리포트'; });
    eq(cells(rep).length, 0, '리포트는 고정 값(수식 없음)');
    ok(r.wb.sheets['데이터 설명'].some(function (x) { return x && x[0] === '안 따름' && /고정 값/.test(x[2]); }), '데이터 설명: 리포트 · 핫콜드존은 필터를 안 따름');
  });

  run('필드 방향 레이블(3단계 남은 건): 선택 타자 좌/우타 기준 — 좌타 = 오른쪽 당겨치기 · 스위치 = 좌/중/우 · 미지정 = 우타 가정 · 타자 바꾸면 다시 그림', async function () {
    var ov = _fieldOv.dir, ft0 = CanvasRenderingContext2D.prototype.fillText, got = [];
    CanvasRenderingContext2D.prototype.fillText = function (t, x) { if (this === fCtx) got.push([String(t), x]); return ft0.apply(this, arguments); };
    var labs = function () { return got.filter(function (g) { return /^(당겨치기|센터|밀어치기|좌|중|우)$/.test(g[0]); }).sort(function (a, b) { return a[1] - b[1]; }).map(function (g) { return g[0]; }); };
    try {
      if (!fCtx) initCanvas();   // 기록 탭을 열 때 만들어지는 필드 캔버스(테스트 첫 화면에선 아직 없음)
      ok(fCtx && FS > 0, '필드 캔버스');
      eq(drawField.name, 'paperDrawField', '실제 화면 필드는 종이 테마(scorebook.js)가 그린다');
      _fieldOv.dir = true;
      AS.batter = { id: 'f1', name: '좌타', bh: 'L' }; got = []; drawField();
      eq(labs(), ['밀어치기', '센터', '당겨치기'], '좌타: 왼쪽(3루 쪽) = 밀어치기');
      AS.batter = { id: 'f2', name: '스위치', bh: 'S' }; got = []; _fieldDirSync();
      eq(labs(), ['좌', '중', '우'], '스위치: 필드 기준 · 타자 바뀌면 다시 그림');
      AS.batter = { id: 'f3', name: '모름', bh: '' }; got = []; _fieldDirSync();
      eq(labs(), ['당겨치기', '센터', '밀어치기'], '미지정 = 우타 가정');
      got = []; _fieldDirSync();
      eq(labs(), [], '같은 좌/우타면 다시 그리지 않음');
      // 타자가 정해지지 않은 그림(분석 탭 방향도 · 이미지 저장)은 필드 기준 좌/중/우
      var other = [], cv = document.createElement('canvas'), oc;
      cv.width = cv.height = 300; oc = cv.getContext('2d');
      CanvasRenderingContext2D.prototype.fillText = function (t, x) { if (this === oc) other.push([String(t), x]); return ft0.apply(this, arguments); };
      AS.batter = { id: 'f4', name: '좌타2', bh: 'L' };
      window.sbPaint.field(oc, 300);
      eq(other.filter(function (g) { return /^(당겨치기|센터|밀어치기|좌|중|우)$/.test(g[0]); }).sort(function (a, b) { return a[1] - b[1]; }).map(function (g) { return g[0]; }), ['좌', '중', '우'], '분석 탭 방향도 = 필드 기준');
    } finally {
      CanvasRenderingContext2D.prototype.fillText = ft0; _fieldOv.dir = ov; AS.batter = null; drawField();
    }
  });

  run('전체 경기 엑셀 순서(3단계 남은 건): 저장 순서가 아니라 경기 날짜 오래된 순(경기 정보 날짜 → 저장 날짜 → 저장 시각)', async function () {
    stored('sl_900000000081', { th: 'A', ta: '6월7일', d: '2026. 6. 7.', ts: 1790000000000, abs: [] });
    stored('sl_900000000082', { th: 'A', ta: '6월21일', d: '2026. 6. 21.', ts: 1790900000000, abs: [] });
    stored('sl_900000000083', { th: 'A', ta: '5월17일', d: '2026. 10. 13.', info: { date: '2026-05-17' }, ts: 1791500000000, abs: [] });
    stored('sl_900000000084', { th: 'A', ta: '날짜없음', ts: 1760000000000, abs: [] });   // 2025-10 저장 · 날짜 칸 없음
    var saves = JSON.parse(localStorage.getItem('sl_saves')).filter(function (s) { return /^sl_9000000000(8)/.test(s.key); });
    eq(_savesByDate(saves).map(function (x) { return x.d.ta; }), ['날짜없음', '5월17일', '6월7일', '6월21일'], '날짜순(날짜 없으면 저장 시각)');
    eq(_gameDateParts({ info: { date: '2026-05-17' }, d: '2026. 10. 13.' }), [2026, 5, 17], '경기 정보 날짜 우선');
    var src = String(exportAllGamesToExcel) + String(exportFullReport);
    eq((src.match(/_savesByDate\(saves\)/g) || []).length, 2, '전체 경기 · 전체 리포트 내보내기 둘 다 날짜순 목록 사용');
  });

  // ── 5단계: 등번호 빈칸 · APP_VERSION · 투수 엑셀 데이터 설명 ──
  run('등번호 빈칸(5단계): #번을 비우고 추가하면 빈칸으로 저장(라인업 순서를 채우지 않음) · 타순은 라인업 순서로 따로 · 옛 화면도 # 없이 이름만', async function () {
    var team0 = AS.curTeam;
    try {
      AS.curTeam = 'home';
      var add = function (nm, no) { $('pName').value = nm; $('pNum').value = no; addPlayer(); };
      add('첫째', ''); add('둘째', '27'); add('셋째', '');
      eq(AS.home_lineup.map(function (p) { return [p.name, p.num]; }), [['첫째', ''], ['둘째', '27'], ['셋째', '']], '빈칸은 빈칸 그대로(예전: 1 · 3 이 채워졌다)');
      eq([_numTag(''), _numTag(null), _numTag('27')], ['', '', '#27 '], '_numTag');
      window.sbRender(); await T.sleep(60);
      var rows = [].map.call(document.querySelectorAll('#sbOrder .sb-ot-row:not(.empty)'), function (b) { return [b.querySelector('.n').textContent.trim(), b.querySelector('.nm').textContent.trim()]; });
      eq(rows, [['1', '첫째'], ['2', '둘째'], ['3', '셋째']], '타순표 순서 = 라인업 배열 순서(등번호와 무관)');
      renderMob();
      var chips = [].map.call(document.querySelectorAll('.mob-chip'), function (c) { return c.textContent.trim(); });
      ok(chips.indexOf('첫째') >= 0 && chips.indexOf('#27 둘째') >= 0 && !chips.some(function (t) { return /^#\s/.test(t); }), '옛 화면 칩: 등번호 없으면 이름만 — ' + chips.join(','));
      AS.batter = null; selBatter(AS.home_lineup[0].id); recOther('삼진');
      eq($('toastTxt').textContent, '저장됨 · 첫째 삼진', '저장 알림도 # 없이');
      eq(AS.abs[AS.abs.length - 1].bnum, '', '타석의 등번호도 빈칸');
    } finally { AS.curTeam = team0; }
  });

  run('등번호 빈칸(5단계) 엑셀: 등번호가 없으면 리포트 부제목 · 데이터 설명에 「등번호」 표기 자체가 없다 (타자 · 투수)', async function () {
    var L = [{ id: 'e1', name: '무번호', num: '', bh: 'R' }];
    game('sl_900000000067', '2026. 5. 9.', 1790000000000, L, [ab('e1', '무번호', '안타', 40, '1회말', { pt: '직구', zone: '중앙 중간' })]);
    var r = await exportOf('무번호');
    ok(!/등번호/.test(r.wb.sheets['리포트'][1][0]), '리포트 부제목 — ' + r.wb.sheets['리포트'][1][0]);
    ok(!/등번호/.test(JSON.stringify(r.wb.sheets['데이터 설명'])), '데이터 설명에 등번호 없음');
    eq(r.wb.sheets['데이터 설명'].find(function (x) { return x && x[0] === '선수'; }).slice(0, 2), ['선수', '무번호'], '선수 줄은 이름만');
    var X = await import('/js/features/xlsxreport.js?v=14');
    var pitcher = async function (num) {
      var P = { name: '테스트투수', num: num, role: 'SP', apps: [{ label: '2026. 5. 9. 우리 vs 상대', pitches: [
        { id: 1, pt: '직구', zone: '중앙 중간', zoneX: 0.5, zoneY: 0.5, result: '스트라이크', batter: '갑', inning: 1 },
        { id: 2, pt: '커브', zone: '볼 아래', result: '볼', batter: '갑', inning: 1 },
        { id: 3, pt: '직구', zone: '내각 높음', result: '삼진', batter: '갑', inning: 1 }] }] };
      var S = { n: 3, sPct: 2 / 3, kRate: 1, bbRate: 0, ab: 1, avg: 0, ppa: 3, pa: 1 };
      var calc = function () { return { n: 3, sPct: 2 / 3, pa: 1, h: 0, k: 1, bb: 0 }; };
      var blob = null, u0 = URL.createObjectURL;
      URL.createObjectURL = function (b) { blob = b; return u0.call(URL, b); };
      try { X.exportPitcherXlsx(P, S, calc); } finally { URL.createObjectURL = u0; }
      ok(blob, '투수 엑셀 생성');
      return readZip(blob);
    };
    var p0 = await pitcher('');
    eq(p0.names, ['리포트', '구종별 투구위치', '코스 분포', '타구 허용', '투구 기록', '차트 배경', '데이터 설명'], '투수 엑셀: 기존 시트 순서 그대로 + 데이터 설명 맨 뒤');
    ok(!/등번호/.test(p0.sheets['리포트'][1][0]) && !/등번호/.test(JSON.stringify(p0.sheets['데이터 설명'])), '투수도 등번호 없으면 표기 없음');
    var pd = p0.sheets['데이터 설명'], prow = function (k) { return pd.find(function (x) { return x && x[0] === k; }); };
    eq(prow('앱 버전')[3], APP_VERSION, '투수 엑셀 데이터 설명에도 APP_VERSION');
    ok(/볼 · 볼넷을 뺀 모든 공/.test(pd.find(function (x) { return x && x[1] === '스트라이크%'; })[2]), '투수 지표 정의(투수 탭과 같은 식)');
    var p1 = await pitcher('11');
    ok(/^등번호 11  ·  선발/.test(p1.sheets['리포트'][1][0]), '등번호 있으면 표기 — ' + p1.sheets['리포트'][1][0]);
    eq(p1.sheets['데이터 설명'].find(function (x) { return x && x[0] === '선수'; })[3], '등번호 11', '데이터 설명 선수 줄');
  });

  test('APP_VERSION(5단계): core.js 상수 하나(날짜형) · ☰ 메뉴 맨 아래 작은 글씨 · 스크립트 ?v= 번호는 그대로', function () {
    ok(/^\d{4}\.\d{2}\.\d{2}$/.test(APP_VERSION), '날짜형 — ' + APP_VERSION);
    eq(window.APP_VERSION, APP_VERSION, 'window 에도');
    var v = $('slmVer');
    ok(v && v.parentElement === $('slMenu') && v === $('slMenu').lastElementChild, '☰ 메뉴 맨 아래');
    eq(v.textContent, 'SprayLab v' + APP_VERSION, '표시 글자');
    ok(/[?&]v=\d+$/.test(document.querySelector('script[src*="js/core.js"]').getAttribute('src')), '?v= 관례 유지');
  });

  test('wOBA 가중치(FanGraphs Guts 2013 · 원표 3자리): 기록 화면(core renderExtStats)과 분석 · 엑셀(batdata calcStats)이 같은 값', async function () {
    var abs = [{ res: '3루타' }, { res: '홈런' }];
    try {
      renderExtStats(abs);
      eq($('sWOBA').textContent, '1.859', 'core: (1.616 + 2.101) / 2 = 1.8585 (예전 2자리 가중치면 1.860)');
      var B = await import('/js/features/batdata.js?v=10');
      eq(Math.round(B.calcStats(abs).woba * 10000) / 10000, 1.8585, 'batdata(엑셀 · 비교 · 프로필 · 스카우트)도 같은 값');
    } finally { try { renderExtStats(AS.abs || []); } catch (e) {} }
  });
})();
