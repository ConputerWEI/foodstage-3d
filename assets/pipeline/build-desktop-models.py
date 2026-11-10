#!/usr/bin/env python3
"""Build desktop GLBs from compressed meshes and the source 2K color atlases.

Requires Pillow. Geometry, UVs, and roughness stay identical to mobile; only
the base color image changes. Outputs do not overwrite either input variant.
"""
import io
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public'


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError(f'Invalid GLB: {path}')
    json_length, kind = struct.unpack_from('<I4s', raw, 12)
    if kind != b'JSON':
        raise ValueError(f'Expected JSON chunk in {path}')
    data = json.loads(raw[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length, kind = struct.unpack_from('<I4s', raw, binary_offset)
    if kind != b'BIN\x00':
        raise ValueError(f'Expected binary chunk in {path}')
    binary = raw[binary_offset + 8:binary_offset + 8 + binary_length]
    return data, binary


def image_bytes(data, binary, image_index):
    view = data['bufferViews'][data['images'][image_index]['bufferView']]
    offset = view.get('byteOffset', 0)
    return binary[offset:offset + view['byteLength']]


def build(stage, food='burger'):
    source, source_bin = read_glb(ROOT / 'models' / f'{food}-{stage}.glb')
    desktop, binary = read_glb(ROOT / 'models-mobile' / f'{food}-{stage}.glb')
    with Image.open(io.BytesIO(image_bytes(source, source_bin, 0))) as image:
        if image.size != (2048, 2048):
            raise ValueError(f'Expected 2K source image for stage {stage}, got {image.size}')
        encoded = io.BytesIO()
        image.save(encoded, format='WEBP', quality=95, method=6)
        color = encoded.getvalue()
    # Append the new image instead of shifting meshopt offsets in the existing BIN.
    offset = len(binary)
    padded_binary = binary + color + b'\x00' * (-len(color) % 4)
    desktop['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(color)})
    desktop['images'][0]['bufferView'] = len(desktop['bufferViews']) - 1
    desktop['buffers'][0]['byteLength'] = len(padded_binary)
    encoded_json = json.dumps(desktop, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded_json += b' ' * (-len(encoded_json) % 4)
    output = ROOT / 'models-desktop' / f'{food}-{stage}.glb'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(
        struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(encoded_json) + 8 + len(padded_binary))
        + struct.pack('<I4s', len(encoded_json), b'JSON') + encoded_json
        + struct.pack('<I4s', len(padded_binary), b'BIN\x00') + padded_binary
    )
    print(f'{output.name}: 2048px color, {len(color) / 1048576:.2f} MiB color, {output.stat().st_size / 1048576:.2f} MiB GLB')


if __name__ == '__main__':
    for index in range(4):
        build(index)
