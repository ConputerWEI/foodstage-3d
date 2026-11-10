# Asset Pipeline

Processing scripts must be deterministic and must write candidates outside the canonical files until visual and automated verification passes. Record source hash, processing parameters, output hash, byte size, bounds and validation results in `assets/reports/`.

Current references:

- `scripts/optimize-models.mjs`: mobile meshopt/WebP optimization.
- `scripts/build-desktop-models.py`: desktop texture variant generation.
- `scripts/fries-v4-geometry.mjs`: fries geometry candidate pipeline.
- `artifacts/pizza-back-front-fix-20261107/`: pizza stages 2/3 repair, clipping, flat-base candidates and review renders.
