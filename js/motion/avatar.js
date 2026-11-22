// 동작 분석 — 「사람 모형」 화면(보기용): 관절 33개의 3D 좌표로 사람 모형의 뼈를 돌려 같은 자세를 만든다
//  · 3D 그리기 도구(three.js)와 모형 파일은 이 화면을 처음 고를 때만 내려받는다(motion.html 의 importmap 이 주소를 정한다)
//  · 누구에게나 같은 모형이다. 관절 점만으로는 팔다리가 뼈 둘레로 비틀린 정도를 알 수 없어 그 부분은 모형의 기본 자세를 따른다
//    → 각도 · 속도 숫자는 이 화면이 아니라 선 화면 · 그래프 기준이다
import { FRAME, clampPitch, attachOrbit } from './orbit.js?v=1';

// 모형: three.js 예제의 Xbot (Mixamo 뼈 이름). 우리 저장소에 두지 않고 three.js 저장소 것을 그대로 불러 쓴다
export const MODEL_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Xbot.glb';
const BONE_PREFIX = 'mixamorig';
const BODY_COLOR = '#d5dae3', JOINT_COLOR = '#4b8cf5', BG = '#0b0d12';
const GRID_M = 2, GRID_CELLS = 4, SHADOW_R = 0.42, SOLE_M = 0.06, MAX_PIXEL_RATIO = 2;

// MediaPipe 관절 번호
const NOSE = 0, EAR_L = 7, EAR_R = 8, SH_L = 11, SH_R = 12, HIP_L = 23, HIP_R = 24;
// 팔다리: [모형 뼈, 그 뼈가 가리키는 자식 뼈, 시작 관절, 끝 관절] — 부모 뼈부터 차례로 돌려야 한다
const LIMBS = [
  ['LeftArm', 'LeftForeArm', 11, 13], ['LeftForeArm', 'LeftHand', 13, 15], ['LeftHand', 'LeftHandMiddle1', 15, 19],
  ['RightArm', 'RightForeArm', 12, 14], ['RightForeArm', 'RightHand', 14, 16], ['RightHand', 'RightHandMiddle1', 16, 20],
  ['LeftUpLeg', 'LeftLeg', 23, 25], ['LeftLeg', 'LeftFoot', 25, 27], ['LeftFoot', 'LeftToeBase', 27, 31],
  ['RightUpLeg', 'RightLeg', 24, 26], ['RightLeg', 'RightFoot', 26, 28], ['RightFoot', 'RightToeBase', 28, 32],
];
const FOOT_BONES = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];

// ── 계산 (three.js 없이도 돈다 · 테스트 대상) ─────────────────
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const half = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };

// MediaPipe 좌표(y 아래 · z 멀어짐) → 3D 장면 좌표(y 위 · z 가까워짐)
export const toScene = (p) => [p.x, -p.y, -p.z];

// 몸의 왼쪽 방향과 대략의 위 방향 → 서로 직각인 { left, up, forward } (모형 기본 자세: 왼쪽 +X · 위 +Y · 앞 +Z)
export function bodyAxes(left, upHint) {
  const l = unit(left), f = unit(cross(l, upHint)), u = unit(cross(f, l));
  return { left: l, up: u, forward: f };
}

// 한 프레임의 관절 → 모형에 줄 목표 { hips, chest, head: 축 셋, limbs: [{ bone, child, dir }] }
export function poseTargets(world) {
  const p = world.map(toScene), up = minus(half(p[SH_L], p[SH_R]), half(p[HIP_L], p[HIP_R]));
  const earLine = unit(minus(p[EAR_L], p[EAR_R])), face = unit(minus(p[NOSE], half(p[EAR_L], p[EAR_R])));
  return {
    hips: bodyAxes(minus(p[HIP_L], p[HIP_R]), up),
    chest: bodyAxes(minus(p[SH_L], p[SH_R]), up),
    head: bodyAxes(earLine, cross(face, earLine)),
    limbs: LIMBS.map(([bone, child, from, to]) => ({ bone, child, dir: unit(minus(p[to], p[from])) })),
  };
}

// 선 화면(skeleton3d.js rotatePoint)과 같은 방향으로 돌리는 장면 회전 → { x, y } (라디안, x 축 다음 y 축 순서 'XYZ')
export const viewRotation = (yawDeg, pitchDeg) => ({ x: (pitchDeg * Math.PI) / 180, y: (-yawDeg * Math.PI) / 180 });

// ── 모형 (three.js) ─────────────────────────────────────────
async function loadKit() {
  const [THREE, loader] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
  return { THREE, GLTFLoader: loader.GLTFLoader };
}

// 모형을 읽어 골반이 원점에 오게 놓는다 → { model, bones(이름 → 뼈), rest(이름 → 기본 자세의 로컬 · 월드 회전) }
async function loadModel(THREE, GLTFLoader) {
  const model = (await new GLTFLoader().loadAsync(MODEL_URL)).scene, bones = {}, rest = {};
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;   // 뼈를 돌리면 처음 계산한 경계 밖으로 나가 잘려 보일 수 있다
      o.material = new THREE.MeshStandardMaterial({ color: /Joints/.test(o.name) ? JOINT_COLOR : BODY_COLOR, roughness: 0.55, metalness: 0.05 });
    }
  });
  model.updateMatrixWorld(true);
  model.position.sub(model.getObjectByName(`${BONE_PREFIX}Hips`).getWorldPosition(new THREE.Vector3()));
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isBone) return;
    const name = o.name.slice(BONE_PREFIX.length);
    bones[name] = o;
    rest[name] = { local: o.quaternion.clone(), world: o.getWorldQuaternion(new THREE.Quaternion()) };
  });
  return { model, bones, rest };
}

// 뼈를 돌리는 도구 → apply(targets)
function createRig(THREE, bones, rest) {
  const q = () => new THREE.Quaternion(), v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const position = (b) => b.getWorldPosition(new THREE.Vector3());
  const setWorld = (b, world) => { b.quaternion.copy(b.parent.getWorldQuaternion(q()).invert().multiply(world)); b.updateMatrixWorld(true); };
  // 몸통 · 머리: 세 축으로 방향을 통째로 정한다
  const orient = (name, axes) => {
    const turn = q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(axes.left), v(axes.up), v(axes.forward)));
    setWorld(bones[name], turn.multiply(rest[name].world));
  };
  // 팔다리: 뼈가 자식 뼈를 가리키는 방향만 목표에 맞춘다(뼈 둘레의 비틀림은 그대로 둔다)
  const aim = (name, child, dir) => {
    const b = bones[name], now = position(bones[child]).sub(position(b)).normalize();
    setWorld(b, q().setFromUnitVectors(now, v(dir)).multiply(b.getWorldQuaternion(q())));
  };
  return {
    apply(targets) {
      for (const name of Object.keys(bones)) bones[name].quaternion.copy(rest[name].local);
      bones.Hips.updateMatrixWorld(true);
      orient('Hips', targets.hips); orient('Spine2', targets.chest); orient('Head', targets.head);
      for (const l of targets.limbs) aim(l.bone, l.child, l.dir);
    },
    // 가장 낮은 발의 높이(바닥을 놓을 자리)
    floorY: () => Math.min(...FOOT_BONES.map((n) => position(bones[n]).y)) - SOLE_M,
  };
}

function createStage(THREE, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const scene = new THREE.Scene(), pivot = new THREE.Group(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 20);
  scene.background = new THREE.Color(BG);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2030, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  const grid = new THREE.GridHelper(GRID_M, GRID_CELLS, 0x3a4252, 0x2a303c);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(SHADOW_R, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }));
  shadow.rotation.x = -Math.PI / 2;
  pivot.add(grid, shadow);
  scene.add(sun, pivot);
  return { renderer, scene, pivot, camera, grid, shadow };
}

// 캔버스 크기에 맞춰 그림 크기와 카메라를 정한다. 화면에 안 보이면(크기 0) false
function fitStage(stage, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  stage.renderer.setSize(w, h, false);
  const c = stage.camera, halfW = (FRAME.heightM * w) / h / 2;
  c.left = -halfW; c.right = halfW; c.top = FRAME.heightM * FRAME.centerY; c.bottom = -FRAME.heightM * (1 - FRAME.centerY);
  c.updateProjectionMatrix();
  return true;
}

// 캔버스에 사람 모형 화면을 붙인다 → { setFrame(frame), setView(yaw, pitch), getView(), destroy() } (skeleton3d.js 와 같은 모양)
//  · 도구나 모형을 못 받거나 WebGL 을 못 쓰면 예외를 던진다 → 부르는 쪽이 선 화면으로 남긴다
export async function createAvatar(canvas) {
  const { THREE, GLTFLoader } = await loadKit();
  const { model, bones, rest } = await loadModel(THREE, GLTFLoader);
  const stage = createStage(THREE, canvas), rig = createRig(THREE, bones, rest), state = { yaw: 0, pitch: 0 };
  stage.pivot.add(model);
  model.visible = false;

  const draw = () => {
    if (!fitStage(stage, canvas)) return;
    const r = viewRotation(state.yaw, state.pitch);
    stage.pivot.rotation.set(r.x, r.y, 0, 'XYZ');
    stage.renderer.render(stage.scene, stage.camera);
  };
  const getView = () => ({ yaw: state.yaw, pitch: state.pitch });
  const setView = (yaw, pitch) => { state.yaw = yaw; state.pitch = clampPitch(pitch); draw(); };
  const detach = attachOrbit(canvas, getView, setView);
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);

  return {
    // 자세는 장면을 돌리지 않은 상태에서 잡는다(목표 방향이 돌리기 전 좌표라서)
    setFrame(frame) {
      model.visible = Boolean(frame && frame.world);
      if (model.visible) {
        stage.pivot.rotation.set(0, 0, 0);
        stage.pivot.updateMatrixWorld(true);
        rig.apply(poseTargets(frame.world));
        const floor = rig.floorY();
        stage.grid.position.y = floor;
        stage.shadow.position.y = floor + 0.002;
      }
      draw();
    },
    setView,
    getView,
    destroy() { detach(); observer.disconnect(); stage.renderer.dispose(); },
  };
}
