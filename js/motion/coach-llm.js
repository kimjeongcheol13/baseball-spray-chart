// 동작 분석 — AI 훈련 코치: 기기 안에서 도는 작은 언어 모델(web-llm · WebGPU)
//  · 네트워크는 모델 파일 내려받기(Hugging Face · GitHub · jsDelivr 공개 CDN)에만 쓴다. 질문 · 숫자 · 답은 기기 밖으로 나가지 않는다
//  · WebGPU 가 없거나 불러오다 실패하면 null 을 돌려주고, 화면은 「AI 없이」(규칙 결과)로 간다
const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.88/+esm';   // coach-worker.js 와 같은 판을 쓴다
// web-llm 0.2.88 prebuiltAppConfig 에 있는 모델(low_resource_required · GPU 메모리 약 1.6GB). 한국어 · JSON 출력이 된다
//  · 내려받는 크기 = Hugging Face ndarray-cache.json 합계 869MB + 실행 파일 · 토크나이저 약 10MB (2026-11-28 확인)
//  · 더 작은 Qwen2.5-0.5B(285MB)는 실제로 돌려 보니 한국어 요약이 말이 안 돼(「보통의 악당이야말로…」) 쓰지 않는다
export const MODEL = { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', mb: 880 };

let lib = null, engine = null;
const load = async () => (lib ||= await import(WEBLLM));

// WebGPU 를 쓸 수 있는 기기인가 — adapter 를 받아 보고, 소프트웨어 대체(fallback) adapter 와
// 16비트 셰이더(shader-f16)가 없는 GPU 는 뺀다(q4f16 모델이 돌지 않거나 너무 느리다)
export async function gpuReady() {
  if (!navigator.gpu) return false;
  try {
    const a = await navigator.gpu.requestAdapter();
    return !!a && !a.isFallbackAdapter && !(a.info && a.info.isFallbackAdapter) && a.features.has('shader-f16');
  } catch (e) { return false; }
}

// 모델을 이미 받아 뒀나(받아 뒀으면 동의 창 없이 바로 쓴다). web-llm 이 쓰는 Cache Storage 를 직접 본다 —
// 동의하기 전에는 web-llm 라이브러리도 받지 않으려고
export async function modelCached() {
  try {
    if (!(await caches.has('webllm/model'))) return false;
    return (await (await caches.open('webllm/model')).keys()).some((r) => r.url.includes(MODEL.id));
  } catch (e) { return false; }
}

// 모델을 불러온다 · onProgress(0~1, 글자) → 엔진 | null(실패)
export async function loadModel(onProgress) {
  if (engine) return engine;
  try {
    const w = await load();
    engine = await w.CreateWebWorkerMLCEngine(new Worker(new URL('./coach-worker.js?v=1', import.meta.url), { type: 'module' }), MODEL.id,
      { initProgressCallback: (p) => onProgress(p.progress, p.text) });
    return engine;
  } catch (e) {
    console.warn('[motion] AI 모델을 불러오지 못했어요', e);
    engine = null;
    return null;
  }
}

// coach.js runCoach 가 부르는 llm(messages, schema) → 글자
export async function ask(messages, schema) {
  const r = await engine.chat.completions.create({ messages, temperature: 0.2, max_tokens: 320, response_format: { type: 'json_object', schema: JSON.stringify(schema) } });
  return r.choices[0].message.content;
}
