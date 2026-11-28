// 동작 분석 — AI 훈련 코치: web-llm 을 Web Worker 에서 돌린다(화면이 멈추지 않게). coach-llm.js 가 이 파일을 띄운다
//  · 모델 파일은 web-llm 이 브라우저 Cache Storage(webllm/*)에 넣어 두고 다음부터 다시 받지 않는다
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.88/+esm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
