# Three Food Reference-Driven Asset Production Plan

**Goal:** Replace procedural placeholders with reference-driven chicken, lemonade and brownie assets, each with four consistent stages.
**Architecture:** Keep existing loaders, catalog IDs and interaction flow. Generate references with image / gpt-image-2.5; reconstruct suitable solid subjects with Lux3D CN OpenAPI, then derive deterministic candidates outside canonical assets. Transparent glass and liquid require named, physically plausible parametric refinement rather than opaque baked reconstruction.
**Tech Stack:** Python GLB tooling, Three.js, Playwright, glTF Transform, Lux3D.
**Spec:** docs/food-showcase-production.md

## Constraints
- Sequence: chicken, lemonade, brownie. Preserve burger, pizza and fries.
- Chicken 6/4/2/1; soda fill .85/.60/.35/.10; brownie remaining 1/.75/.50/.25.
- Shared scale, survivor geometry, textures and stable placement across stages. Closed cut faces and undersides.
- Current conversation budget 2000 credits, 20 committed to task 4954280; existing prior task 4950606 excluded.
- Record actual quotes and task IDs; never replay uncertain submissions. No secrets in delivery.
- Only publish after visual inspection and automated checks.

## 1. Chicken
- [x] Generate and inspect single-bite reference, save assets/crispy-chicken/reference/single-bite.png.
- [x] Upload, quote and submit task 4954280 with persistent attempt and budget records.
- [ ] Resume task on original account; download ZIP and GLB without repeating create.
- [ ] Inspect rendered top/side/underside. Reject floating sheets or wrong subject based on renders, not node or index-component counts alone.
- [ ] Test stage builder against 6/4/2/1 node counts, identical BIN data, preserved material/texture references and identical survivor transforms.
- [ ] Optimize single master with meshopt/WebP; use existing loader-supported extensions only. Build node-instance candidates in artifacts/chicken-image3d/candidates, with approximately 40mm bites and approximately 160mm serving.
- [ ] Measure transformed world bounds and inspect four stages at fixed physical scale. Account for runtime stage-centering movement.

## 2. Lemonade
- [ ] Generate product reference of short clear glass, pale lemonade, ice and lemon slices.
- [ ] Inspect reference; use image-driven solid garnish reconstruction where useful, avoiding opaque glass image baking.
- [ ] Test closed glass wall, liquid surface, named Glass/Liquid/Ice/Lemon nodes and invariant cup geometry.
- [ ] Create reference-guided PBR glass and liquid with four measured fills; retain textures and input provenance. Inspect light/dark backgrounds, bottom and rotations.

## 3. Brownie
- [ ] Generate reference of rectangular brownie with cracked top and moist side interior.
- [ ] Upload/quote/submit image-to-3D under remaining allowance, preserving input and task ID.
- [ ] Inspect full model; test deterministic slicing with closed new cut surfaces and independent interior material.
- [ ] Derive 1/.75/.50/.25 volume candidates without per-stage scale changes; inspect top, sides and underside.

## 4. Integration and Verification
- [ ] Hash unrelated canonical assets before publication; preserve their bytes.
- [ ] Publish accepted source/mobile/desktop candidates only; update asset provenance and covers, catalog calibration only if justified.
- [ ] Run python tools/assets.py inventory, sync, verify; inspect changes to unrelated foods.
- [ ] Run Python tool tests, npm test, npm run typecheck, npm run build, and relevant Playwright tests.
- [ ] Add visual coverage for all four stages, mobile/desktop, rotation, menu preview, finish/replay; record actual screenshots and observations.
- [ ] Submit task-scoped Lux3D REPORT with actual evidence, preserve receipt; provide honest partial results if any acceptance gate fails.
