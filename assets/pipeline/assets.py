#!/usr/bin/env python3
"""Inventory, verify, and sync portable GLB food assets."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import re
import shutil
import struct
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VARIANTS = ('mobile', 'desktop')


def safe_path(root: Path, relative: str) -> Path:
    candidate = Path(relative)
    root = root.resolve()
    resolved = (root / candidate).resolve()
    if candidate.is_absolute() or '..' in candidate.parts or not resolved.is_relative_to(root):
        raise ValueError(f'Unsafe asset path: {relative}')
    return resolved


def load_catalog(repo: Path = ROOT, *, catalog_path: Path | None = None) -> dict:
    catalog = json.loads((catalog_path or repo / 'assets/catalog.json').read_text(encoding='utf-8'))
    if catalog.get('schemaVersion') != 1 or not isinstance(catalog.get('foods'), list):
        raise ValueError('Invalid asset catalog schema')
    ids, prefixes = set(), set()
    for food in catalog['foods']:
        for key, seen in [('id', ids), ('runtimePrefix', prefixes)]:
            value = food.get(key)
            if not isinstance(value, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value) or value in seen:
                raise ValueError(f'Invalid or duplicate catalog {key}: {value}')
            seen.add(value)
        count = food.get('stageCount')
        if type(count) is not int or count < 1 or len(food.get('stages', [])) != count:
            raise ValueError(f'Invalid stage count for {food["id"]}')
        for stage in food['stages']:
            calibration = stage.get('calibration', {})
            position = calibration.get('position', [])
            values = [calibration.get('scale'), calibration.get('yaw'), *position]
            if len(position) != 3 or any(type(v) not in (int, float) or not math.isfinite(v) for v in values) or calibration['scale'] <= 0:
                raise ValueError('Invalid stage calibration')
            if type(stage.get('bites')) is not int or stage['bites'] < 1:
                raise ValueError('Invalid stage bites')
            if stage.get('presentation') not in (None, 'fixed-width', 'physical-size'):
                raise ValueError('Invalid stage presentation')
    return catalog


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def read_glb(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError(f'Invalid GLB (truncated): {path}')
    magic, version, length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError(f'Invalid GLB header/length: {path}')
    json_len, kind = struct.unpack_from('<I4s', raw, 12)
    if kind != b'JSON' or 20 + json_len + 8 > len(raw):
        raise ValueError(f'Invalid GLB JSON chunk: {path}')
    doc = json.loads(raw[20:20 + json_len].decode('utf-8').rstrip(' \t\r\n\0'))
    bin_len, bin_kind = struct.unpack_from('<I4s', raw, 20 + json_len)
    if bin_kind != b'BIN\0' or 28 + json_len + bin_len > len(raw):
        raise ValueError(f'Invalid GLB BIN chunk: {path}')
    if any(item.get('uri') for item in doc.get('buffers', [])) or any(item.get('uri') and not item['uri'].startswith('data:') for item in doc.get('images', [])):
        raise ValueError(f'GLB requires external resources: {path}')
    return doc, raw[28 + json_len:28 + json_len + bin_len]


def dimensions_mm(path: Path) -> list[float]:
    """Union of mesh-local accessor bounds; not transformed scene dimensions."""
    doc, _ = read_glb(path)
    mins, maxs = [], []
    for mesh in doc.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            accessor_id = primitive.get('attributes', {}).get('POSITION')
            if accessor_id is None:
                continue
            accessor = doc['accessors'][accessor_id]
            if 'min' not in accessor or 'max' not in accessor or len(accessor['min']) < 3:
                raise ValueError(f'POSITION bounds missing in {path}')
            mins.append(accessor['min'][:3]); maxs.append(accessor['max'][:3])
    if not mins:
        raise ValueError(f'No mesh POSITION accessors in {path}')
    return [round((max(v[i] for v in maxs) - min(v[i] for v in mins)) * 1000, 4) for i in range(3)]


def runtime_name(food: dict, stage: int) -> str:
    return f"{food['runtimePrefix']}-{stage}.glb"


def inventory(repo: Path = ROOT) -> dict:
    repo = repo.resolve()
    catalog = load_catalog(repo)
    records = []
    for food in catalog['foods']:
        for stage in range(food['stageCount']):
            variants = {}
            for variant in VARIANTS:
                relative = f"assets/{food['id']}/processed/{variant}/{stage}.glb"
                path = safe_path(repo, relative)
                doc, _ = read_glb(path)
                variants[variant] = {'path': relative, 'sha256': sha256(path), 'bytes': path.stat().st_size, 'dimensionsMm': dimensions_mm(path), 'meshCount': len(doc.get('meshes', [])), 'materialCount': len(doc.get('materials', [])), 'imageCount': len(doc.get('images', []))}
            source_path = safe_path(repo, f"assets/{food['id']}/source/{stage}.glb")
            source = {'path': source_path.relative_to(repo).as_posix(), 'sha256': sha256(source_path), 'bytes': source_path.stat().st_size} if source_path.exists() else None
            records.append({'foodId': food['id'], 'stage': stage, 'sourceKind': 'existing-project-asset', 'processing': ['Portable GLB; see asset-specific provenance'], 'notes': 'Dimensions are union of mesh-local POSITION bounds; node transforms and scene reachability are not applied.', 'source': source, 'variants': variants, **food['stages'][stage]})
    manifest = {'schemaVersion': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(), 'runtimeRoots': {'mobile': 'public/models-mobile', 'desktop': 'public/models-desktop', 'buildSourceReference': 'public/models (legacy source references; not loaded by current scene)'}, 'foods': catalog['foods'], 'files': records}
    # Preserve provenance already recorded by a processing pipeline.
    old_path = repo / 'assets/manifest.json'
    if old_path.exists():
        old = {(r['foodId'], r['stage']): r for r in json.loads(old_path.read_text(encoding='utf-8'))['files']}
        for record in records:
            previous = old.get((record['foodId'], record['stage']), {})
            for key in ('sourceKind', 'processing', 'notes'):
                if key in previous:
                    record[key] = previous[key]
    old_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return manifest


def load_manifest(repo: Path = ROOT) -> dict:
    return json.loads((repo / 'assets/manifest.json').read_text(encoding='utf-8'))


def verify(manifest: dict | None = None, repo: Path = ROOT, check_runtime: bool = True) -> None:
    repo = repo.resolve()
    manifest = manifest or load_manifest(repo)
    foods = {food['id']: food for food in load_catalog(repo)['foods']}
    expected = {(f['id'], s, v) for f in foods.values() for s in range(f['stageCount']) for v in VARIANTS}
    actual = set()
    for record in manifest['files']:
        if record['foodId'] not in foods or type(record['stage']) is not int:
            raise ValueError('Unknown manifest food or invalid stage')
        source = record.get('source')
        if source:
            path = safe_path(repo, source['path'])
            if not path.is_file() or sha256(path) != source['sha256'] or path.stat().st_size != source['bytes']:
                raise ValueError(f'Source hash/size mismatch: {path}')
        for variant, item in record['variants'].items():
            key = (record['foodId'], record['stage'], variant)
            if key in actual or key not in expected:
                raise ValueError(f'Duplicate or unexpected manifest entry: {key}')
            actual.add(key)
            path = safe_path(repo, item['path'])
            canonical = safe_path(repo, f"assets/{record['foodId']}/processed/{variant}/{record['stage']}.glb")
            if path != canonical:
                raise ValueError(f'Unsafe noncanonical asset path: {path}')
            if not path.is_file(): raise ValueError(f'Missing canonical asset: {path}')
            if sha256(path) != item['sha256']: raise ValueError(f'Hash mismatch: {path}')
            if path.stat().st_size != item['bytes']: raise ValueError(f'Size mismatch: {path}')
            if dimensions_mm(path) != item['dimensionsMm']: raise ValueError(f'Dimension mismatch: {path}')
            runtime = safe_path(repo, f"public/models-{variant}/{runtime_name(foods[record['foodId']], record['stage'])}")
            if check_runtime:
                if not runtime.is_file(): raise ValueError(f'Missing runtime asset: {runtime}')
                if sha256(runtime) != item['sha256']: raise ValueError(f'Runtime hash mismatch: {runtime}')
    if actual != expected:
        raise ValueError(f'Variant coverage mismatch: missing={expected-actual}, extra={actual-expected}')
    print(f'Verified {len(actual)} canonical GLBs' + (' and matching runtime files.' if check_runtime else '.'))


def sync(manifest: dict | None = None, repo: Path = ROOT) -> None:
    repo = repo.resolve()
    manifest = manifest or load_manifest(repo)
    verify(manifest, repo, check_runtime=False)
    foods = {food['id']: food for food in load_catalog(repo)['foods']}
    results = []
    for record in manifest['files']:
        for variant, item in record['variants'].items():
            source = safe_path(repo, item['path'])
            target = safe_path(repo, f"public/models-{variant}/{runtime_name(foods[record['foodId']], record['stage'])}")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            if sha256(target) != item['sha256']: raise ValueError(f'Sync verification failed: {target}')
            results.append({'path': target.relative_to(repo).as_posix(), 'sha256': item['sha256'], 'bytes': target.stat().st_size})
    report = {'syncedAt': datetime.now(timezone.utc).isoformat(), 'files': results}
    out = safe_path(repo, 'assets/reports/last-sync.json')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(f'Synced {len(results)} GLBs.')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['inventory', 'verify', 'sync'])
    parser.add_argument('--repo', type=Path, default=ROOT)
    parser.add_argument('--canonical-only', action='store_true', help='Skip runtime equality checks during verify')
    args = parser.parse_args()
    if args.command == 'inventory':
        manifest = inventory(args.repo)
        print(f"Inventoried {len(manifest['files']) * len(VARIANTS)} GLBs.")
    elif args.command == 'verify': verify(repo=args.repo, check_runtime=not args.canonical_only)
    else: sync(repo=args.repo)

if __name__ == '__main__': main()
