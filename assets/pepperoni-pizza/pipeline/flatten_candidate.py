import io,json,struct,copy
from pathlib import Path
import numpy as np
from PIL import Image
root=Path('artifacts/pizza-back-front-fix-20261107');src=root/'stage2-repaired.glb';b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);blob=bytearray(b[28+n:]);blob=blob[:doc['buffers'][0]['byteLength']]
def read(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];return np.ndarray((a['count'],k),dtype=dt,buffer=blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*k),np.dtype(dt).itemsize)).copy()
def add(a,typ,target=34962):
 while len(blob)%4:blob.append(0)
 a=np.ascontiguousarray(a);vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':a.nbytes,'target':target});blob.extend(a.tobytes());ac={'bufferView':vi,'componentType':5126,'count':len(a),'type':typ}
 if typ=='VEC3':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 ai=len(doc['accessors']);doc['accessors'].append(ac);return ai
# Duplicate each primitive's attributes and flatten the common lower crust band.
new=[];floor=float(read(doc['meshes'][0]['primitives'][0]['attributes']['POSITION'])[:,1].min());threshold=-0.0015
for p in doc['meshes'][0]['primitives']:
 attrs={k:read(i) for k,i in p['attributes'].items()};pos=attrs['POSITION'];mask=pos[:,1]<threshold;pos[mask,1]=floor
 ix=read(p['indices']).reshape(-1,3);pts=pos[ix];cross=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0]);area=np.linalg.norm(cross,axis=1);valid=area>1e-12;ix=ix[valid];cross=cross[valid];norm=cross/np.linalg.norm(cross,axis=1)[:,None]
 # Rebuild flat normals only on deformed faces; preserve original topping normals.
 changed=mask[ix].any(axis=1);normals=attrs['NORMAL'][ix].copy();normals[changed]=np.repeat(norm[changed,None,:],3,axis=1)
 for is_dough in (False,True):
  centers=pos[ix].mean(axis=1);dough=(np.abs(pos[ix][:,:,1]-floor).max(axis=1)<1e-7)|((centers[:,1]<0)&(np.abs(norm[:,1])<.7))
  select=dough if is_dough else ~dough
  if not select.any():continue
  pp=pos[ix[select]].reshape(-1,3).astype('<f4');nn=normals[select].reshape(-1,3).astype('<f4');uv=attrs['TEXCOORD_0'][ix[select]].reshape(-1,2).astype('<f4')
  if is_dough:uv=np.column_stack(((pp[:,0]+.15)/.3,(pp[:,2]+.15)/.3+(pp[:,1]-floor)*3)).astype('<f4')
  q={'attributes':{'POSITION':add(pp,'VEC3'),'NORMAL':add(nn,'VEC3'),'TEXCOORD_0':add(uv,'VEC2')},'material':1 if is_dough else p['material'],'mode':4}
  ind=np.arange(len(pp),dtype='<u4');ai=add(ind,'SCALAR',34963);doc['accessors'][ai]['componentType']=5125;q['indices']=ai;new.append(q)
doc['meshes'][0]['primitives']=new;doc['buffers'][0]['byteLength']=len(blob)
while len(blob)%4:blob.append(0)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out=struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(blob),b'BIN\x00')+blob;(root/'stage2-flat-candidate.glb').write_bytes(out);print('floor',floor,'flattened vertices',int(mask.sum()))
