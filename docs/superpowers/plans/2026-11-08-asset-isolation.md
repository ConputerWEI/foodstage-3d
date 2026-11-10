# Real GLB Asset Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a clean, portable asset repository for the exact GLB models shown by the project, with provenance, hashes, dimensions, calibration, and a repeatable sync/verification command.

**Architecture:** Keep runtime compatibility by continuing to serve `public/models*`, but make `assets/` the canonical offline asset store. A Python inventory/sync tool copies canonical GLBs into mobile/desktop runtime variants and emits a manifest; source and processing records document whether each model is Lux3D-original or locally processed. Existing `src/data/foods.ts` remains the runtime behavior source and only receives the confirmed pizza stage-4 scale change.

**Tech Stack:** TypeScript, Vitest, Python 3 standard library, GLB 2.0 JSON/BIN parsing, SHA-256.

**Spec:** User-approved asset isolation request in the current conversation.

## Global Constraints

- Do not change the visible food interaction, stage order, bite counts, or unrelated assets.
- Canonical assets must be copyable independently from the application source.
- Every runtime GLB must have a SHA-256 record and a source/processing classification.
- Mobile and desktop variants must be identified separately; geometry and texture differences must be explicit.
- Never claim exact geometry properties without a measured report.

---

### Task 1: Define canonical asset layout and metadata

**Files:**
- Create: `assets/README.md`
- Create: `assets/manifest.json`
- Create: `assets/catalog.json`
- Create: `assets/pipeline/README.md`

**Interfaces:**
- Produces a stable manifest schema consumed by the inventory tool and humans adding new GLBs.

- [ ] **Step 1: Write the metadata contract first**

Use JSON fields `schemaVersion`, `generatedAt`, `runtimeRoots`, `foods`, and `files`. Each file entry contains `foodId`, `stage`, `variant`, `path`, `sha256`, `bytes`, `sourceKind`, `processing`, `dimensionsMm`, and `notes`. `sourceKind` is one of `lux3d-original`, `locally-processed`, or `existing-project-asset`.

- [ ] **Step 2: Add the asset instructions**

Document the add-new-model workflow: place a canonical GLB under `assets/<foodId>/processed/<variant>/`, add a file entry, run `python tools/assets.py verify`, then run `python tools/assets.py sync` to update `public/models*`. Explain that `public/` is generated runtime output and `assets/` is the portable source.

- [ ] **Step 3: Record the current model facts**

Record all 36 food GLBs currently served, their hashes, byte sizes, dimensions, and processing classification. Record pizza stages 2/3 as locally processed; classify existing burger/fries and pizza stages 1/4 as existing project assets unless their provenance logs prove Lux3D origin.

- [ ] **Step 4: Review the schema**

Confirm every `foods.ts` URL has one corresponding mobile and desktop entry and no runtime file is missing.

### Task 2: Build the asset inventory and sync tool

**Files:**
- Create: `tools/assets.py`
- Create: `tools/test_assets.py`
- Modify: `package.json`

**Interfaces:**
- `python tools/assets.py inventory` writes `assets/manifest.json` from canonical files.
- `python tools/assets.py verify` validates paths, hashes, GLB structure, and dimensions.
- `python tools/assets.py sync` copies canonical mobile/desktop files to `public/models-mobile` and `public/models-desktop` and writes `assets/reports/last-sync.json`.

- [ ] **Step 1: Write failing tests**

Test GLB header parsing, SHA-256 calculation, missing variant detection, and that sync output matches canonical hashes.

- [ ] **Step 2: Run `python tools/test_assets.py` and verify the expected failure**

Expected: import or command failures because `tools/assets.py` does not yet exist.

- [ ] **Step 3: Implement minimal standard-library GLB parsing**

Validate magic `glTF`, version `2`, declared length, JSON and BIN chunks, accessor bounds, and compute `POSITION` bounds from accessors. Do not decode image pixels in this tool.

- [ ] **Step 4: Implement inventory, verify, and sync commands**

Use explicit `--repo` and `--assets` arguments defaulting to the repository root and `assets`. Refuse sync when a canonical variant is missing or a manifest hash does not match the file.

- [ ] **Step 5: Run tests and verify they pass**

Run `python tools/test_assets.py` and `python tools/assets.py verify`.

### Task 3: Populate canonical assets without changing runtime behavior

**Files:**
- Create: `assets/<foodId>/processed/mobile/*.glb`
- Create: `assets/<foodId>/processed/desktop/*.glb`
- Create: `assets/reports/last-sync.json`
- Modify: `assets/manifest.json`

**Interfaces:**
- Canonical files are byte-identical to the currently served runtime files before sync.

- [ ] **Step 1: Copy all 36 runtime GLBs into the canonical layout**

Use the current `public/models-mobile` and `public/models-desktop` files as the canonical inputs; preserve bytes exactly.

- [ ] **Step 2: Classify processing**

Set pizza stage indices 1 and 2 to `locally-processed`; set other files to `existing-project-asset`, with notes linking to existing scripts/logs where available.

- [ ] **Step 3: Inventory and verify**

Run inventory then verify; require all 36 entries and equal mobile/desktop file counts.

- [ ] **Step 4: Sync and compare**

Run sync and compare every generated runtime hash against the canonical hash.

### Task 4: Make adding a new model straightforward

**Files:**
- Modify: `assets/README.md`
- Create: `tools/new_asset.py`
- Create: `tools/test_new_asset.py`

**Interfaces:**
- `python tools/new_asset.py --food-id <id> --stage <0-3> --mobile <file> --desktop <file>` copies files into canonical paths, rejects non-GLB input, and refuses overwriting unless `--force` is passed.

- [ ] **Step 1: Write failing tests**

Test naming, missing desktop input, invalid GLB rejection, and no-overwrite behavior.

- [ ] **Step 2: Implement the command**

Validate both inputs with the GLB parser, copy them, and print the exact next commands: `inventory`, `verify`, `sync`.

- [ ] **Step 3: Run the tool tests**

Run `python tools/test_new_asset.py`.

### Task 5: Regression verification and handoff

**Files:**
- Modify: `src/data/foods.test.ts` only if the stage-4 scale assertion needs its confirmed value.
- Create: `assets/reports/verification.json`

- [ ] **Step 1: Run asset verification**

`python tools/assets.py verify`

- [ ] **Step 2: Run TypeScript tests**

`npx vitest run src/data/foods.test.ts tests/pizza-scale.test.ts`

- [ ] **Step 3: Run browser interaction tests**

`npx playwright test tests/pizza.spec.ts --reporter=line`

- [ ] **Step 4: Verify the existing dev server**

Request `http://127.0.0.1:5173/?table=A01`, confirm HTTP 200 and that all runtime GLB URLs resolve.

- [ ] **Step 5: Document limitations**

State that GLB contains the food asset, materials, and embedded images, while the app contributes lighting, camera, plate/background, scaling calibration, and bite animation. State that desktop/mobile files may differ in texture resolution/compression while sharing the same intended geometry.
