import io,json,struct,tempfile,unittest
from pathlib import Path
from PIL import Image
from bake_materials import bake
from assets import read_glb

class BakeTests(unittest.TestCase):
 def test_material_grade_and_idempotence(self):
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp)/'test.glb';stream=io.BytesIO();Image.new('RGBA',(1,1),(180,100,30,255)).save(stream,format='PNG');blob=stream.getvalue();doc={'asset':{'version':'2.0'},'buffers':[{'byteLength':len(blob)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(blob)}],'images':[{'bufferView':0,'mimeType':'image/png'}],'textures':[{'source':0}],'materials':[{'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':1,'roughnessFactor':.1}}],'scenes':[{}]};j=json.dumps(doc).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4);p.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
   self.assertTrue(bake(p));d,b=read_glb(p);self.assertEqual(d['materials'][0]['pbrMetallicRoughness']['metallicFactor'],0);self.assertEqual(d['materials'][0]['pbrMetallicRoughness']['roughnessFactor'],.32);self.assertTrue(d['scenes'][0]['extras']['foodMaterialsBaked']);saved=p.read_bytes();self.assertFalse(bake(p));self.assertEqual(p.read_bytes(),saved)

if __name__=='__main__':unittest.main()
