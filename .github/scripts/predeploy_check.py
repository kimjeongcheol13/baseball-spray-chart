#!/usr/bin/env python3
"""배포 전 최소 검사 (의존성 없음, python3 + node만 사용).

실패(배포 중단): JS 문법 오류 / HTML이 잘렸거나 script·style·주석이 안 닫힘 / index.html이 참조하는 로컬 파일 없음
경고(배포 계속): HTML 태그 짝 불일치(브라우저가 보정하므로) / js·css가 바뀌었는데 index.html의 ?v= 가 그대로 (CLAUDE.md 규칙)

사용: python3 .github/scripts/predeploy_check.py [이전커밋SHA]
"""
import glob, os, re, subprocess, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
errors, warnings = [], []
in_gha = os.environ.get('GITHUB_ACTIONS') == 'true'


def err(msg, path=None):
    errors.append(msg)
    print(f"::error file={path}::{msg}" if in_gha and path else f"ERROR: {msg}")


def warn(msg, path=None):
    warnings.append(msg)
    print(f"::warning file={path}::{msg}" if in_gha and path else f"WARN: {msg}")


# ── 1. 모든 .js 문법 검사 ────────────────────────────────
MODULE_RE = re.compile(r'^\s*(import\s[^(]|export\s)', re.M)
js_files = sorted(p for p in glob.glob('**/*.js', recursive=True) if not p.startswith(('.git/', 'node_modules/')))
for path in js_files:
    src = open(path, encoding='utf-8').read()
    # ES 모듈(import/export)은 stdin + --input-type=module, 나머지는 일반 스크립트로 검사
    if MODULE_RE.search(src):
        cmd, kw = ['node', '--input-type=module', '--check'], {'input': src.encode('utf-8')}
    else:
        cmd, kw = ['node', '--check', path], {}
    r = subprocess.run(cmd, capture_output=True, **kw)
    if r.returncode != 0:
        err(f"JS 문법 오류: {path}\n{r.stderr.decode('utf-8', 'replace').strip()}", path)
print(f"[1/4] JS 문법: {len(js_files)}개 검사")

# ── 2. HTML 파싱 (태그 짝 검사) ──────────────────────────
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
RAW = {'script', 'style'}


class Balance(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.problems = [], []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        elif any(t == tag for t, _ in self.stack):
            while self.stack and self.stack[-1][0] != tag:
                t, ln = self.stack.pop()
                self.problems.append(f"<{t}> (줄 {ln}) 가 닫히지 않음")
            self.stack.pop()
        else:
            self.problems.append(f"</{tag}> (줄 {self.getpos()[0]}) 에 짝이 되는 여는 태그 없음")


html_files = sorted(glob.glob('*.html'))
for path in html_files:
    text = open(path, encoding='utf-8').read()
    p = Balance()
    try:
        p.feed(text)
        p.close()
    except Exception as e:  # noqa: BLE001
        err(f"HTML 파싱 실패: {path}: {e}", path)
        continue
    # 치명적: 문서가 잘렸거나 raw-text 영역이 안 닫혀 뒤쪽이 통째로 삼켜지는 경우
    if '</html>' not in text.lower():
        err(f"HTML이 잘렸거나 </html> 이 없음: {path}", path)
    if re.search(r'<!--(?:(?!-->).)*\Z', re.sub(r'<!--.*?-->', '', text, flags=re.S), re.S):
        err(f"닫히지 않은 HTML 주석: {path}", path)
    for t, ln in p.stack:
        if t in RAW:
            err(f"<{t}> (줄 {ln}) 가 닫히지 않음: {path}", path)
    # 경고: 일반 태그 짝 불일치 (브라우저가 보정해 렌더링하므로 배포는 막지 않음)
    for t, ln in p.stack:
        if t not in RAW:
            p.problems.append(f"<{t}> (줄 {ln}) 가 닫히지 않음")
    if p.problems:
        warn(f"HTML 태그 짝 불일치 {path}: " + " / ".join(p.problems[:5]), path)
print(f"[2/4] HTML 파싱: {len(html_files)}개 검사")

# ── 3. index.html이 참조하는 로컬 js/css 존재 확인 ───────
index = open('index.html', encoding='utf-8').read()
REF_RE = re.compile(r'<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"', re.I)
refs = []
for ref in REF_RE.findall(index):
    if re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|#)', ref, re.I):
        continue  # 외부 URL, data:, 앵커
    refs.append(ref)
    path = ref.split('?')[0].split('#')[0]
    if not os.path.isfile(path):
        err(f"index.html이 참조하는 파일이 없음: {path}", 'index.html')
print(f"[3/4] index.html 로컬 참조: {len(refs)}개 확인")

# ── 4. ?v= 경고 ─────────────────────────────────────────
before = sys.argv[1] if len(sys.argv) > 1 else ''
if not before or set(before) == {'0'}:
    print("[4/4] ?v= 검사 건너뜀 (비교할 이전 커밋 없음)")
else:
    def git(*a):
        return subprocess.run(['git', *a], capture_output=True, text=True)

    changed = git('diff', '--name-only', before, 'HEAD')
    old_index = git('show', f'{before}:index.html')
    if changed.returncode != 0 or old_index.returncode != 0:
        print("[4/4] ?v= 검사 건너뜀 (이전 커밋을 읽을 수 없음)")
    else:
        def versions(html):
            out = {}
            for ref in REF_RE.findall(html):
                m = re.match(r'^([^?#]+)\?v=([^&#]+)', ref)
                if m:
                    out[m.group(1)] = m.group(2)
            return out

        old_v, new_v = versions(old_index.stdout), versions(index)
        files = [f for f in changed.stdout.split() if re.match(r'^(js|css)/.*\.(js|css)$', f)]
        n = 0
        for f in files:
            if f in new_v:  # index.html이 직접 참조하는 파일
                n += 1
                if old_v.get(f) == new_v[f]:
                    warn(f"{f} 이(가) 바뀌었는데 index.html의 ?v={new_v[f]} 가 그대로입니다 (CLAUDE.md ?v= 규칙)", f)
            elif old_v == new_v:  # 모듈 등 간접 로드 파일: 어떤 ?v= 도 안 바뀌었으면 경고
                n += 1
                warn(f"{f} 이(가) 바뀌었는데 index.html의 ?v= 가 하나도 바뀌지 않았습니다 (이 파일을 불러오는 script의 ?v= 확인)", f)
        print(f"[4/4] ?v= 검사: 변경된 js/css {len(files)}개 중 {n}개 확인 대상")

print(f"\n결과: 오류 {len(errors)}건, 경고 {len(warnings)}건")
sys.exit(1 if errors else 0)
