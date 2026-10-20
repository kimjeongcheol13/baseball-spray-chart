// SprayLab 라인업 사진 글자 인식 중계 — 브라우저(js/ocr.js) → 이 함수 → OCR.space
//  · OCR.space 키는 Supabase 비밀(OCR_SPACE_KEY)에만 둔다. 이 코드 · GitHub · 브라우저에는 없다.
//  · 사진은 저장하지 않는다. OCR.space 로 넘기고 그 답을 그대로 돌려준다.
//  · 받는 것: SprayLab 사이트(Origin)에서 온 POST, data:image/ base64 사진 1장, 엔진 1|2, 표모드 true|false.
//    언어 · 방향 감지 등 나머지 옵션은 여기서 고정한다(다른 용도의 OCR 중계로 쓰이지 않게).
//  · 배포: verify_jwt = false — 로그인 없이 쓰는 기능이고, 공개 anon 키를 요구해도 막는 효과가 없다. 대신 Origin · 입력 형식 · 크기를 직접 본다.
//    Origin 은 브라우저가 붙이는 값이라 다른 사이트의 페이지는 막지만, 프로그램이 직접 보내는 요청까지 막지는 못한다.

const OCR_API = 'https://api.ocr.space/parse/image';
const ALLOWED = ['https://kimjeongcheol13.github.io'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;   // 개발자 PC 미리보기
const MAX_BODY = 2_500_000;   // 요청 전체 바이트
const MAX_B64 = 2_000_000;    // base64 글자 수(≈ 1.5MB 사진) — 실제 크기 제한은 OCR.space 가 판단한다

function allowed(origin: string | null): origin is string {
  return !!origin && (ALLOWED.includes(origin) || LOCAL.test(origin));
}

function reply(body: string, status: number, origin: string | null, type = 'application/json') {
  const h: Record<string, string> = { 'Content-Type': type, 'Vary': 'Origin' };
  if (allowed(origin)) h['Access-Control-Allow-Origin'] = origin;
  return new Response(body, { status, headers: h });
}

// js/ocr.js 는 IsErroredOnProcessing · 실패 상태를 보고 "잠시 후 다시 시도" 안내를 띄운다
function fail(msg: string, status: number, origin: string | null) {
  return reply(JSON.stringify({ IsErroredOnProcessing: true, ErrorMessage: [msg] }), status, origin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    if (!allowed(origin)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
      },
    });
  }
  if (!allowed(origin)) return fail('origin not allowed', 403, origin);
  if (req.method !== 'POST') return fail('POST only', 405, origin);
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return fail('image too large', 413, origin);

  const key = Deno.env.get('OCR_SPACE_KEY');
  if (!key) return fail('server key missing', 500, origin);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail('bad form', 400, origin); }
  const img = form.get('base64Image');
  if (typeof img !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(img)) return fail('image required', 400, origin);
  if (img.length > MAX_B64) return fail('image too large', 413, origin);

  const out = new FormData();
  out.append('base64Image', img);
  out.append('language', 'kor');
  out.append('isOverlayRequired', 'false');
  out.append('detectOrientation', 'true');
  out.append('scale', 'true');
  out.append('isTable', form.get('isTable') === 'true' ? 'true' : 'false');
  out.append('OCREngine', form.get('OCREngine') === '1' ? '1' : '2');

  try {
    const r = await fetch(OCR_API, { method: 'POST', headers: { apikey: key }, body: out });
    return reply(await r.text(), r.status, origin, r.headers.get('content-type') || 'application/json');
  } catch {
    return fail('ocr server unreachable', 502, origin);
  }
});
