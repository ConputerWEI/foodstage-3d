from pathlib import Path
from showcase_models import build_chicken_stage

ROOT=Path(__file__).resolve().parents[1]
for stage,count in enumerate((6,4,2,1)):
    source=ROOT/'assets'/'crispy-chicken'/'source'/f'{stage}.glb'
    build_chicken_stage(source,count)
    for variant in ('mobile','desktop'):
        target=ROOT/'assets'/'crispy-chicken'/'processed'/variant/f'{stage}.glb'
        build_chicken_stage(target,count)
print('Generated four deterministic crispy-chicken GLB stages.')
