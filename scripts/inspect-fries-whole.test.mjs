import test from 'node:test';
import assert from 'node:assert/strict';

// Catch lost world transforms, hemisphere false positives, and silent compressed geometry skips.
const load = () => import('./inspect-fries-whole.mjs');
function fixture(partial = false) {
  const points = [];
  for (let i = 0; i < 144; i++) {
    const a = i / 144 * Math.PI * (partial ? 1 : 2);
    points.push(Math.cos(a), 0, Math.sin(a));
  }
  points.push(0, .3, 0, 0, 0, 0);
  const bin = Buffer.alloc(points.length * 4);
  points.forEach((n, i) => bin.writeFloatLE(n, i * 4));
  const json = { asset: { version: '2.0' }, buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteLength: bin.length }], accessors: [{ bufferView: 0, componentType: 5126, type: 'VEC3', count: points.length / 3 }], meshes: [{ primitives: [{ mode: 5, attributes: { POSITION: 0 } }] }], nodes: [{ translation: [10, 2, -5], children: [1] }, { mesh: 0, scale: [2, 2, 2] }], scenes: [{ nodes: [0] }], scene: 0 };
  return { json, bin };
}
test('world bounds and full low-band angular coverage survive parent transforms', async () => {
  const { inspectGlb } = await load(); const { json, bin } = fixture();
  const r = inspectGlb(json, bin);
  assert.deepEqual(r.worldBounds.min, [8, 2, -7]);
  assert.deepEqual(r.worldBounds.max, [12, 2.600000023841858, -3]);
  assert.equal(r.counts.worldVertices, 146);
  assert.equal(r.plateEvidence.lowBand.outerAngularCoverage, 1);
  assert.equal(r.orientation.yUpPlausible, true);
});
test('half-circle low band does not become full plate evidence', async () => {
  const { inspectGlb } = await load(); const { json, bin } = fixture(true);
  const r = inspectGlb(json, bin);
  assert.ok(r.plateEvidence.lowBand.outerAngularCoverage < .8);
  assert.equal(r.plateEvidence.circularExtentSupported, false);
});
test('image metadata reports embedded PNG dimensions', async () => {
  const { inspectGlb } = await load(); const { json, bin } = fixture();
  const png = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.write('IHDR', 12); png.writeUInt32BE(512,16); png.writeUInt32BE(256,20);
  json.images = [{ uri: `data:image/png;base64,${png.toString('base64')}` }];
  const r = inspectGlb(json, bin);
  assert.equal(r.counts.embeddedImages, 1);
  assert.deepEqual([r.images[0].width, r.images[0].height], [512,256]);
});
test('rejects compressed or sparse POSITION instead of issuing misleading success', async () => {
  const { inspectGlb } = await load(); const { json, bin } = fixture();
  json.accessors[0].sparse = { count: 1 };
  assert.throws(() => inspectGlb(json, bin), /sparse/i);
});
