#!/usr/bin/env node
/**
 * Reproducible mobile GLB optimization pipeline.
 *
 * Usage:
 *   node scripts/optimize-models.mjs --sample
 *   node scripts/optimize-models.mjs
 *
 * The source files in public/models are never overwritten. The pipeline uses
 * the pinned glTF-Transform CLI and writes only to public/models-mobile.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceDir = resolve(root, 'public/models');
const outputDir = resolve(root, 'public/models-mobile');
const cliVersion = '4.5.1';
const stageIndexes = [0, 1, 2, 3];

export function parseArgs(args) {
  let food = 'burger';
  let sampleOnly = false;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--food') {
      food = args[++index];
      if (!food) throw new Error('--food requires an id');
    } else if (argument === '--sample') {
      sampleOnly = true;
    } else if (argument === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(food)) {
    throw new Error(`Invalid food id; expected a safe id, got: ${food}`);
  }
  return { food, sampleOnly, dryRun };
}

export function getModelPaths(food, indexes = stageIndexes) {
  return indexes.map((stage) => ({
    stage,
    input: resolve(sourceDir, `${food}-${stage}.glb`),
    output: resolve(outputDir, `${food}-${stage}.glb`),
  }));
}

const optimizeFlags = [
  '--compress', 'meshopt', '--meshopt-level', 'high',
  '--simplify', 'true', '--simplify-ratio', '0.35', '--simplify-error', '0.0001',
  '--texture-size', '1024', '--texture-compress', 'webp',
  '--flatten', 'false', '--instance', 'false', '--join', 'false',
  '--palette', 'false', '--prune', 'true', '--weld', 'true',
];

export function run({ food, sampleOnly, dryRun }) {
  const paths = getModelPaths(food, sampleOnly ? [0] : stageIndexes);
  if (!dryRun) {
    for (const { input } of getModelPaths(food)) {
      if (!existsSync(input)) throw new Error(`Missing source model: ${input}`);
    }
    mkdirSync(outputDir, { recursive: true });
  }
  for (const { stage, input, output } of paths) {
    const command = [
      'exec', '--yes', `--package=@gltf-transform/cli@${cliVersion}`, '--',
      'gltf-transform', 'optimize', input, output, ...optimizeFlags,
    ];
    if (dryRun) {
      console.log(`${food}-${stage}: ${input} -> ${output}`);
      console.log(`npm ${command.join(' ')}`);
      continue;
    }
    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      command,
      { cwd: root, stdio: 'inherit', shell: false },
    );
    if (result.status !== 0) throw new Error(`Optimization failed for ${food}-${stage} (exit ${result.status})`);
    console.log(`${food}-${stage}: ${(statSync(input).size / 1048576).toFixed(2)} MiB → ${(statSync(output).size / 1048576).toFixed(2)} MiB`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
