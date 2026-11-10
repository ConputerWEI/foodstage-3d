#!/usr/bin/env python3
"""Add one mobile/desktop GLB pair and register its portable catalog metadata."""
import argparse
import json
import math
import re
import shutil
import sys
from pathlib import Path
from assets import load_catalog, read_glb, safe_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--food-id', required=True)
    parser.add_argument('--stage', type=int, required=True)
    parser.add_argument('--stage-count', type=int, help='Required total stages for this food; defaults to four for new foods')
    parser.add_argument('--runtime-prefix')
    parser.add_argument('--bites', type=int)
    parser.add_argument('--presentation', choices=['fixed-width', 'physical-size', 'physical-size-stable'])
    parser.add_argument('--scale', type=float)
    parser.add_argument('--position', type=float, nargs=3)
    parser.add_argument('--yaw', type=float)
    parser.add_argument('--mobile', required=True, type=Path)
    parser.add_argument('--desktop', required=True, type=Path)
    parser.add_argument('--assets-root', type=Path, default=Path(__file__).resolve().parents[1] / 'assets')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    try:
        for value in (args.food_id, args.runtime_prefix or args.food_id):
            if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value):
                raise ValueError('Food id and runtime prefix must be lowercase kebab-case')
        asset_root = args.assets_root.resolve()
        catalog_path = safe_path(asset_root, 'catalog.json')
        if catalog_path.exists():
            catalog = load_catalog(catalog_path=catalog_path)
        else:
            catalog = {'schemaVersion': 1, 'foods': []}
        food = next((f for f in catalog['foods'] if f['id'] == args.food_id), None)
        if food is None:
            count = args.stage_count if args.stage_count is not None else 4
            if count < 1:
                raise ValueError('Stage count must be positive')
            food = {'id': args.food_id, 'runtimePrefix': args.runtime_prefix or args.food_id, 'stageCount': count, 'stages': [{'bites': 5, 'calibration': {'scale': 1, 'position': [0, 0, 0], 'yaw': 0}} for _ in range(count)]}
            catalog['foods'].append(food)
        elif (args.stage_count is not None and args.stage_count != food['stageCount']) or (args.runtime_prefix is not None and args.runtime_prefix != food['runtimePrefix']):
            raise ValueError('Existing food stage count/runtime prefix differ; edit the catalog explicitly')
        if any(f['id'] != food['id'] and f['runtimePrefix'] == food['runtimePrefix'] for f in catalog['foods']):
            raise ValueError('Runtime prefix already used by another food')
        if not 0 <= args.stage < food['stageCount']:
            raise ValueError('Stage outside catalog stage count')
        stage = food['stages'][args.stage]
        if args.bites is not None:
            if args.bites < 1: raise ValueError('Bites must be positive')
            stage['bites'] = args.bites
        if args.presentation: stage['presentation'] = args.presentation
        for key in ('scale', 'position', 'yaw'):
            value = getattr(args, key)
            if value is not None:
                values = value if isinstance(value, list) else [value]
                if not all(math.isfinite(v) for v in values) or (key == 'scale' and value <= 0):
                    raise ValueError('Calibration values must be finite and scale positive')
                stage['calibration'][key] = value
        targets = {variant: safe_path(asset_root, f'{args.food_id}/processed/{variant}/{args.stage}.glb') for variant in ('mobile', 'desktop')}
        for source in (args.mobile, args.desktop): read_glb(source)
        existing = [str(path) for path in targets.values() if path.exists()]
        if existing and not args.force:
            raise FileExistsError('Asset already exists: ' + ', '.join(existing) + ' (use --force to replace)')
        if any(getattr(args, variant).resolve() == target for variant, target in targets.items()):
            raise ValueError('Input and output GLB paths must differ')
        for variant, target in targets.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(getattr(args, variant), target)
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print('Added GLB pair and registered catalog metadata. Add all declared stages, then run: python tools/assets.py inventory; python tools/assets.py sync; python tools/assets.py verify.')
    return 0

if __name__ == '__main__': raise SystemExit(main())
