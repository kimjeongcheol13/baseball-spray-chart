// 동작 분석 — 영상 파일을 화면에 끌어다 놓아 여는 입력
const VIDEO_NAME = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

// 끌어온 파일들 중 첫 영상 파일 → File | null (종류 표시가 비어 있는 기기도 있어 확장자도 본다)
export function videoFrom(files) {
  for (const f of Array.from(files || [])) {
    if ((f.type || '').startsWith('video/') || VIDEO_NAME.test(f.name || '')) return f;
  }
  return null;
}

// 파일을 끌고 들어온 것인가 (글자 · 링크를 끄는 것은 건드리지 않는다)
const hasFiles = (e) => Boolean(e.dataTransfer) && Array.from(e.dataTransfer.types || []).includes('Files');

// target 위로 파일을 끌어오면 onHover(true/false), 놓으면 영상은 onFile(file), 영상이 아니면 onReject()
//  · 돌려주는 함수를 부르면 입력을 뗀다
export function attachDrop(target, { onFile, onReject, onHover }) {
  let depth = 0;   // 안쪽 요소를 드나들 때마다 enter · leave 가 겹쳐 오므로 세어 둔다
  const hover = (on) => { if (onHover) onHover(on); };
  const onEnter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth += 1; hover(true); };
  const onOver = (e) => { if (hasFiles(e)) e.preventDefault(); };   // 막지 않으면 브라우저가 영상을 새 화면으로 열어 버린다
  const onLeave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) hover(false); };
  const onDrop = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0; hover(false);
    const file = videoFrom(e.dataTransfer.files);
    if (file) onFile(file); else if (onReject) onReject();
  };
  const events = [['dragenter', onEnter], ['dragover', onOver], ['dragleave', onLeave], ['drop', onDrop]];
  for (const [name, fn] of events) target.addEventListener(name, fn);
  return () => { for (const [name, fn] of events) target.removeEventListener(name, fn); };
}
