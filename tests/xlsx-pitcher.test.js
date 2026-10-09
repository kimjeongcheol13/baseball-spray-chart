// 엑셀 「투수분석」 시트(js/core.js _doExportToExcel) — 투수 탭 투구 기록 행의 기타%, 빈 투구 기록은 행 없음.
// 하네스는 외부 호스트를 막아 XLSX CDN 이 올라오지 않으므로, 시트를 2차원 배열 그대로 붙잡아 두는 최소 스텁으로 바꿔 끼운다.
(function () {
  var T = window.__T, eq = T.eq, test = T.test;

  function pitcherSheet(data) {
    var saved = window.XLSX, sheets = {};
    window.XLSX = {
      utils: { book_new: function () { return {}; }, aoa_to_sheet: function (aoa) { return aoa; }, book_append_sheet: function (wb, ws, name) { sheets[name] = ws; } },
      writeFile: function () {}
    };
    try { _doExportToExcel(data); } finally { window.XLSX = saved; }
    return sheets['투수분석'];
  }

  test('엑셀 투수분석: 투구 4개 중 커터 1개 → 총투구수 4, 직구 50, 슬라이더 25, 기타 25, 볼 25, 스트라이크 50', function () {
    var rows = pitcherSheet({ th: 'A', ta: 'B', abs: [], pitchers: [{ name: 'P1', role: '선발', pitches: [
      { pt: '직구', result: '볼' }, { pt: '직구', result: '스트라이크' }, { pt: '슬라이더', result: '파울' }, { pt: '커터', result: '안타' }] }] });
    var r = rows[1];
    eq([r[0], r[2], r[3], r[4], r[8], r[9], r[10], r[11], r[13]], ['P1', 4, 50, 25, 25, 25, 50, 1, '투수탭 투구기록'], 'P1 행');
  });

  test('엑셀 투수분석: 투구 기록이 빈 등록 투수는 행을 만들지 않는다 (기타% 100 행 없음)', function () {
    var rows = pitcherSheet({ th: 'A', ta: 'B', abs: [], pitchers: [{ name: 'Z1', role: '구원', pitches: [] }] });
    eq(rows.filter(function (r) { return r[0] === 'Z1'; }).length, 0, 'Z1 행');
    eq(rows.length, 3, '헤더 + 빈 줄 + 안내문만');
  });
})();
