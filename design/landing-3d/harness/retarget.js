// Retarget a Mixamo clip (T-pose rest, mixamorig bones) onto the CC0 body (A-pose rest, identity bone rotations).
// Per bone: world delta from the source rest, applied after aligning the target rest bone direction to the source's.
import * as THREE from 'three';
const strip = (n) => n.replace(/^mixamorig:?/, '');
export function makeRetargeter(srcRoot, tgtBones) {
  const src = {}; srcRoot.traverse(o => { if (o.isBone) src[strip(o.name)] = o; });
  srcRoot.updateMatrixWorld(true);
  const names = Object.keys(tgtBones).filter(n => src[n]);
  const S0inv = {}, C = {}, wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const firstChild = (b) => b.children.find(c => c.isBone && src[strip(c.name)]);
  for (const n of names) {
    S0inv[n] = src[n].getWorldQuaternion(new THREE.Quaternion()).invert();
    const sc = firstChild(src[n]), tb = tgtBones[n], tc = tb.children.find(c => c.isBone && strip(c.name) === (sc && strip(sc.name)));
    C[n] = new THREE.Quaternion();
    if (sc && tc) {
      const sd = wp(sc).sub(wp(src[n])).normalize();
      const td = tc.getWorldPosition(new THREE.Vector3()).sub(tb.getWorldPosition(new THREE.Vector3())).normalize();
      C[n].setFromUnitVectors(td, sd);
    }
  }
  // fingers/toes inherit their parent's alignment when they have no child to measure
  for (const n of names) if (C[n].equals(new THREE.Quaternion())) { let p = tgtBones[n].parent; while (p && p.isBone && C[strip(p.name)] && C[strip(p.name)].equals(new THREE.Quaternion())) p = p.parent; if (p && p.isBone && C[strip(p.name)]) C[n].copy(C[strip(p.name)]); }
  const hipsS0 = wp(src.Hips), hipsT0 = tgtBones.Hips.position.clone();
  const ratio = tgtBones.Hips.getWorldPosition(new THREE.Vector3()).y / Math.max(1e-6, hipsS0.y - srcRoot.getWorldPosition(new THREE.Vector3()).y);   // hip height ratio (both rest on y = 0)
  const W = {}, q = new THREE.Quaternion();
  // order: parents before children
  const ordered = []; const visit = (b) => { if (b.isBone && tgtBones[strip(b.name)] && src[strip(b.name)]) ordered.push(strip(b.name)); b.children.forEach(visit); };
  visit(tgtBones.Hips);
  return {
    names: ordered,
    apply() {   // call after the source mixer has been advanced
      srcRoot.updateMatrixWorld(true);
      for (const n of ordered) {
        const tb = tgtBones[n];
        W[n] = src[n].getWorldQuaternion(new THREE.Quaternion()).multiply(S0inv[n]).multiply(C[n]);   // target world rotation
        const pn = tb.parent && tb.parent.isBone ? strip(tb.parent.name) : null;
        tb.quaternion.copy(pn && W[pn] ? q.copy(W[pn]).invert().multiply(W[n]) : W[n]);
      }
      const d = wp(src.Hips).sub(hipsS0).multiplyScalar(ratio / tgtBones.Hips.parent.getWorldScale(new THREE.Vector3()).y);
      tgtBones.Hips.position.copy(hipsT0).add(d);
    }
  };
}
