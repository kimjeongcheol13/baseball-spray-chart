import json, struct, sys
src, dst = sys.argv[1:3]
d = open(src, 'rb').read()
clen, _ = struct.unpack('<I4s', d[12:20]); j = json.loads(d[20:20+clen])
off = 20 + clen; blen, _ = struct.unpack('<I4s', d[off:off+8]); binb = d[off+8:off+8+blen]
# keep only the Body mesh; drop morph targets
keep = [i for i, m in enumerate(j['meshes']) if m.get('name') == 'Body']
body = j['meshes'][keep[0]]
for pr in body['primitives']: pr.pop('targets', None)
body.pop('weights', None); (body.get('extras') or {}).pop('targetNames', None)
old_mesh_idx = keep[0]
j['meshes'] = [body]
for n in j['nodes']:
    if n.get('mesh') is not None: n['mesh'] = 0 if n['mesh'] == old_mesh_idx else None
for n in j['nodes']:
    if n.get('mesh') is None: n.pop('mesh', None); n.pop('skin', None) if n.get('skin') is not None and 'mesh' not in n and False else None
# used accessors
used = []
def use(a):
    if a not in used: used.append(a)
    return used.index(a)
for pr in body['primitives']:
    pr['attributes'] = {k: use(v) for k, v in pr['attributes'].items()}
    if 'indices' in pr: pr['indices'] = use(pr['indices'])
for s in j['skins']:
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = use(s['inverseBindMatrices'])
newacc = [j['accessors'][a] for a in used]
bv_used = []
for a in newacc:
    assert 'sparse' not in a, 'sparse accessor not handled'
    if a['bufferView'] not in bv_used: bv_used.append(a['bufferView'])
out = bytearray(); newbv = []
for bi in bv_used:
    b = j['bufferViews'][bi]; chunk = binb[b.get('byteOffset', 0): b.get('byteOffset', 0) + b['byteLength']]
    while len(out) % 4: out += b'\0'
    nb = dict(b); nb['byteOffset'] = len(out); newbv.append(nb); out += chunk
for a in newacc: a['bufferView'] = bv_used.index(a['bufferView'])
j['accessors'] = newacc; j['bufferViews'] = newbv; j['buffers'] = [{'byteLength': len(out)}]
j.pop('images', None); j.pop('textures', None); j.pop('samplers', None)
for m in j.get('materials', []):
    for k in ('pbrMetallicRoughness',):
        m.get(k, {}).pop('baseColorTexture', None)
j['materials'] = j.get('materials', [])[:1] or [{'name': 'Body'}]
body['primitives'][0]['material'] = 0
while len(out) % 4: out += b'\0'
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(out), b'BIN\0') + bytes(out)
open(dst, 'wb').write(glb)
print('stripped:', len(d)/1e6, 'MB ->', len(glb)/1e6, 'MB | verts', newacc[0]['count'], '| accessors', len(newacc), '| nodes with mesh:', [n.get('name') for n in j['nodes'] if 'mesh' in n])
