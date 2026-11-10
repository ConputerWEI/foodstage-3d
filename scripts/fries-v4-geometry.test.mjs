import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readGlb, writeGlb } from './assemble-rosemary-fries-v3.mjs';
import { BoxGeometry } from 'three';

const source = readGlb(readFileSync(new URL('../artifacts/rosemary-fries/v3/single-fry.glb', import.meta.url)));
function values(json, bin, id) {
  const a=json.accessors[id], v=json.bufferViews[a.bufferView], n={SCALAR:1,VEC2:2,VEC3:3}[a.type];
  const size=a.componentType===5123?2:4, method=a.componentType===5126?'readFloatLE':a.componentType===5123?'readUInt16LE':'readUInt32LE';
  return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,c)=>bin[method]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??n*size)+c*size)));
}
let result;
test('exports the geometry builder', async()=>{
  const module=await import('./fries-v4-geometry.mjs').catch(()=>({}));
  assert.equal(typeof module.createFryVariants,'function','createFryVariants must be implemented');
  result=module.createFryVariants(source.json, source.bin);
});
test('keeps source byte ranges, source data, materials and source JSON immutable',()=>{
  assert.ok(result);
  assert.deepEqual(result.bin.subarray(0,source.bin.length),source.bin);
  for(const key of ['meshes','materials','images','textures','nodes','scenes','accessors','bufferViews'])
    assert.deepEqual(result.json[key].slice(0,source.json[key]?.length??0),source.json[key]??[]);
  assert.equal(source.json.meshes.length,1);
});
test('baked variants have finite geometry, normalized normals and requested lengths',()=>{
  assert.ok(result);
  for(const [name,length] of Object.entries({long:82,medium:65,short:48,half:35,stub:22,crumb5:5,crumb7:7,crumb9:9})) {
    const mesh=result.json.meshes[result.variants[name]]; assert.ok(mesh,name);
    const points=mesh.primitives.flatMap(p=>values(result.json,result.bin,p.attributes.POSITION));
    assert.ok(points.flat().every(Number.isFinite),name);
    const actual=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
    assert.ok(Math.abs(actual-length/1000)<1e-7,`${name} length ${actual}`);
    for(const p of mesh.primitives) {
      for(const n of values(result.json,result.bin,p.attributes.NORMAL)) assert.ok(Math.abs(Math.hypot(...n)-1)<1e-5);
      assert.ok(values(result.json,result.bin,p.attributes.TEXCOORD_0).flat().every(Number.isFinite));
    }
  }
});
test('serialized output round trips with the complete original binary prefix',()=>{
  const decoded=readGlb(writeGlb(result.json,result.bin));
  assert.deepEqual(decoded.bin.subarray(0,source.bin.length),source.bin);
  assert.deepEqual(decoded.json.meshes,result.json.meshes);
});
test('cut edges interpolate longitudinal UV coordinates rather than snapping to endpoints',async()=>{
  const box=new BoxGeometry(.075,.009,.010), chunks=[],json={asset:{version:'2.0'},buffers:[{}],bufferViews:[],accessors:[],materials:[{name:'test-skin'}],meshes:[],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
  function add(array,type) {
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),offset=chunks.reduce((n,b)=>n+b.length,0);
    chunks.push(bytes);const bufferView=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
    return json.accessors.push({bufferView,componentType:array instanceof Float32Array?5126:5123,count:array.length/(type==='VEC3'?3:type==='VEC2'?2:1),type})-1;
  }
  const pos=box.attributes.position.array,uv=new Float32Array(pos.length/3*2);
  for(let i=0;i<pos.length/3;i++) {uv[2*i]=(pos[3*i]+.0375)/.075;uv[2*i+1]=pos[3*i+2]/.010+.5;}
  json.meshes.push({primitives:[{attributes:{POSITION:add(pos,'VEC3'),NORMAL:add(box.attributes.normal.array,'VEC3'),TEXCOORD_0:add(uv,'VEC2')},indices:add(box.index.array,'SCALAR'),material:0}]});
  const bin=Buffer.concat(chunks);json.buffers[0].byteLength=bin.length;
  const {createFryVariants}=await import('./fries-v4-geometry.mjs'),out=createFryVariants(json,bin),mesh=out.json.meshes[out.variants.half];
  for(const primitive of mesh.primitives.filter(p=>!p.extras?.interiorCap)) {
    const points=values(out.json,out.bin,primitive.attributes.POSITION),uvs=values(out.json,out.bin,primitive.attributes.TEXCOORD_0);
    const cut=points.map((p,i)=>[p,i]).filter(([p])=>Math.abs(p[0]-.0175)<1e-8);
    assert.ok(cut.length>=4);
    for(const [,i] of cut) assert.ok(Math.abs(uvs[i][0]-35/75)<1e-6,`cut UV ${uvs[i][0]}`);
  }
});
test('half and stub use real clipped textured skins and closed pale cut caps',()=>{
  assert.ok(result);
  for(const name of ['half','stub','crumb5','crumb7','crumb9']) {
    const mesh=result.json.meshes[result.variants[name]], caps=mesh.primitives.filter(p=>p.extras?.interiorCap);
    assert.ok(caps.length>0,name); assert.ok(mesh.extras.capTriangles>0);
    const skin=mesh.primitives.filter(p=>!p.extras?.interiorCap);
    assert.ok(skin.every(p=>p.material===0));
    assert.ok(skin.reduce((sum,p)=>sum+result.json.accessors[p.indices].count,0)<89727,'clipping removes source triangles');
    for(const cap of caps) {
      const pos=values(result.json,result.bin,cap.attributes.POSITION), normal=values(result.json,result.bin,cap.attributes.NORMAL), idx=values(result.json,result.bin,cap.indices).flat();
      const x=pos[0][0], edges=new Map();
      const key=p=>p.map(n=>Math.round(n/1e-8)).join(',');
      for(const p of mesh.primitives) {
        const points=values(result.json,result.bin,p.attributes.POSITION), ids=values(result.json,result.bin,p.indices).flat();
        for(let i=0;i<ids.length;i+=3) for(const [a,b] of [[0,1],[1,2],[2,0]]) {
          const u=points[ids[i+a]],v=points[ids[i+b]];
          if(Math.abs(u[0]-x)>1e-8||Math.abs(v[0]-x)>1e-8||key(u)===key(v)) continue;
          const k=[key(u),key(v)].sort().join('|'); edges.set(k,(edges.get(k)??0)+1);
        }
      }
      assert.ok([...edges.values()].every(n=>n%2===0),`${name}: open cut boundary`);
      for(let i=0;i<idx.length;i+=3) {
        const [a,b,c]=idx.slice(i,i+3).map(j=>pos[j]);
        const cross=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
        assert.ok(cross*normal[idx[i]][0]>=-1e-14,'cap winding faces outward');
      }
      const mat=result.json.materials[cap.material]; assert.ok(mat.pbrMetallicRoughness.baseColorFactor[0]>.75);
      assert.equal(mat.pbrMetallicRoughness.baseColorTexture,undefined);
    }
  }
});
