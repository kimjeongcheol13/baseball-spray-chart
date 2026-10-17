# Shrink the Tripo-rigged player GLB for the web:
#  - textures re-encoded as JPEG at web sizes
#  - vertex data quantized (KHR_mesh_quantization, decoded by three's GLTFLoader with no extra library): normals int8,
#    UVs uint16, joints uint8, weights uint8 (summing to exactly 255), indices uint16; positions stay float32 so the
#    bind pose and every measurement made on it are unchanged
#   python3 tools/pack_player.py "<downloaded tripo>.glb" assets/player.glb
#   python3 tools/pack_player.py "<tripo prop>.glb" assets/glove.glb .5     (props: no skin; textures at half size)
import io, json, struct, sys
import numpy as np
from PIL import Image
src, dst = sys.argv[1:3]
TS = float(sys.argv[3]) if len(sys.argv) > 3 else 1   # texture size factor
SIZE = {'baseColorTexture': (1024, 88), 'normalTexture': (512, 92), 'metallicRoughnessTexture': (256, 85)}   # px, JPEG quality
b = open(src, 'rb').read()
jl = struct.unpack_from('<I', b, 12)[0]; J = json.loads(b[20:20 + jl]); B0 = 20 + jl + 8
binb = b[B0:B0 + struct.unpack_from('<I', b, 20 + jl)[0]]
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
DT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
CT = {np.dtype(v).str: k for k, v in DT.items()}

def read(i):
    a = J['accessors'][i]; v = J['bufferViews'][a['bufferView']]; n, dt = NC[a['type']], np.dtype(DT[a['componentType']])
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0); st = v.get('byteStride') or n * dt.itemsize
    rows = np.frombuffer(binb, np.uint8, st * (a['count'] - 1) + n * dt.itemsize, off)
    out = np.lib.stride_tricks.as_strided(rows, (a['count'], n * dt.itemsize), (st, 1)).copy().view(dt).reshape(a['count'], n)
    return out if n > 1 else out[:, 0]

role = {}
for m in J['materials']:
    pbr = m.get('pbrMetallicRoughness', {})
    for k, t in list(pbr.items()) + list(m.items()):
        if isinstance(t, dict) and 'index' in t and k in SIZE: role[J['textures'][t['index']]['source']] = k

blobs, views, accs = [], [], []                 # rebuilt buffer: one bufferView per blob
def view(data, target=None):
    views.append({'buffer': 0, 'byteLength': len(data), **({'target': target} if target else {})}); blobs.append(data); return len(views) - 1
def acc(arr, typ, normalized=False, target=None, minmax=False):
    a = {'bufferView': view(np.ascontiguousarray(arr).tobytes(), target), 'componentType': CT[arr.dtype.str], 'count': len(arr), 'type': typ}
    if normalized: a['normalized'] = True
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1

prims = [p for m in J['meshes'] for p in m['primitives']]
for p in prims:
    A = p['attributes']; new = {}
    P = read(A['POSITION']).astype(np.float32)
    new['POSITION'] = acc(P, 'VEC3', target=34962, minmax=True)
    N = read(A['NORMAL']).astype(np.float32); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    new['NORMAL'] = acc(np.round(N * 127).astype(np.int8), 'VEC3', True, 34962)
    UV = read(A['TEXCOORD_0']).astype(np.float64)
    if UV.min() >= 0 and UV.max() <= 1: new['TEXCOORD_0'] = acc(np.round(UV * 65535).astype(np.uint16), 'VEC2', True, 34962)
    else: new['TEXCOORD_0'] = acc(UV.astype(np.float32), 'VEC2', target=34962)
    if 'JOINTS_0' not in A:                                                             # a prop: no skin
        I = read(p['indices']); p['indices'] = acc(I.astype(np.uint16 if len(P) < 65536 else np.uint32), 'SCALAR', target=34963)
        p['attributes'] = new; continue
    Jn = read(A['JOINTS_0']); assert Jn.max() < 256
    new['JOINTS_0'] = acc(Jn.astype(np.uint8), 'VEC4', target=34962)
    W = read(A['WEIGHTS_0']).astype(np.float64); W /= W.sum(1, keepdims=True)
    Wq = np.floor(W * 255).astype(np.int32); r = 255 - Wq.sum(1)                       # hand the rounding remainder to the largest weights
    order = np.argsort(-(W * 255 - Wq), axis=1)
    for k in range(4): Wq[np.arange(len(Wq)), order[:, k]] += (r > k)
    assert (Wq.sum(1) == 255).all()
    new['WEIGHTS_0'] = acc(Wq.astype(np.uint8), 'VEC4', True, 34962)
    I = read(p['indices'])
    p['indices'] = acc(I.astype(np.uint16 if len(P) < 65536 else np.uint32), 'SCALAR', target=34963)
    p['attributes'] = new
for s in J.get('skins', []):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc(read(s['inverseBindMatrices']).astype(np.float32), 'MAT4')
for i, im in enumerate(J['images']):
    bv = J['bufferViews'][im['bufferView']]; px, q = SIZE[role[i]]; px = int(px * TS)
    img = Image.open(io.BytesIO(binb[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
    if img.width > px: img = img.resize((px, px), Image.LANCZOS)
    out = io.BytesIO(); img.save(out, 'JPEG', quality=q, optimize=True)
    im['bufferView'] = view(out.getvalue()); im['mimeType'] = 'image/jpeg'
    print('image', i, role[i], img.size, round(len(out.getvalue()) / 1e3), 'KB')
data = bytearray()
for v, blob in zip(views, blobs):
    while len(data) % 4: data += b'\0'
    v['byteOffset'] = len(data); data += blob
while len(data) % 4: data += b'\0'
J['bufferViews'], J['accessors'], J['buffers'] = views, accs, [{'byteLength': len(data)}]
for k in ('extensionsUsed', 'extensionsRequired'): J[k] = sorted(set(J.get(k, [])) | {'KHR_mesh_quantization'})
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(data), b'BIN\0') + bytes(data)
open(dst, 'wb').write(glb)
print(round(len(b) / 1e6, 2), 'MB ->', round(len(glb) / 1e6, 2), 'MB, verts', [J['accessors'][p['attributes']['POSITION']]['count'] for p in prims])
