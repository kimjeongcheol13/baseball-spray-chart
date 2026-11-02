// 필드 표시 「15° 각도선」 (sl_field_overlays.ang) — 상세 필터 패널의 칩으로 켜고 끄며, 켜면 필드 그림(scorebook.js paintField)에 선 · 숫자가 더해진다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window._sfOpen && window._sfChip && window.sbPaint && window.setFieldOverlay, '필터 패널 · 필드 그리기 로드');
  });

  test('15° 각도선 칩: 켜면 저장 · 필드 그림이 바뀌고, 끄면 원래 그림', function () {
    function draw() { var c = document.createElement('canvas'); c.width = c.height = 300; window.sbPaint.field(c.getContext('2d'), 300); return c.toDataURL(); }
    window._sfOpen();
    var chip = document.querySelector('#sfPanel .sfc[data-key="ov"][data-val="ang"]');
    try {
      ok(chip, '칩 없음');
      eq(chip.textContent, '15° 각도선', '칩 이름');
      if (window._fieldOv.ang) window._sfChip(chip);
      var off = draw();
      window._sfChip(chip);
      ok(window._fieldOv.ang && chip.classList.contains('sfc-on'), '켜지지 않음');
      eq(JSON.parse(localStorage.getItem('sl_field_overlays')).ang, true, '저장');
      ok(draw() !== off, '켰는데 그림이 같음');
      window._sfChip(chip);
      ok(!window._fieldOv.ang && !chip.classList.contains('sfc-on'), '꺼지지 않음');
      eq(draw(), off, '끄면 원래 그림');
    } finally { window.setFieldOverlay('ang', false); window._sfClose(); }
  });
})();
