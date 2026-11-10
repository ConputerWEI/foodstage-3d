import io, json, struct, copy
from pathlib import Path
import numpy as np
from PIL import Image

root=Path('artifacts/pizza-back-front-fix-20261107')
src=Path('public/models/pepperoni-pizza-1.glb')
b=src.read_bytes(); jl=struct.unpack_from('<I',b,12)[0]; doc=json.loads(b[20:20+jl]); binary=bytearray(b[28+jl:]); binary=binary[:doc['buffers'][0]['byteLength']]
def read_accessor(i):
    a=doc['accessors'][i]; v=doc['bufferViews'][a['bufferView']]; dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]; n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]; item=np.dtype(dtype).itemsize
    return np.ndarray((a['count'],n),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',item*n),item)).copy()
def append(data,target=None):
    while len(binary)%4: binary.append(0)
    view={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
    if target: view['target']=target
    i=len(doc['bufferViews']); doc['bufferViews'].append(view);binary.extend(data);return i
def accessor(arr,typ,component,target):
    arr=np.ascontiguousarray(arr);v=append(arr.tobytes(),target);a={'bufferView':v,'componentType':component,'count':len(arr),'type':typ}
    if typ=='SCALAR': a.update(min=[int(arr.min())],max=[int(arr.max())])
    i=len(doc['accessors']);doc['accessors'].append(a);return i
p=doc['meshes'][0]['primitives'][0];pos=read_accessor(p['attributes']['POSITION']);tri=read_accessor(p['indices']).reshape(-1,3);xyz=pos[tri];normal=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-12);bottom=(normal[:,1]<-0.25)&(xyz[:,:,1].mean(axis=1)<-0.004)
assert bottom.sum()>10000 and (~bottom).sum()>10000
uv=np.column_stack(((pos[:,0]+.15)/.30,(pos[:,2]+.15)/.30)).astype('<f4');uv_index=accessor(uv,'VEC2',5126,34962)
base=Image.open(root/'views-2/view-3.png').convert('RGB');texture=base.crop((170,345,295,470)).resize((1024,1024),Image.Resampling.LANCZOS);bio=io.BytesIO();texture.save(bio,format='PNG');iv=append(bio.getvalue());ii=len(doc['images']);doc['images'].append({'bufferView':iv,'mimeType':'image/png'});ti=len(doc['textures']);doc['textures'].append({'source':ii});mat=len(doc['materials']);doc['materials'].append({'name':'Baked dough underside','pbrMetallicRoughness':{'baseColorTexture':{'index':ti},'metallicFactor':0,'roughnessFactor':1},'doubleSided':False})
top=copy.deepcopy(p);top['indices']=accessor(tri[~bottom].reshape(-1).astype('<u4'),'SCALAR',5125,34963)
bot=copy.deepcopy(p);bot['indices']=accessor(tri[bottom].reshape(-1).astype('<u4'),'SCALAR',5125,34963);bot['attributes']['TEXCOORD_0']=uv_index;bot['material']=mat
doc['meshes'][0]['primitives']=[top,bot];doc['buffers'][0]['byteLength']=len(binary)
while len(binary)%4:binary.append(0)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\x00')+binary
(root/'stage2-repaired.glb').write_bytes(out)
print('bottom faces:',int(bottom.sum()),'other faces:',int((~bottom).sum()),'bytes:',len(out))
