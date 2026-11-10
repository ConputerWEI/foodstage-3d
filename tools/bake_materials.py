"""Bake the application's static material grade into canonical GLBs.
Run on fresh canonical copies only. Requires numpy and Pillow.
"""
import io,json,struct
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def bake(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);blob=bytearray(raw[28+n:]);blob=blob[:doc['buffers'][0]['byteLength']]
 if doc.get('scenes',[{}])[doc.get('scene',0)].get('extras',{}).get('foodMaterialsBaked'):return False
 linear=np.arange(256,dtype=float)/255;linear=np.where(linear<=.04045,linear/12.92,((linear+.055)/1.055)**2.4)
 val=(np.arange(4097)/4096)**1.13;encoded=np.floor(255*np.where(val<=.0031308,12.92*val,1.055*val**(1/2.4)-.055)+.5).astype('uint8')
 cache={}
 def texture(index,kind):
  key=(index,kind)
  if key in cache:return cache[key]
  tex=dict(doc['textures'][index]);imindex=tex.get('source',tex.get('extensions',{}).get('EXT_texture_webp',{}).get('source'))
  image=doc['images'][imindex];view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
  pixels=np.array(Image.open(io.BytesIO(blob[start:start+view['byteLength']])).convert('RGBA'))
  if kind=='color':
   rgb=linear[pixels[:,:,:3]];luminance=(rgb*np.array([.2126,.7152,.0722])).sum(2,keepdims=True);sat=np.clip(luminance+1.13*(rgb-luminance),0,1);pixels[:,:,:3]=encoded[np.floor(sat*4096+.5).astype(int)]
  else:pixels[:,:,1]=np.floor(.25*255+.75*pixels[:,:,1].astype(float)+.5).astype('uint8')
  stream=io.BytesIO();Image.fromarray(pixels).save(stream,format='PNG');data=stream.getvalue()
  while len(blob)%4:blob.append(0)
  vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
  ii=len(doc['images']);doc['images'].append({'bufferView':vi,'mimeType':'image/png'})
  tex.pop('extensions',None);tex['source']=ii;ti=len(doc['textures']);doc['textures'].append(tex);cache[key]=ti;return ti
 for material in doc.get('materials',[]):
  pbr=material.setdefault('pbrMetallicRoughness',{})
  if 'baseColorTexture' in pbr:pbr['baseColorTexture']['index']=texture(pbr['baseColorTexture']['index'],'color')
  if 'metallicRoughnessTexture' in pbr:pbr['metallicRoughnessTexture']['index']=texture(pbr['metallicRoughnessTexture']['index'],'roughness')
  else:pbr['roughnessFactor']=max(.32,pbr.get('roughnessFactor',1))
  pbr['metallicFactor']=0
 for scene in doc.get('scenes',[]):scene.setdefault('extras',{})['foodMaterialsBaked']=True
 # Drop unused images and compact buffer views, including meshopt compressed payloads.
 used_images=set()
 for tex in doc.get('textures',[]):
  if 'source' in tex:used_images.add(tex['source'])
  for ext in tex.get('extensions',{}).values():
   if 'source' in ext:used_images.add(ext['source'])
 # Original textures remain in the array, so remove those no material references.
 used_textures=set()
 def scan(value):
  if isinstance(value,dict):
   for key,item in value.items():
    if key.endswith('Texture') and isinstance(item,dict) and 'index' in item:used_textures.add(item['index'])
    scan(item)
  elif isinstance(value,list):
   for item in value:scan(item)
 scan(doc.get('materials',[]));texture_map={old:new for new,old in enumerate(sorted(used_textures))}
 def remap(value):
  if isinstance(value,dict):
   for key,item in value.items():
    if key.endswith('Texture') and isinstance(item,dict) and 'index' in item:item['index']=texture_map[item['index']]
    remap(item)
  elif isinstance(value,list):
   for item in value:remap(item)
 remap(doc.get('materials',[]));doc['textures']=[doc['textures'][i] for i in sorted(used_textures)]
 used_images=set()
 for tex in doc['textures']:
  if 'source' in tex:used_images.add(tex['source'])
  for ext in tex.get('extensions',{}).values():
   if 'source' in ext:used_images.add(ext['source'])
 old_image_views={im['bufferView'] for im in doc['images'] if 'bufferView' in im};image_map={old:new for new,old in enumerate(sorted(used_images))};doc['images']=[doc['images'][i] for i in sorted(used_images)]
 for tex in doc['textures']:
  if 'source' in tex:tex['source']=image_map[tex['source']]
  for ext in tex.get('extensions',{}).values():
   if 'source' in ext:ext['source']=image_map[ext['source']]
 retained_images={im['bufferView'] for im in doc['images'] if 'bufferView' in im};keep=[i for i in range(len(doc['bufferViews'])) if i not in old_image_views or i in retained_images];view_map={old:new for new,old in enumerate(keep)};packed=bytearray()
 for i in keep:
  view=doc['bufferViews'][i];start=view.get('byteOffset',0)
  if view.get('buffer',0)==0:
   data=blob[start:start+view['byteLength']]
   while len(packed)%4:packed.append(0)
   view['byteOffset']=len(packed);packed.extend(data)
  ext=view.get('extensions',{}).get('EXT_meshopt_compression')
  if ext:
   data=blob[ext.get('byteOffset',0):ext.get('byteOffset',0)+ext['byteLength']]
   while len(packed)%4:packed.append(0)
   ext['byteOffset']=len(packed);packed.extend(data)
 for a in doc.get('accessors',[]):
  if 'bufferView' in a:a['bufferView']=view_map[a['bufferView']]
 for im in doc['images']:
  if 'bufferView' in im:im['bufferView']=view_map[im['bufferView']]
 doc['bufferViews']=[doc['bufferViews'][i] for i in keep];blob=packed
 doc['buffers'][0]['byteLength']=len(blob)
 while len(blob)%4:blob.append(0)
 payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(payload)+len(blob))+struct.pack('<I4s',len(payload),b'JSON')+payload+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
 return True

if __name__=='__main__':
 for path in sorted((ROOT/'assets').glob('*/processed/*/*.glb')):print(path.relative_to(ROOT),bake(path))
