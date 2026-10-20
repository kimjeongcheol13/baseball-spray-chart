// 라인업 사진 입력(js/ocr.js) — Supabase 중계 함수 · 서버 거절 안내 검증. 실제 서버에는 보내지 않는다(window.fetch 를 잠시 가짜로 바꿨다가 되돌린다).
//  · 요청은 SprayLab Supabase 함수(supabase/functions/ocr)로 가고, 브라우저는 OCR.space 키를 싣지 않는다(키는 Supabase 비밀에만)
//  · 사진 1장 = 요청 2회(엔진 2 표모드 + 엔진 1 일반모드)
//  · 두 요청 모두 서버 거절(한도 초과 등) · 연결 실패면 "인식된 선수 없음" 대신 이유를 보여 준다
//  · 서버는 정상인데 글자가 없는 사진이면 예전처럼 "인식된 선수가 없습니다"
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var OCR_URL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co/functions/v1/ocr';

  function photo() {   // 흰 바탕 작은 PNG — _resizeToBase64 가 읽을 수 있는 실제 이미지
    var c = document.createElement('canvas'); c.width = 40; c.height = 20;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 40, 20);
    return new Promise(function (r) { c.toBlob(function (b) { r(new File([b], 'lineup.png', { type: 'image/png' })); }, 'image/png'); });
  }
  // respond(engine) → Response | Promise.reject. 호출 기록(주소 · 키 · 엔진)을 돌려준다
  async function run(respond) {
    var real = window.fetch, calls = [];
    window.fetch = function (url, opts) {
      var engine = opts && opts.body && opts.body.get ? opts.body.get('OCREngine') : '';
      calls.push({ url: String(url), headers: (opts && opts.headers) || null, engine: engine });
      return respond(engine);
    };
    try {
      window.ocrModalOpen();
      window.ocrHandleFile(await photo());
      for (var i = 0; i < 60; i++) {   // 결과 목록이 보이거나 오류 문구가 나올 때까지(가상 시간)
        await T.sleep(100);
        if ($('ocrResultWrap').style.display === 'block' || /OCR 오류/.test($('ocrStatusText').textContent)) break;
      }
    } finally { window.fetch = real; }
    var names = [].map.call(document.querySelectorAll('#ocrPlayerList input[data-field="name"]'), function (el) { return el.value; }).filter(Boolean);
    // 이름이 있는 줄의 타순 · 이름 · 배번 · 포지션 ('1 타자1 1 1루')
    var rows = [].map.call(document.querySelectorAll('#ocrPlayerList > div'), function (r) {
      function v(f) { var el = r.querySelector('[data-field="' + f + '"]'); return el ? el.value : ''; }
      return v('name') ? [(r.querySelector('span') || {}).textContent, v('name'), v('num'), v('pos')].join(' ') : '';
    }).filter(Boolean);
    var out = { calls: calls, names: names, rows: rows, status: $('ocrStatusText').textContent, list: $('ocrPlayerList').textContent, apply: $('ocrApplyBtn').style.display };
    window.ocrModalClose();
    return out;
  }
  function json(o) { return Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } })); }

  test('OCR: Supabase 함수로 키 없이 요청 2회(엔진 2 · 1)를 보내고, 받은 글자로 선수 목록을 채운다', async function () {
    var r = await run(function (engine) {
      return json({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: engine === '2' ? '1\t홍길동\t유격\t7' : '1 유격 홍길동 7' }] });
    });
    eq(r.calls.map(function (c) { return c.url; }), [OCR_URL, OCR_URL], '요청 주소');
    eq(r.calls.map(function (c) { return c.engine; }).sort(), ['1', '2'], '엔진');
    ok(r.calls.every(function (c) { return c.headers === null; }), '브라우저가 헤더(키)를 실어 보냄: ' + JSON.stringify(r.calls));
    eq(r.names, ['홍길동'], '인식된 선수 이름');
    ok(r.apply === 'block', '라인업에 추가 버튼이 보이지 않음');
    ok(!/OCR 오류/.test(r.status), '정상 응답인데 오류 문구: ' + r.status);
  });

  test('OCR: 한도 초과(403 · JSON 아닌 글)면 "인식된 선수 없음" 대신 다시 시도 안내를 보여 준다', async function () {
    var r = await run(function () {
      return Promise.resolve(new Response('You may only perform this action upto maximum 500 number of times within 86400 seconds', { status: 403 }));
    });
    ok(/사용 한도/.test(r.status) && /다시 시도/.test(r.status), '안내 문구 없음: ' + r.status);
    ok(r.apply !== 'block', '실패했는데 라인업에 추가 버튼이 보임');
    ok(r.list.indexOf('인식된 선수가 없습니다') < 0, '서버 거절인데 "인식된 선수 없음"을 보여 줌');
  });

  test('OCR: 서버가 처리 오류(IsErroredOnProcessing — 함수의 키 없음 · 사이트 아님 포함)로 답해도 같은 안내', async function () {
    var r = await run(function () { return json({ IsErroredOnProcessing: true, ErrorMessage: ['limit reached'], OCRExitCode: 99 }); });
    ok(/사용 한도/.test(r.status), '안내 문구 없음: ' + r.status);
  });

  test('OCR: 연결 실패(fetch 거부)도 같은 안내', async function () {
    var r = await run(function () { return Promise.reject(new TypeError('Failed to fetch')); });
    ok(/사용 한도/.test(r.status) && /인터넷 연결/.test(r.status), '안내 문구 없음: ' + r.status);
  });

  test('OCR: 서버는 정상인데 글자가 없는 사진이면 예전처럼 빈 슬롯 목록(오류 아님)', async function () {
    var r = await run(function () { return json({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: '' }] }); });
    ok(!/OCR 오류/.test(r.status), '글자 없는 사진을 서버 오류로 봄: ' + r.status);
  });

  // OCR.space 표 모드 글자 모양: 칸 사이 탭, 줄 끝 탭 + \r\n. 엑셀 화면을 찍으면 맨 앞 칸이 엑셀 행 번호다
  function table(lines) { return lines.map(function (l) { return l.join('\t') + '\t'; }).join('\r\n'); }
  var GIBA_SHOT = table([
    ['1', 'BATTING C', 'www.giba.kr'], ['2', '리그명'], ['3', '팀명'], ['4', '경기일'], ['5', '타순', '수비', '이름', '배번', '비고']
  ].concat(['1루수', '2루수', '3루수', '유격수', '좌익수', '우익수', '중견수', '포수', '투수'].map(function (p, i) {
    return [String(i + 6), String(i + 1), p, '타자' + (i + 1), String(i + 1)];
  }), [
    ['15', '투수'], ['16', '1. 선수출신', '1. 선수출신 규정:루수'], ['19', '3) 타자: 포', '3) 타자: 포수외 전 포지션 가능루수'],
    ['20', '2. 콜드게임', '2. 콜드게임: 4,5,6회 10점차 이상루수']
  ]));

  test('OCR: 엑셀 화면 사진(GIBA 양식 · 왼쪽 행 번호)은 머리줄대로 — 행 번호가 타순으로, 타자1이 타자로 바뀌지 않는다', async function () {
    var r = await run(function (engine) { return json({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: engine === '2' ? GIBA_SHOT : '' }] }); });
    eq(r.rows, ['1 타자1 1 1루', '2 타자2 2 2루', '3 타자3 3 3루', '4 타자4 4 유격', '5 타자5 5 좌익', '6 타자6 6 우익', '7 타자7 7 중견', '8 타자8 8 포수', '9 타자9 9 투수'], '선수 목록');
  });

  test('OCR: 머리줄은 있지만 칸이 어긋난 사진은 예전 읽기(줄마다 추측)를 그대로 쓴다', async function () {
    var shot = table([['타순', '위치', '성명', '배번'], ['1', '가나다', '7'], ['2', '라마바', '12']]);   // 위치 칸이 비어 이름이 배번 자리로 밀림
    var r = await run(function (engine) { return json({ IsErroredOnProcessing: false, ParsedResults: [{ ParsedText: engine === '2' ? shot : '' }] }); });
    eq(r.names, ['가나다', '라마바'], '이름');
  });
})();
