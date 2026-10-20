// 라인업 문서 입력(js/ocr.js 의 txt · csv) — 협회 양식(GIBA 「BATTING ORDER」)처럼 제목 · 리그명 · 팀명 · 경기일 줄 아래에 머리줄이 있는 표를 칸대로 읽는지.
//  · 예전에는 첫 줄만 머리줄로 봐서, 머리줄을 못 찾고 한 줄을 통째로 읽어 '1루수'의 '루수' · '리그명' · '경기일'을 이름으로 넣었다
//  · 머리줄 아래의 '투수' 줄(선발투수)과 안내문(따옴표 안 쉼표 포함)은 타자로 넣지 않는다
//  · 머리줄이 첫 줄인 예전 csv 는 그대로 읽는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  var HEAD = ['BATTING ORDER,www.giba.kr,,,', '리그명,,,,', '팀명,,,,', '경기일,,,,', '타순,수비,이름,배번,비고'];
  var POS = ['1루수', '2루수', '3루수', '유격수', '좌익수', '우익수', '중견수', '포수', '투수'];
  var BATTERS = POS.map(function (p, i) { return (i + 1) + ',' + p + ',타자' + (i + 1) + ',' + (i + 1) + ','; });
  var FOOT = [
    '1. 선수출신 규정:,1. 선수출신 규정:루수,,,',
    '1) 선수출신은 비고란에 *표를 해주세요.,1) 선수출신은 비고란에 *표를 해주세요.루수,,,',
    '"2. 콜드게임: 4,5,6회 10점차 이상","2. 콜드게임: 4,5,6회 10점차 이상루수",,,'
  ];
  var WANT = {
    order: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    name: ['타자1', '타자2', '타자3', '타자4', '타자5', '타자6', '타자7', '타자8', '타자9'],
    num: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    pos: ['1루', '2루', '3루', '유격', '좌익', '우익', '중견', '포수', '투수']
  };

  // 파일 하나를 입력 창에 넣고, 화면에 그려진 선수 목록(타순 · 이름 · 배번 · 포지션)을 읽는다
  // 파일 읽기(FileReader)는 실제 시간이 걸리고 sleep 은 가상 시간이라, 여러 파일을 함께 돌리면 몇백 번 기다려도 결과가 늦게(다음 테스트 화면에) 그려졌다.
  // 그래서 읽기만 가짜로: 테스트가 만든 바이트를 TextDecoder 로 바로 풀어 onload 를 부른다. 앱의 'UTF-8 로 읽고 깨지면 EUC-KR 로 다시 읽기'는 그대로 탄다
  function FakeReader() {}
  FakeReader.prototype.readAsText = function (file, enc) {
    var self = this, text = new TextDecoder(enc || 'utf-8').decode(file._bytes);
    Promise.resolve().then(function () { self.result = text; if (self.onload) self.onload({ target: self }); });
  };
  async function read(fileName, text, type) {
    var bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text, file = new File([bytes], fileName, { type: type }), real = window.FileReader;
    file._bytes = bytes;
    window.ocrModalOpen();
    $('ocrPlayerList').innerHTML = '';   // 앞 테스트의 목록을 읽지 않게
    window.FileReader = FakeReader;
    try {
      window.ocrHandleFile(file);
      for (var i = 0; i < 40; i++) { await T.sleep(50); if ($('ocrResultWrap').style.display === 'block' && $('ocrPlayerList').children.length) break; }
    } finally { window.FileReader = real; }
    var rows = [].map.call(document.querySelectorAll('#ocrPlayerList > div'), function (r) {
      function v(f) { var el = r.querySelector('[data-field="' + f + '"]'); return el ? el.value : ''; }
      return { order: (r.querySelector('span') || {}).textContent, name: v('name'), num: v('num'), pos: v('pos') };
    });
    window.ocrModalClose();
    return rows;
  }
  function col(rows, k) { return rows.map(function (r) { return r[k]; }); }
  function same(rows, what) {
    eq(rows.length, 9, what + ' 선수 수');
    ['order', 'name', 'num', 'pos'].forEach(function (k) { eq(col(rows, k), WANT[k], what + ' ' + k); });
  }

  test('라인업 문서: GIBA 양식 csv(머리줄이 5번째 줄) → 타자 9명을 타순 · 이름 · 배번 · 수비대로', async function () {
    var rows = await read('lineup.csv', HEAD.concat(BATTERS, ['투수,,,,'], FOOT).join('\r\n'), 'text/csv');
    same(rows, 'GIBA csv');
    ok(!rows.some(function (r) { return /루수|리그명|경기일|유격수/.test(r.name); }), '수비 이름 · 제목 칸이 이름으로 들어감: ' + JSON.stringify(col(rows, 'name')));
  });

  test('라인업 문서: 투수 줄에 선발투수를 적어도 타자로 넣지 않는다', async function () {
    var rows = await read('lineup.csv', HEAD.concat(BATTERS, ['투수,,타자10,10,'], FOOT).join('\n'), 'text/csv');
    same(rows, '투수 줄');
  });

  test('라인업 문서: 같은 양식을 탭으로 저장한 txt 도 칸대로', async function () {
    var tsv = HEAD.concat(BATTERS, ['투수,,,,']).map(function (l) { return l.split(',').join('\t'); }).join('\n');
    var rows = await read('lineup.txt', tsv, 'text/plain');
    same(rows, 'GIBA txt');
  });

  test('라인업 문서: 머리줄이 첫 줄인 예전 csv 는 그대로 읽는다', async function () {
    var rows = await read('old.csv', ['타순,이름,포지션,배번', '1,가선수,SS,7', '2,나선수,CF,24'].join('\n'), 'text/csv');
    eq(col(rows, 'name'), ['가선수', '나선수'], '이름');
    eq(col(rows, 'pos'), ['유격', '중견'], '포지션');
    eq(col(rows, 'num'), ['7', '24'], '배번');
  });

  test('라인업 문서: 이름 칸 머리가 「선수명」 · 「선수 이름」 · 「타자명」이어도 칸대로 읽는다', async function () {
    var heads = ['선수명', '선수 이름', '타자명'];
    for (var i = 0; i < heads.length; i++) {
      var csv = HEAD.slice(0, 4).concat(['타순,수비,' + heads[i] + ',배번,비고'], BATTERS, ['투수,,,,'], FOOT).join('\n');
      same(await read('lineup.csv', csv, 'text/csv'), heads[i]);
    }
    var rows = await read('team.csv', ['타순,포지션,선수명,등번호', '1,SS,가선수,7', '2,CF,나선수,24'].join('\n'), 'text/csv');
    eq(col(rows, 'name'), ['가선수', '나선수'], '선수명 · 등번호 양식 이름');
    eq(col(rows, 'num'), ['7', '24'], '선수명 · 등번호 양식 배번');
  });

  test('라인업 문서: 한국어 엑셀 기본 CSV(EUC-KR)도 한글이 깨지지 않게 읽는다', async function () {
    // '타순,수비,이름,배번 / 1,1루수,타자1,1 / 2,유격수,타자2,2' 를 EUC-KR 로 저장한 바이트
    var hex = 'c5b8bcf82cbcf6baf12cc0ccb8a72cb9e8b9f80d0a312c31b7e7bcf62cc5b8c0da312c310d0a322cc0afb0ddbcf62cc5b8c0da322c320d0a';
    var bytes = new Uint8Array(hex.match(/../g).map(function (b) { return parseInt(b, 16); }));
    var rows = await read('excel.csv', bytes, 'text/csv');
    eq(col(rows, 'name'), ['타자1', '타자2'], '이름');
    eq(col(rows, 'pos'), ['1루', '유격'], '포지션');
  });

  test('라인업 문서: 머리줄 없는 txt 에서도 수비 이름(1루수 · 유격수)을 이름으로 고르지 않는다', async function () {
    var rows = await read('plain.txt', ['1\t1루수\t가나', '2\t유격수\t다라'].join('\n'), 'text/plain');
    eq(col(rows, 'name').slice(0, 2), ['가나', '다라'], '이름');
  });
})();
