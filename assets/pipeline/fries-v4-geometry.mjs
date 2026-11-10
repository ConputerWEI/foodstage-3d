/** Baked, metre-scale fry variants. No I/O and no mutation of the source.
 * createFryVariants(json, bin) -> { json, bin, variants: { name: meshIndex } }.
 * Appended mesh.extras includes dimensions, dimensionsMm, capTriangles and provenance.
 * Nodes/scenes, source meshes, materials, image buffer views and binary prefix are retained.
 * Caps use every actual cut-boundary segment and a shared interior fan centre. This
 * closes the cut exactly but approximates non-star-convex/disconnected cross sections
 * with potentially overlapping interior triangles; it is not a volumetric remesh.
 */
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

const check=(condition,message)=>{if(!condition) throw new Error(message);};
const EPS=1e-10;
function readAccessor(json,bin,id) {
  const a=json.accessors?.[id]; check(a&&!a.sparse&&a.bufferView!==undefined,'Ordinary nonsparse attributes required');
  const view=json.bufferViews[a.bufferView]; check((view.buffer??0)===0&&!view.extensions?.EXT_meshopt_compression,'Embedded uncompressed buffer required');
  const formats={5120:[1,'readInt8'],5121:[1,'readUInt8'],5122:[2,'readInt16LE'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']};
  const [size,method]=formats[a.componentType]??[]; const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  check(size&&n,'Unsupported attribute format');
  return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,c)=>{
    let v=bin[method]((view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??size*n)+c*size);
    if(a.normalized&&a.componentType!==5126) { const signed=[5120,5122].includes(a.componentType); v=Math.max(signed?-1:0,v/(2**(size*8-(signed?1:0))-1)); }
    check(Number.isFinite(v),'Non-finite source attribute'); return v;
  }));
}
function localMatrix(node) {
  return node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation??[0,0,0])),new Quaternion(...(node.rotation??[0,0,0,1])),new Vector3(...(node.scale??[1,1,1])));
}
function bounds(points) {
  const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
  for(const p of points) {min.min(p);max.max(p);} return {min,max,size:max.clone().sub(min)};
}
// Same covariance Jacobi basis/sign convention and independent fitting as v3.
function normalizePca(points) {
  const mean=points.reduce((a,p)=>a.add(p),new Vector3()).multiplyScalar(1/points.length);
  const a=[[0,0,0],[0,0,0],[0,0,0]],v=[[1,0,0],[0,1,0],[0,0,1]];
  for(const point of points) {const d=point.clone().sub(mean).toArray(); for(let i=0;i<3;i++) for(let j=0;j<3;j++) a[i][j]+=d[i]*d[j];}
  for(let step=0;step<40;step++) {
    let p=0,q=1;for(const [i,j] of [[0,2],[1,2]]) if(Math.abs(a[i][j])>Math.abs(a[p][q])) {p=i;q=j;}
    if(Math.abs(a[p][q])<1e-14) break;
    const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle),app=a[p][p],aqq=a[q][q],apq=a[p][q];
    for(let k=0;k<3;k++) if(k!==p&&k!==q) {const kp=a[k][p],kq=a[k][q];a[k][p]=a[p][k]=c*kp-s*kq;a[k][q]=a[q][k]=s*kp+c*kq;}
    a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;a[p][q]=a[q][p]=0;
    for(let k=0;k<3;k++) {const kp=v[k][p],kq=v[k][q];v[k][p]=c*kp-s*kq;v[k][q]=s*kp+c*kq;}
  }
  const axes=[0,1,2].sort((i,j)=>a[j][j]-a[i][i]).map(i=>new Vector3(v[0][i],v[1][i],v[2][i]));
  const x=axes[0],y=axes[2];
  for(const axis of [x,y]) {const dominant=axis.toArray().reduce((best,n,i,arr)=>Math.abs(n)>Math.abs(arr[best])?i:best,0);if(axis.getComponent(dominant)<0) axis.negate();}
  const z=new Vector3().crossVectors(x,y).normalize();y.crossVectors(z,x).normalize();
  const rotation=new Matrix4().makeBasis(x,y,z).transpose(),b=bounds(points.map(p=>p.clone().applyMatrix4(rotation)));
  check(Math.min(...b.size.toArray())>1e-10,'Fry must have three nonzero dimensions');
  const center=b.min.clone().add(b.max).multiplyScalar(.5),scale=[.075/b.size.x,.010/b.size.y,.010/b.size.z];
  const matrix=new Matrix4().makeScale(...scale).multiply(new Matrix4().makeTranslation(-center.x,-center.y,-center.z)).multiply(rotation);
  return {matrix,metadata:{method:'v3 covariance Jacobi PCA; long X, thin Y; independent 75 x 10 x 10 mm fitting',targetDimensions:[.075,.010,.010],sourcePcaDimensions:b.size.toArray(),sourcePcaAxes:{long:x.toArray(),thin:y.toArray(),width:z.toArray()},axisScaleFactors:scale,normalizationMatrix:matrix.toArray()}};
}
function collectSource(json,bin) {
  const output=[];const roots=json.scenes?.[json.scene??0]?.nodes;check(roots?.length,'Source scene is empty');
  function visit(id,parent,ancestors=new Set()) {
    check(!ancestors.has(id),'Cyclic node graph');const node=json.nodes[id];check(node.skin===undefined,'Skinned source unsupported');
    const world=parent.clone().multiply(localMatrix(node));
    if(node.mesh!==undefined) for(const primitive of json.meshes[node.mesh].primitives) {
      check((primitive.mode??4)===4&&!primitive.targets?.length&&!primitive.extensions?.KHR_draco_mesh_compression,'Static uncompressed triangles required');
      const pos=readAccessor(json,bin,primitive.attributes.POSITION),norm=readAccessor(json,bin,primitive.attributes.NORMAL),uv=readAccessor(json,bin,primitive.attributes.TEXCOORD_0);
      check(pos.length===norm.length&&pos.length===uv.length,'Attribute counts differ');
      const normalMatrix=new Matrix3().getNormalMatrix(world);
      const vertices=pos.map((p,i)=>({p:new Vector3(...p).applyMatrix4(world),n:new Vector3(...norm[i]).applyMatrix3(normalMatrix).normalize(),uv:uv[i]}));
      let indices=primitive.indices===undefined?vertices.map((_,i)=>i):readAccessor(json,bin,primitive.indices).flat();
      check(indices.length%3===0&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length),'Invalid triangle indices');
      if(world.determinant()<0) {indices=[...indices];for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];}
      output.push({vertices,indices,material:primitive.material});
    }
    for(const child of node.children??[]) visit(child,world,new Set(ancestors).add(id));
  }
  for(const id of roots) visit(id,new Matrix4());check(output.length,'No source geometry');return output;
}
function blend(a,b,t,x) {
  return {p:a.p.clone().lerp(b.p,t).setX(x),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t)};
}
function geometry() {return {vertices:[],indices:[]};}
function triangle(g,a,b,c) {
  if(new Vector3().crossVectors(b.p.clone().sub(a.p),c.p.clone().sub(a.p)).lengthSq()<1e-28) return;
  const i=g.vertices.length;g.vertices.push(a,b,c);g.indices.push(i,i+1,i+2);
}
function clip(primitives,x) {
  const segments=[];
  const skins=primitives.map(source=>{
    const g={...geometry(),material:source.material};
    for(let i=0;i<source.indices.length;i+=3) {
      const input=source.indices.slice(i,i+3).map(id=>source.vertices[id]),polygon=[];
      for(let j=0;j<3;j++) {
        const a=input[j],b=input[(j+1)%3],insideA=a.p.x<=x,insideB=b.p.x<=x;
        if(insideA) polygon.push(a);
        if(insideA!==insideB) polygon.push(blend(a,b,(x-a.p.x)/(b.p.x-a.p.x),x));
      }
      for(let j=1;j+1<polygon.length;j++) triangle(g,polygon[0],polygon[j],polygon[j+1]);
      for(let j=0;j<polygon.length;j++) {const a=polygon[j],b=polygon[(j+1)%polygon.length];if(Math.abs(a.p.x-x)<EPS&&Math.abs(b.p.x-x)<EPS&&a.p.distanceToSquared(b.p)>1e-24) segments.push([a,b]);}
    }
    return g;
  }).filter(g=>g.indices.length);
  check(segments.length>=3,'Cut did not intersect a closed cross section');
  // Shared centre preserves every subdivided cut edge (including UV seam duplicates).
  // Unlike hull-only triangulation this cannot drop concave boundary detail.
  const center=segments.reduce((sum,[a,b])=>sum.add(a.p).add(b.p),new Vector3()).multiplyScalar(1/(segments.length*2));center.x=x;
  const cap=geometry();
  const vertex=p=>({p:p.clone(),n:new Vector3(1,0,0),uv:[p.y/.010+.5,p.z/.010+.5]});
  for(const [a,b] of segments) {
    let u=vertex(b.p),v=vertex(a.p);const c=vertex(center);
    if((u.p.y-center.y)*(v.p.z-center.z)-(u.p.z-center.z)*(v.p.y-center.y)<0) [u,v]=[v,u];
    triangle(cap,c,u,v);
  }
  return {skins,cap,segments:segments.length};
}
function bendVertex(vertex,scale,length,amplitude) {
  const p=vertex.p.clone(),n=vertex.n.clone();p.x*=scale;n.x/=scale;
  const t=p.x/length,dy=amplitude*Math.sin(Math.PI*(t+.5)),dz=amplitude*.45*Math.sin(2*Math.PI*t);
  const sy=amplitude*Math.PI/length*Math.cos(Math.PI*(t+.5)),sz=amplitude*.9*Math.PI/length*Math.cos(2*Math.PI*t);
  p.y+=dy;p.z+=dz;n.x-=sy*n.y+sz*n.z;n.normalize();
  return {p,n,uv:[...vertex.uv]};
}
function appendPrimitive(json,chunks,state,g,material,extras) {
  function add(array,type,componentType,target) {
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),padding=(4-state.offset%4)%4;
    if(padding) {chunks.push(Buffer.alloc(padding));state.offset+=padding;}
    const bufferView=json.bufferViews.push({buffer:0,byteOffset:state.offset,byteLength:bytes.length,target})-1;
    chunks.push(bytes);state.offset+=bytes.length;
    const components={SCALAR:1,VEC2:2,VEC3:3}[type],accessor={bufferView,componentType,count:array.length/components,type};
    if(type==='VEC3') {accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++) {accessor.min[i%3]=Math.min(accessor.min[i%3],array[i]);accessor.max[i%3]=Math.max(accessor.max[i%3],array[i]);}}
    return json.accessors.push(accessor)-1;
  }
  const attributes={POSITION:add(new Float32Array(g.vertices.flatMap(v=>v.p.toArray())),'VEC3',5126,34962),NORMAL:add(new Float32Array(g.vertices.flatMap(v=>v.n.toArray())),'VEC3',5126,34962),TEXCOORD_0:add(new Float32Array(g.vertices.flatMap(v=>v.uv)),'VEC2',5126,34962)};
  const indices=add(new Uint32Array(g.indices),'SCALAR',5125,34963);
  return {attributes,indices,mode:4,...(material===undefined?{}:{material}),...(extras?{extras}:{})};
}

export function createFryVariants(sourceJson,sourceBin) {
  check(sourceJson.buffers?.length===1&&!sourceJson.buffers[0].uri,'One embedded GLB buffer required');
  check(!sourceJson.animations?.length,'Animated source must be baked first');
  const source=collectSource(sourceJson,sourceBin),pca=normalizePca(source.flatMap(p=>p.vertices.map(v=>v.p)));
  const normalMatrix=new Matrix3().getNormalMatrix(pca.matrix);
  const baked=source.map(g=>({...g,vertices:g.vertices.map(v=>({p:v.p.clone().applyMatrix4(pca.matrix),n:v.n.clone().applyMatrix3(normalMatrix).normalize(),uv:[...v.uv]}))}));
  const json=structuredClone(sourceJson);json.materials??=[];json.bufferViews??=[];json.accessors??=[];json.meshes??=[];
  const chunks=[Buffer.from(sourceBin)],state={offset:sourceBin.length},variants={},metadata={};
  const interior=json.materials.push({name:'v4-pale-potato-interior',pbrMetallicRoughness:{baseColorFactor:[.95,.84,.55,1],metallicFactor:0,roughnessFactor:.94},extras:{provenance:'Procedural pale potato interior; untextured explicit cut surface'}})-1;
  for(const spec of [
    {name:'long',length:.082,bend:.0011},{name:'medium',length:.065,bend:-.0007},{name:'short',length:.048,bend:.0008},
    {name:'half',length:.035,cut:true},{name:'stub',length:.022,cut:true},
    {name:'crumb5',length:.005,crumb:true},{name:'crumb7',length:.007,crumb:true},{name:'crumb9',length:.009,crumb:true}
  ]) {
    let skins,cap,segments=0;
    if(spec.cut||spec.crumb) {
      const clipped=clip(baked,-.0375+spec.length);skins=clipped.skins;cap=clipped.cap;segments=clipped.segments;
      // Crumbs are clipped source ends, with narrower cross section and their own caps.
      if(spec.crumb) for(const g of [...skins,cap]) g.vertices=g.vertices.map(v=>{const p=v.p.clone(),n=v.n.clone();p.y*=.62;p.z*=.58;n.y/=.62;n.z/=.58;n.normalize();return {...v,p,n};});
    } else skins=baked.map(g=>({...g,vertices:g.vertices.map(v=>bendVertex(v,spec.length/.075,spec.length,spec.bend))}));
    const all=[...skins,...(cap?[cap]:[])],points=all.flatMap(g=>g.vertices.map(v=>v.p)),b=bounds(points),center=b.min.clone().add(b.max).multiplyScalar(.5);
    // Shared source endpoints occur in many triangles: avoid repeated in-place translation.
    for(const g of all) g.vertices=g.vertices.map(v=>({...v,p:v.p.clone().sub(center)}));
    const extras={variant:spec.name,units:'metres',dimensions:b.size.toArray(),dimensionsMm:b.size.toArray().map(n=>n*1000),capTriangles:cap?cap.indices.length/3:0,cutBoundarySegments:segments,sourceMaterialsRetained:true,construction:spec.cut?'Triangle-plane X clipping of baked 75mm fry':spec.crumb?'Clipped source fry end; reduced cross section':'Longitudinal scale plus gentle analytic bend',longitudinalScale:spec.cut||spec.crumb?1:spec.length/.075,bendAmplitude:spec.bend??0,...(cap?{capApproximation:'Exact cut-boundary segments joined to shared centre; closed triangle fan; non-star-convex or disconnected sections can overlap',cutSourceX:-.0375+spec.length}:{} )};
    const primitives=skins.map(g=>appendPrimitive(json,chunks,state,g,g.material));
    if(cap) primitives.push(appendPrimitive(json,chunks,state,cap,interior,{interiorCap:true}));
    variants[spec.name]=json.meshes.push({name:`fry-v4-${spec.name}`,primitives,extras})-1;metadata[spec.name]={mesh:variants[spec.name],...extras};
  }
  const bin=Buffer.concat(chunks);json.buffers[0]={...json.buffers[0],byteLength:bin.length};
  json.extras={...json.extras,fryVariants:{units:'metres',normalization:pca.metadata,variants:metadata,sourceRetained:true}};
  return {json,bin,variants};
}
