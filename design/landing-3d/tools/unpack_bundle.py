import sys, re, json, gzip, base64, os
src, out = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
def block(kind):
    m = re.search(r'<script type="__bundler/%s">(.*?)</script>' % kind, html, re.S)
    return m.group(1) if m else None
manifest = json.loads(block('manifest'))
ext = json.loads(block('ext_resources'))
order = block('page_order')
template = json.loads(block('template'))
idmap = {e['uuid']: e['id'] for e in ext}
os.makedirs(out, exist_ok=True)
rows = []
for uid, e in manifest.items():
    raw = base64.b64decode(e['data'])
    if e.get('compressed'): raw = gzip.decompress(raw)
    ext_ = {'text/javascript':'js','text/css':'css','text/html':'html','application/json':'json'}.get(e['mime'], e['mime'].split('/')[-1].split('+')[0])
    p = os.path.join(out, uid + '.' + ext_)
    open(p, 'wb').write(raw)
    rows.append((uid, e['mime'], len(raw), idmap.get(uid, '(inline)')))
open(os.path.join(out, '_template.html'), 'w', encoding='utf-8').write(template)
open(os.path.join(out, '_page_order.json'), 'w').write(order or '')
for r in rows: print(r)
print('template chars:', len(template))
