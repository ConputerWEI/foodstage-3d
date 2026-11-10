import json,struct,copy
from pathlib import Path
import numpy as np
from shapely.geometry import LineString
from shapely.ops import polygonize,unary_union,triangulate
root=Path('artifacts/pizza-back-front-fix-20261107');b=(root/'stage2-repaired.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);binary=bytearray(b[28+n:]);binary=binary[:doc['buffers'][0]['byteLength']]
def arr(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];return np.ndarray((a['count'],k),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*k),np.dtype(dt).itemsize)).copy()
def add(a,kind):
 a=np.asarray(a,dtype='<f4');
 while len(binary)%4:binary.append(0)
 vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes,'target':34962});binary.extend(a.tobytes());ac={'bufferView':vi,'componentType':5126,'count':len(a),'type':kind}
 if kind=='VEC3':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 ai=len(doc['accessors']);doc['accessors'].append(ac);return ai
prims=[];segments=[]
for p in doc['meshes'][0]['primitives']:
 arrays={k:arr(v) for k,v in p['attributes'].items()};ix=arr(p['indices']).reshape(-1,3);vertices=[]
 for t in ix:
  poly=[np.concatenate([arrays[k][i] for k in ['POSITION','NORMAL','TEXCOORD_0']]).astype(float) for i in t];out=[];cross=[]
  for a,c in zip(poly,poly[1:]+poly[:1]):
   ia=a[2]<=0;ic=c[2]<=0
   if ia:out.append(a)
   if ia!=ic:
    f=-a[2]/(c[2]-a[2]);v=a+f*(c-a);v[2]=0;out.append(v);cross.append(v[:3])
  if len(cross)==2:segments.append([cross[0],cross[1]])
  for i in range(1,len(out)-1):vertices.extend([out[0],out[i],out[i+1]])
 v=np.array(vertices);norm=v[:,3:6];norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-10)
 prims.append({'attributes':{'POSITION':add(v[:,:3],'VEC3'),'NORMAL':add(norm,'VEC3'),'TEXCOORD_0':add(v[:,6:8],'VEC2')},'material':p['material'],'mode':4})
# Reconstruct the planar cut boundary; rounding joins duplicate seam vertices from independent UV islands.
lines=[LineString([tuple(np.round(a[:2],7)),tuple(np.round(c[:2],7))]) for a,c in segments if np.linalg.norm(a-c)>1e-8]
polys=list(polygonize(unary_union(lines)));caps=[]
for poly in polys:
 for t in triangulate(poly):
  if not poly.covers(t):continue
  q=np.array([[x,y,0] for x,y in list(t.exterior.coords)[:3]])
  if np.cross(q[1]-q[0],q[2]-q[0])[2]<0:q=q[::-1]
  caps.extend(q)
assert len(caps)>0, 'No valid cut caps'
v=np.array(caps);uv=np.column_stack(((v[:,0]+.15)/.3,(v[:,1]+.015)/.03))
prims.append({'attributes':{'POSITION':add(v,'VEC3'),'NORMAL':add(np.tile([0,0,1],(len(v),1)),'VEC3'),'TEXCOORD_0':add(uv,'VEC2')},'material':1,'mode':4})
doc['meshes'][0]['primitives']=prims;doc['buffers'][0]['byteLength']=len(binary)
while len(binary)%4:binary.append(0)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out=struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\x00')+binary;(root/'stage3-derived.glb').write_bytes(out)
print(json.dumps({'cutSegments':len(segments),'capPolygons':len(polys),'capTriangles':len(caps)//3,'outputBytes':len(out)}))
