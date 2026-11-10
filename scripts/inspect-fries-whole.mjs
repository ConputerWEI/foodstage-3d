#!/usr/bin/env node
/** Read-only static GLB inspection. No API calls, model rewrites, or application writes.
 * node scripts/inspect-fries-whole.mjs
 * Geometry measurements use the default scene and world transforms, in native glTF units.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Matrix4, Vector3, Quaternion } from 'three';
import { readGlb } from './assemble-rosemary-fries-v3.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ARG = process.argv[2];
const INPUT = resolve(ROOT, ARG ?? 'artifacts/rosemary-fries/v5/whole-dish.glb');
const OUTPUT = resolve(ROOT, process.argv[3] ?? `${ARG?.replace(/\\/g,'/').replace(/\.glb$/,'') ?? 'artifacts/rosemary-fries/v5'}/inspection.json`);
const check = (ok, message) => { if (!ok) throw new Error(message); };
const formats = { 5120:[1,'readInt8'],5121:[1,'readUInt8'],5122:[2,'readInt16LE'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE'] };

function accessor(json, bin, id, type) {
  const a = json.accessors?.[id];
  check(a && !a.sparse && a.bufferView !== undefined, `Accessor ${id}: sparse or absent bufferView unsupported; provide plain accessors`);
  const v = json.bufferViews?.[a.bufferView];
  check(v && (v.buffer ?? 0) === 0 && !v.extensions?.EXT_meshopt_compression, `Accessor ${id}: external or meshopt-compressed buffer unsupported`);
  const [size, method] = formats[a.componentType] ?? [];
  check(size && a.type === type, `Accessor ${id}: expected ${type} with supported component type`);
  check(Number.isInteger(a.count) && a.count >= 0, `Accessor ${id}: invalid count`);
  const n = type === 'VEC3' ? 3 : 1;
  const stride = v.byteStride ?? n * size;
  const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const end = offset + (a.count ? (a.count - 1) * stride + n * size : 0);
  check(stride >= n * size && offset >= (v.byteOffset ?? 0) && end <= (v.byteOffset ?? 0) + v.byteLength && end <= bin.length, `Accessor ${id}: byte range or stride invalid`);
  const values = [];
  for (let i = 0; i < a.count; i++) {
    const value = [];
    for (let c = 0; c < n; c++) {
      let x = bin[method](offset + i * stride + c * size);
      if (a.normalized && a.componentType !== 5126) {
        const signed = [5120,5122].includes(a.componentType);
        x = Math.max(signed ? -1 : 0, x / (2 ** (8 * size - (signed ? 1 : 0)) - 1));
      }
      check(Number.isFinite(x), `Accessor ${id}: non-finite value`); value.push(x);
    }
    values.push(n === 1 ? value[0] : value);
  }
  return values;
}
function bounds(points) {
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i],p[i]); max[i] = Math.max(max[i],p[i]); }
  return { min, max, size: max.map((v,i) => v-min[i]), center: max.map((v,i) => (v+min[i])/2) };
}
function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), at = (sorted.length-1)*q;
  const i = Math.floor(at); return sorted[i] + (sorted[Math.ceil(at)]-sorted[i])*(at-i);
}
function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && bytes.toString('ascii',12,16) === 'IHDR') return { format:'PNG',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20) };
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 255) continue;
      while (bytes[p] === 255) p++;
      const marker = bytes[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      const length = bytes.readUInt16BE(p);
      if (length < 2 || p + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) return { format:'JPEG',height:bytes.readUInt16BE(p+3),width:bytes.readUInt16BE(p+5) };
      p += length;
    }
  }
  if (bytes.length >= 30 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    const type = bytes.toString('ascii',12,16);
    if (type === 'VP8X') return { format:'WebP',width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3) };
    if (type === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) return { format:'WebP',width:bytes.readUInt16LE(26)&16383,height:bytes.readUInt16LE(28)&16383 };
    if (type === 'VP8L' && bytes[20] === 0x2f) { const bits = bytes.readUInt32LE(21); return { format:'WebP',width:1+(bits&16383),height:1+((bits>>>14)&16383) }; }
  }
  if (bytes.length >= 44 && bytes.subarray(0,12).equals(Buffer.from('ab4b5458203230bb0d0a1a0a','hex'))) return { format:'KTX2',width:bytes.readUInt32LE(20),height:bytes.readUInt32LE(24) };
  return { format:'unknown',width:null,height:null, caveat:'Header dimensions unsupported or malformed; texture not decoded' };
}
function imageInfo(json, bin, image, index) {
  let bytes, embedded = false;
  if (image.bufferView !== undefined) {
    const v = json.bufferViews?.[image.bufferView];
    check(v && (v.buffer ?? 0) === 0 && !v.extensions?.EXT_meshopt_compression, `Image ${index}: invalid embedded bufferView`);
    const start = v.byteOffset ?? 0;
    check(start >= 0 && start + v.byteLength <= bin.length, `Image ${index}: out-of-range image bytes`);
    bytes = bin.subarray(start,start+v.byteLength); embedded = true;
  } else if (image.uri?.startsWith('data:')) {
    const match = /^data:([^,]*),(.*)$/s.exec(image.uri);
    check(match, `Image ${index}: malformed data URI`);
    bytes = match[1].endsWith(';base64') ? Buffer.from(match[2],'base64') : Buffer.from(decodeURIComponent(match[2]),'utf8'); embedded = true;
  }
  return { index,name:image.name ?? null,mimeType:image.mimeType ?? null,embedded,byteLength:bytes?.length ?? null,...(bytes ? imageDimensions(bytes) : { width:null,height:null,caveat:'External image not fetched' }) };
}
function lowBandEvidence(points, b) {
  const bins = 32, h = b.size[1];
  const histogram = Array.from({length:bins},(_,i) => ({ minY:b.min[1]+h*i/bins,maxY:b.min[1]+h*(i+1)/bins,vertices:0 }));
  for (const p of points) histogram[Math.min(bins-1,h ? Math.floor((p[1]-b.min[1])/h*bins) : 0)].vertices++;
  const ceiling = b.min[1]+h*.3;
  const low = points.filter(p => p[1] <= ceiling + Math.max(h,1)*1e-12);
  const bandBounds = bounds(low), center = [b.center[0], b.center[2]];
  const radii = low.map(p => Math.hypot(p[0]-center[0],p[2]-center[1]));
  const p95 = quantile(radii,.95), outerThreshold = p95*.75;
  const sectors = Array.from({length:72},(_,i) => ({startDegrees:i*5,endDegrees:(i+1)*5,vertices:0,outerVertices:0,maxRadius:0}));
  for (let i=0;i<low.length;i++) {
    const angle = (Math.atan2(low[i][2]-center[1],low[i][0]-center[0])+2*Math.PI)%(2*Math.PI);
    const s = sectors[Math.min(71,Math.floor(angle/(2*Math.PI)*72))];
    s.vertices++;s.maxRadius=Math.max(s.maxRadius,radii[i]);if (radii[i]>=outerThreshold && radii[i]>0) s.outerVertices++;
  }
  const outerAngularCoverage = sectors.filter(s => s.outerVertices>0).length/72;
  const sectorRadiusP10 = quantile(sectors.map(s=>s.maxRadius),.1), sectorRadiusP90 = quantile(sectors.map(s=>s.maxRadius),.9);
  const radialUniformity = sectorRadiusP90>0 ? sectorRadiusP10/sectorRadiusP90 : 0;
  const xzExtentRatio = Math.max(bandBounds.size[0],bandBounds.size[2])>0 ? Math.min(bandBounds.size[0],bandBounds.size[2])/Math.max(bandBounds.size[0],bandBounds.size[2]) : 0;
  const horizontalExtentFraction = [bandBounds.size[0]/(b.size[0]||1),bandBounds.size[2]/(b.size[2]||1)];
  return { histogram,lowBand:{ minY:b.min[1],maxY:ceiling,heightFraction:.3,vertices:low.length,vertexFraction:low.length/points.length,bounds:bandBounds,xzCenter:center,centerMethod:'Whole-scene XZ AABB midpoint; no recentering to fit plate',horizontalExtentFraction,xzExtentRatio,radius:{min:radii.reduce((a,v)=>Math.min(a,v),Infinity),p50:quantile(radii,.5),p95,max:radii.reduce((a,v)=>Math.max(a,v),0)},outerRadiusThreshold:outerThreshold,outerAngularCoverage,angularCoverage:sectors.filter(s=>s.vertices>0).length/72,radialUniformity,sectorRadiusP10,sectorRadiusP90,sectors },circularExtentSupported:outerAngularCoverage>=.9 && radialUniformity>=.75 && xzExtentRatio>=.8 && horizontalExtentFraction.every(x=>x>=.85),method:'Bottom 30% of world Y range; 72 azimuth sectors about whole-scene XZ center; outer vertices have radius >= 75% of low-band radius p95. Uniformity is sector-max radius p10/p90, including empty sectors as zero.',limitations:['Vertex-density weighted; not surface-area weighted and not a silhouette rasterization.','Circular low-band geometry supports plate-like extent, but does not identify ceramic, prove a closed plate, or establish aesthetics.'] };
}

export function inspectGlb(json, bin) {
  check(json.buffers?.length === 1 && !json.buffers[0].uri, 'Expected a single embedded binary buffer');
  check(!json.animations?.length, 'Animated GLB requires baked static geometry');
  const roots = json.scenes?.[json.scene ?? 0]?.nodes;
  check(Array.isArray(roots), 'Missing default scene roots');
  const points = [], primitives = [], meshIds = new Set(), materialIds = new Set();
  let triangles=0, instances=0;
  function visit(id,parent,ancestors=new Set()) {
    check(!ancestors.has(id), 'Cyclic node graph');
    const node = json.nodes?.[id]; check(node, `Invalid node ${id}`);
    check(node.skin===undefined && !node.extensions?.EXT_mesh_gpu_instancing, 'Skinning/GPU instances must be baked');
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3(...(node.translation??[0,0,0])),new Quaternion(...(node.rotation??[0,0,0,1])),new Vector3(...(node.scale??[1,1,1])));
    check(local.elements.every(Number.isFinite), `Non-finite transform at node ${id}`);
    const world=parent.clone().multiply(local);
    if (node.mesh!==undefined) {
      const mesh=json.meshes?.[node.mesh];check(mesh,`Invalid mesh ${node.mesh}`);meshIds.add(node.mesh);instances++;
      for (const [primitive,p] of mesh.primitives.entries()) {
        check(!p.targets?.length && !p.extensions?.KHR_draco_mesh_compression, 'Morph/Draco geometry must be baked/decompressed');
        const verts=accessor(json,bin,p.attributes?.POSITION,'VEC3');
        const ids=p.indices===undefined ? Array.from({length:verts.length},(_,i)=>i) : accessor(json,bin,p.indices,'SCALAR');
        if (p.indices!==undefined) check([5121,5123,5125].includes(json.accessors[p.indices].componentType) && !json.accessors[p.indices].normalized,'Invalid index component type');
        check(ids.every(i=>Number.isInteger(i)&&i>=0&&i<verts.length),'Index outside POSITION range');
        const mode=p.mode??4;check([4,5,6].includes(mode),'Non-triangle primitive unsupported');
        check(mode!==4 || ids.length%3===0,'TRIANGLES element count must be divisible by three');
        const count=mode===4 ? ids.length/3 : Math.max(0,ids.length-2);
        triangles+=count;
        for(const v of verts) { const point=new Vector3(...v).applyMatrix4(world).toArray();check(point.every(Number.isFinite),'Non-finite world position');points.push(point); }
        if(p.material!==undefined) {check(json.materials?.[p.material], 'Invalid material reference');materialIds.add(p.material);}
        primitives.push({node:id,mesh:node.mesh,primitive,mode,vertices:verts.length,triangles:count,material:p.material??null});
      }
    }
    const next=new Set(ancestors).add(id);for(const child of node.children??[])visit(child,world,next);
  }
  for(const root of roots)visit(root,new Matrix4());
  check(points.length>0,'No default-scene POSITION vertices');
  const worldBounds=bounds(points), plateEvidence=lowBandEvidence(points,worldBounds);
  const flatness=worldBounds.size[1]/Math.max(1e-30,Math.min(worldBounds.size[0],worldBounds.size[2]));
  const yUpPlausible=flatness<.6 && plateEvidence.circularExtentSupported;
  const images=(json.images??[]).map((im,i)=>imageInfo(json,bin,im,i));
  return { schemaVersion:1,status:'inspected',units:'Native GLB units; glTF convention is metres, but exporter scale is unverified',worldBounds,counts:{worldVertices:points.length,worldTriangles:triangles,meshDefinitions:json.meshes?.length??0,referencedMeshes:meshIds.size,meshInstances:instances,primitiveInstances:primitives.length,materials:json.materials?.length??0,referencedMaterials:materialIds.size,images:images.length,embeddedImages:images.filter(i=>i.embedded).length,textures:json.textures?.length??0},primitives,images,plateEvidence,orientation:{yUpPlausible,yHeightToMinHorizontalExtent:flatness,assessment:yUpPlausible?'Y-up plausible from shallow Y extent and broad circular low-Y geometry':'Orientation caveat: geometric evidence is insufficient to establish Y-up plate orientation',caveat:'glTF specifies Y-up; exporter compliance and semantic top/bottom cannot be proved from vertices. No automatic rotation applied.'},requestedGenerationContext:{provider:'Lux3D',references:['front','top','side','back'],targetFaces:100000,targetDiameterMillimetres:260,verification:'Caller-supplied expected input context, not provenance recovered from GLB'},limitations:['All POSITION vertices counted per primitive instance, including unreferenced vertices; triangles counted by topology, including degenerates.','Default scene only; no animation, deformation, external resources, compressed accessors, or semantic segmentation.','No aesthetics, food identity, reference fidelity, or provenance can be proved by this inspection.'] };
}

export function inspectFile() {
  if(!existsSync(INPUT)) { console.log('Inspector ready; whole-dish.glb is not present. No inspection output written; no polling.');return null; }
  const bytes=readFileSync(INPUT);
  const source={input:INPUT,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  let report;
  try { const {json,bin}=readGlb(bytes);report={...source,...inspectGlb(json,bin)}; }
  catch(error) { report={...source,status:'unsupported-or-invalid',error:error.message};mkdirSync(dirname(OUTPUT),{recursive:true});writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');throw error; }
  mkdirSync(dirname(OUTPUT),{recursive:true});writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output:OUTPUT,bounds:report.worldBounds,counts:report.counts,yUpPlausible:report.orientation.yUpPlausible,circularExtentSupported:report.plateEvidence.circularExtentSupported},null,2));return report;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { inspectFile(); }
  catch(error) { console.error(error.message);process.exitCode=1; }
}
