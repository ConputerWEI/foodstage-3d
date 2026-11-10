"""Small deterministic GLB builder for showcase food primitives."""
import json, math, struct
from pathlib import Path


def _pad(data):
    return data + b'\0' * ((4-len(data)%4)%4)


def _chicken_mesh(cx, cy, cz, sx, sy, sz):
    verts=[]; norms=[]; inds=[]; rings=6; segs=12
    for r in range(rings+1):
        v=r/rings; phi=math.pi*v
        for s in range(segs):
            u=2*math.pi*s/segs
            # mildly irregular coating silhouette, still closed and stable
            wobble=1 + .045*math.sin(3*u+1.7*r)
            x=math.sin(phi)*math.cos(u)*sx*wobble
            y=math.cos(phi)*sy
            z=math.sin(phi)*math.sin(u)*sz*wobble
            verts.extend((cx+x,cy+y,cz+z))
            nx=math.sin(phi)*math.cos(u); ny=math.cos(phi); nz=math.sin(phi)*math.sin(u)
            n=math.sqrt(nx*nx+ny*ny+nz*nz) or 1
            norms.extend((nx/n,ny/n,nz/n))
    for r in range(rings):
        for s in range(segs):
            a=r*segs+s; b=r*segs+(s+1)%segs; c=(r+1)*segs+(s+1)%segs; d=(r+1)*segs+s
            inds.extend((a,b,d,b,c,d))
    return verts,norms,inds


def build_chicken_stage(path, count):
    positions=[(-.070,.020,.055), (0,.025,.060), (.070,.020,.050), (-.045,.030,-.035), (.035,.035,-.030), (0,.045,.115)]
    blob=bytearray(); views=[]; accessors=[]; meshes=[]; nodes=[]
    def append_floats(values, typ, comps, target=34962):
        off=len(blob); raw=struct.pack('<'+'f'*len(values),*values); blob.extend(raw); views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':target}); idx=len(views)-1; accessors.append({'bufferView':idx,'componentType':5126,'count':len(values)//comps,'type':typ,'min':[min(values[i::comps]) for i in range(comps)],'max':[max(values[i::comps]) for i in range(comps)]}); return len(accessors)-1
    def append_indices(values):
        while len(blob)%4: blob.append(0)
        off=len(blob); raw=struct.pack('<'+'H'*len(values),*values); blob.extend(raw); views.append({'buffer':0,'byteOffset':off,'byteLength':len(raw),'target':34963}); accessors.append({'bufferView':len(views)-1,'componentType':5123,'count':len(values),'type':'SCALAR'}); return len(accessors)-1
    for i in range(count):
        p=positions[i]; vs,ns,is_= _chicken_mesh(*p,.040,.028,.030); pa=append_floats(vs,'VEC3',3); na=append_floats(ns,'VEC3',3); ia=append_indices(is_)
        meshes.append({'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':0}]}); nodes.append({'name':f'ChickenPiece_{i+1}','mesh':i})
    doc={'asset':{'version':'2.0','generator':'foodstage-showcase-local'},'scene':0,'scenes':[{'nodes':list(range(count))}],'nodes':nodes,'meshes':meshes,'materials':[{'name':'CrispyGoldenCoating','pbrMetallicRoughness':{'baseColorFactor':[0.72,0.30,0.07,1],'metallicFactor':0,'roughnessFactor':0.72}}],'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(blob)}]}
    raw=json.dumps(doc,separators=(',',':')).encode(); raw=_pad(raw); body=struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(blob))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(blob),0x004e4942)+blob
    path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(body)


def read_glb_json(path):
    data=Path(path).read_bytes(); length=struct.unpack_from('<I',data,8)[0]; pos=12; chunk_len,chunk_type=struct.unpack_from('<II',data,pos); assert chunk_type==0x4e4f534a; return json.loads(data[pos+8:pos+8+chunk_len].rstrip(b'\0'))
