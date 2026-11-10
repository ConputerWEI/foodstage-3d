"""Deterministic local GLB primitives for drink and brownie showcases."""
import json, math, struct
from pathlib import Path
try:
    from .showcase_models import read_glb_json
except ImportError:
    from showcase_models import read_glb_json

def _box(cx,cy,cz,sx,sy,sz):
 v=[(cx+dx*sx,cy+dy*sy,cz+dz*sz) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7)];return _mesh(v,faces)
def _cylinder(cx,cy,cz,r,h,n=20):
 v=[]
 for y in (-h,h):
  for i in range(n): v.append((cx+r*math.cos(2*math.pi*i/n),cy+y,cz+r*math.sin(2*math.pi*i/n)))
 faces=[]
 for i in range(n): j=(i+1)%n;faces += [(i,j,n+j,n+i)]
 faces += [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))];return _mesh(v,faces)
def _mesh(v,faces):
 verts=[];norm=[];inds=[]
 for face in faces:
  a,b,c=v[face[0]],v[face[1]],v[face[2]]; ux=[b[i]-a[i] for i in range(3)];vx=[c[i]-a[i] for i in range(3)]; nn=[ux[1]*vx[2]-ux[2]*vx[1],ux[2]*vx[0]-ux[0]*vx[2],ux[0]*vx[1]-ux[1]*vx[0]]; ln=math.sqrt(sum(x*x for x in nn)) or 1;nn=[x/ln for x in nn]; base=len(verts)
  for i in face: verts.extend(v[i]);norm.extend(nn)
  for i in range(1,len(face)-1):inds.extend((base,base+i,base+i+1))
 return verts,norm,inds
def _build(path,parts):
 blob=bytearray();views=[];acc=[];meshes=[];nodes=[]
 def f(vals,typ,comps,target=34962):
  while len(blob)%4:blob.append(0)
  off=len(blob);raw=struct.pack('<'+'f'*len(vals),*vals);blob.extend(raw);views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':target});i=len(views)-1;acc.append({'bufferView':i,'componentType':5126,'count':len(vals)//comps,'type':typ,'min':[min(vals[j::comps]) for j in range(comps)],'max':[max(vals[j::comps]) for j in range(comps)]});return len(acc)-1
 def ind(vals):
  while len(blob)%4:blob.append(0)
  off=len(blob);raw=struct.pack('<'+'H'*len(vals),*vals);blob.extend(raw);views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':34963});acc.append({'bufferView':len(views)-1,'componentType':5123,'count':len(vals),'type':'SCALAR'});return len(acc)-1
 for name,geo,mat in parts:
  vs,ns,is_=geo;pa=f(vs,'VEC3',3);na=f(ns,'VEC3',3);ia=ind(is_);meshes.append({'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':mat}]});nodes.append({'name':name,'mesh':len(meshes)-1})
 mats=[{'name':'Glass','pbrMetallicRoughness':{'baseColorFactor':[.7,.9,1,.25],'metallicFactor':0,'roughnessFactor':.1},'alphaMode':'BLEND'},{'name':'Lemonade','pbrMetallicRoughness':{'baseColorFactor':[1,.72,.12,1],'roughnessFactor':.35}},{'name':'Ice','pbrMetallicRoughness':{'baseColorFactor':[.8,.95,1,.5],'roughnessFactor':.1},'alphaMode':'BLEND'},{'name':'BrownieCrust','pbrMetallicRoughness':{'baseColorFactor':[.18,.045,.02,1],'roughnessFactor':.7}},{'name':'CakeInterior','pbrMetallicRoughness':{'baseColorFactor':[.38,.14,.06,1],'roughnessFactor':.85}}]
 doc={'asset':{'version':'2.0','generator':'foodstage-showcase-local'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':mats,'accessors':acc,'bufferViews':views,'buffers':[{'byteLength':len(blob)}]};raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*(-len(raw)%4);out=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(blob))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(blob),0x004e4942)+blob;Path(path).parent.mkdir(parents=True,exist_ok=True);Path(path).write_bytes(out)
def build_drink_stage(path,stage):
 fill=[.85,.60,.35,.10][stage];parts=[('GlassCup',_cylinder(0,.06,0,.052,.06),0), (f'Lemonade_{int(fill*100)}pct',_cylinder(0,.06-.06*(1-fill),0,.045,.06*fill),1),('IceCubes',_box(-.012,.10,.012,.012,.008,.012),2),('LemonSlice',_box(.018,.12,.025,.018,.002,.018),2),('Mint',_box(0,.14,-.02,.008,.002,.008),2)];_build(path,parts)
def build_brownie_stage(path,stage):
 frac=[1,.75,.5,.25][stage]; width=.08*frac;parts=[('BrownieCrust',_box(0,.018,0,width,.018,.065),3),('CakeInterior',_box(0,0,0,width,.015,.060),4),('BakedBottom',_box(0,-.018,0,width,.003,.060),4)];_build(path,parts)
