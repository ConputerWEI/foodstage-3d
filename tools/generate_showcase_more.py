from pathlib import Path
from showcase_more_models import build_drink_stage, build_brownie_stage
ROOT=Path(__file__).resolve().parents[1]
for food, builder in [('lemon-soda', build_drink_stage), ('chocolate-brownie', build_brownie_stage)]:
 for stage in range(4):
  for variant in ('source','mobile','desktop'):
   p=ROOT/'assets'/food/('source' if variant=='source' else f'processed/{variant}')/f'{stage}.glb'; builder(p,stage)
print('Generated four drink and four brownie GLB stages.')
