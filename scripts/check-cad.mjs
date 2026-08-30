#!/usr/bin/env node

import Ajv2020 from 'ajv/dist/2020.js';
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const hardwareRoot = join(repositoryRoot, 'hardware');
const registryPath = join(hardwareRoot, 'models.json');
const schemaPath = join(hardwareRoot, 'models.schema.json');
const bomPartsPath = join(repositoryRoot, 'bom', 'catalog', 'parts.json');

const allowedStatuses = new Set([
    'concept-unvalidated',
    'prototype',
    'validated',
    'released',
    'deprecated',
]);
const allowedArtifactRoles = new Set(['fabrication', 'reference']);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const revisionPattern = /^\d+\.\d+\.\d+$/;
const includePattern = /^\s*(?:include|use)\s*<([^>]+)>/gm;

function fail(message) {
    throw new Error(message);
}

function assert(condition, message) {
    if (!condition) {
        fail(message);
    }
}

function readJson(path, label) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        fail(`${label} is not valid JSON: ${error.message}`);
    }
}

function isWithin(parent, candidate) {
    const pathFromParent = relative(parent, candidate);
    return (
        pathFromParent === '' ||
        (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== '..' && !isAbsolute(pathFromParent))
    );
}

function resolveRepositoryPath(path, label) {
    assert(typeof path === 'string' && path.length > 0, `${label} must be a non-empty path.`);
    assert(!isAbsolute(path), `${label} must be repository-relative: ${path}`);

    const absolutePath = resolve(repositoryRoot, path);
    assert(isWithin(repositoryRoot, absolutePath), `${label} escapes the repository: ${path}`);
    return absolutePath;
}

function listFiles(directory) {
    if (!existsSync(directory)) {
        return [];
    }

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : [path];
    });
}

function validateDependencies(entrypointPath, checkedDependencies) {
    if (checkedDependencies.has(entrypointPath)) {
        return;
    }

    checkedDependencies.add(entrypointPath);
    const source = readFileSync(entrypointPath, 'utf8');
    includePattern.lastIndex = 0;
    const includes = [...source.matchAll(includePattern)].map((match) => match[1]);

    for (const includePath of includes) {
        const dependencyPath = resolve(dirname(entrypointPath), includePath);
        const displayPath = relative(repositoryRoot, entrypointPath);

        assert(
            isWithin(hardwareRoot, dependencyPath),
            `${displayPath} includes a dependency outside hardware/: ${includePath}`,
        );
        assert(
            existsSync(dependencyPath),
            `${displayPath} has a missing OpenSCAD dependency: ${includePath}`,
        );
        assert(
            extname(dependencyPath) === '.scad',
            `${displayPath} includes a non-OpenSCAD dependency: ${includePath}`,
        );

        validateDependencies(dependencyPath, checkedDependencies);
    }
}

function validateRegistry() {
    assert(existsSync(registryPath), 'Missing hardware/models.json.');
    assert(existsSync(schemaPath), 'Missing hardware/models.schema.json.');

    const registry = readJson(registryPath, 'hardware/models.json');
    const registrySchema = readJson(schemaPath, 'hardware/models.schema.json');
    const bomParts = readJson(bomPartsPath, 'bom/catalog/parts.json');

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validateRegistrySchema = ajv.compile(registrySchema);
    if (!validateRegistrySchema(registry)) {
        fail(
            `hardware/models.json does not match hardware/models.schema.json:\n${ajv.errorsText(
                validateRegistrySchema.errors,
                { separator: '\n' },
            )}`,
        );
    }

    assert(registry && typeof registry === 'object' && !Array.isArray(registry), 'CAD registry must be an object.');
    assert(registry.$schema === './models.schema.json', 'CAD registry must reference ./models.schema.json.');
    assert(registry.schemaVersion === 1, 'Unsupported CAD registry schemaVersion.');
    assert(registry.units === 'mm', 'CAD registry units must be millimetres.');
    assert(
        registry.openScadVersion === '2021.01',
        'CAD registry openScadVersion must be the pinned version 2021.01.',
    );
    assert(Array.isArray(registry.models) && registry.models.length > 0, 'CAD registry must contain models.');
    assert(Array.isArray(bomParts.parts), 'bom/catalog/parts.json must contain a parts array.');

    const knownBomPartIds = new Set(bomParts.parts.map((part) => part.id));

    const ids = new Set();
    const modelsById = new Map();
    const outputs = new Set();
    const registeredEntrypoints = new Set();
    const checkedDependencies = new Set();

    for (const [index, model] of registry.models.entries()) {
        const label = `models[${index}]`;
        assert(model && typeof model === 'object' && !Array.isArray(model), `${label} must be an object.`);
        assert(idPattern.test(model.id), `${label}.id is invalid: ${model.id}`);
        assert(!ids.has(model.id), `Duplicate CAD model id: ${model.id}`);
        ids.add(model.id);
        modelsById.set(model.id, model);

        assert(revisionPattern.test(model.revision), `${model.id} has an invalid revision: ${model.revision}`);
        assert(allowedStatuses.has(model.status), `${model.id} has an invalid status: ${model.status}`);
        assert(
            allowedArtifactRoles.has(model.artifactRole),
            `${model.id} has an invalid artifactRole: ${model.artifactRole}`,
        );
        assert(Array.isArray(model.bomPartIds), `${model.id} bomPartIds must be an array.`);
        assert(
            new Set(model.bomPartIds).size === model.bomPartIds.length,
            `${model.id} has duplicate BOM part IDs.`,
        );
        for (const bomPartId of model.bomPartIds) {
            assert(idPattern.test(bomPartId), `${model.id} has an invalid BOM part ID: ${bomPartId}`);
            assert(
                knownBomPartIds.has(bomPartId),
                `${model.id} references an unknown BOM part ID: ${bomPartId}`,
            );
        }
        assert(idPattern.test(model.assembly), `${model.id} has an invalid assembly: ${model.assembly}`);
        assert(
            typeof model.description === 'string' && model.description.trim().length > 0,
            `${model.id} requires a description.`,
        );

        const expectedPrefix = `hardware/assemblies/${model.assembly}/`;
        assert(
            model.entrypoint.startsWith(expectedPrefix) && model.entrypoint.endsWith('.scad'),
            `${model.id} entrypoint must be an OpenSCAD file under ${expectedPrefix}`,
        );
        assert(
            model.documentation.startsWith(expectedPrefix) &&
                model.documentation.endsWith('/README.md'),
            `${model.id} documentation must be an assembly README under ${expectedPrefix}`,
        );

        assert(typeof model.output === 'string', `${model.id} output must be a filename.`);
        const outputExtension = extname(model.output);
        assert(
            model.output === model.output.toLowerCase() &&
                ['.stl', '.csg'].includes(outputExtension) &&
                !model.output.includes('/') &&
                !model.output.includes('\\'),
            `${model.id} output must be a lowercase STL or CSG filename.`,
        );
        assert(
            model.output.includes(`-r${model.revision}${outputExtension}`),
            `${model.id} output must contain its design revision.`,
        );
        if (model.artifactRole === 'fabrication') {
            assert(outputExtension === '.stl', `${model.id} fabrication output must be STL.`);
            assert(model.bomPartIds.length > 0, `${model.id} fabrication model needs a BOM part ID.`);
        } else {
            assert(outputExtension === '.csg', `${model.id} reference output must be CSG, not a printable mesh.`);
            assert(model.bomPartIds.length === 0, `${model.id} reference model must not claim a BOM part ID.`);
        }
        assert(!outputs.has(model.output), `Duplicate CAD output filename: ${model.output}`);
        outputs.add(model.output);

        const entrypointPath = resolveRepositoryPath(model.entrypoint, `${model.id} entrypoint`);
        const documentationPath = resolveRepositoryPath(
            model.documentation,
            `${model.id} documentation`,
        );
        assert(existsSync(entrypointPath), `${model.id} entrypoint does not exist: ${model.entrypoint}`);
        assert(existsSync(documentationPath), `${model.id} documentation does not exist: ${model.documentation}`);
        assert(statSync(entrypointPath).isFile(), `${model.id} entrypoint is not a file.`);
        assert(statSync(documentationPath).isFile(), `${model.id} documentation is not a file.`);

        const source = readFileSync(entrypointPath, 'utf8');
        assert(
            source.includes(model.id.replaceAll('-', ' ')) || source.includes(model.id),
            `${model.id} source header must identify the model.`,
        );
        if (model.status === 'concept-unvalidated') {
            assert(
                source.includes('concept-unvalidated'),
                `${model.id} source must state its concept-unvalidated status.`,
            );
        }

        registeredEntrypoints.add(entrypointPath);
        validateDependencies(entrypointPath, checkedDependencies);
    }

    const tracedModelPartPairs = new Set();
    for (const part of bomParts.parts) {
        const sources = part.fabrication?.sources ?? [];
        assert(Array.isArray(sources), `BOM part ${part.id} fabrication.sources must be an array.`);

        for (const [sourceIndex, source] of sources.entries()) {
            const label = `BOM part ${part.id} fabrication.sources[${sourceIndex}]`;
            assert(
                source && typeof source === 'object' && !Array.isArray(source),
                `${label} must be an object.`,
            );
            const model = modelsById.get(source.modelId);

            assert(model, `${label} references an unknown CAD model: ${source.modelId}`);
            assert(
                model.artifactRole === 'fabrication',
                `${label} references ${model.id}, which is not a fabrication model.`,
            );
            assert(
                source.path === model.entrypoint,
                `${label} path ${source.path} does not match ${model.id} entrypoint ${model.entrypoint}.`,
            );
            assert(
                source.revision === model.revision,
                `${label} revision ${source.revision} does not match ${model.id} revision ${model.revision}.`,
            );
            assert(
                part.fabrication.modelStatus === model.status,
                `${label} status ${part.fabrication.modelStatus} does not match ${model.id} status ${model.status}.`,
            );
            assert(
                model.bomPartIds.includes(part.id),
                `${label} is not back-referenced by ${model.id} bomPartIds.`,
            );

            tracedModelPartPairs.add(`${model.id}\u0000${part.id}`);
        }
    }

    for (const model of registry.models) {
        if (model.artifactRole !== 'fabrication') {
            continue;
        }

        for (const bomPartId of model.bomPartIds) {
            assert(
                tracedModelPartPairs.has(`${model.id}\u0000${bomPartId}`),
                `${model.id} maps to BOM part ${bomPartId}, but that part has no matching fabrication source.`,
            );
        }
    }

    const assemblySources = listFiles(join(hardwareRoot, 'assemblies')).filter(
        (path) => extname(path) === '.scad',
    );
    const unregisteredSources = assemblySources.filter((path) => !registeredEntrypoints.has(path));
    assert(
        unregisteredSources.length === 0,
        `Unregistered assembly OpenSCAD source(s): ${unregisteredSources
            .map((path) => relative(repositoryRoot, path))
            .join(', ')}`,
    );

    return registry;
}

function detectOpenScad() {
    const result = spawnSync('openscad', ['--version'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') {
        return null;
    }
    if (result.error) {
        fail(`Unable to execute OpenSCAD: ${result.error.message}`);
    }
    if (result.status !== 0) {
        fail(`OpenSCAD version check failed:\n${result.stderr || result.stdout}`);
    }

    const label = (result.stdout || result.stderr).trim().split('\n')[0];
    const versionMatch = label.match(/^OpenSCAD version ([0-9]+\.[0-9]+)(?:\s|$)/u);
    assert(versionMatch, `Could not parse OpenSCAD version output: ${label || '(empty)'}`);

    return {
        label,
        version: versionMatch[1],
    };
}

function compileModels(registry, openScadVersion) {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'arbi-cad-'));
    console.log(`Compiling ${registry.models.length} model(s) with ${openScadVersion}.`);

    try {
        for (const model of registry.models) {
            const entrypointPath = resolveRepositoryPath(model.entrypoint, `${model.id} entrypoint`);
            const outputPath = join(outputDirectory, model.output);
            const result = spawnSync('openscad', ['-o', outputPath, entrypointPath], {
                cwd: repositoryRoot,
                encoding: 'utf8',
                timeout: 120_000,
            });
            const diagnostics = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

            if (result.error) {
                fail(`${model.id} OpenSCAD execution failed: ${result.error.message}`);
            }
            if (result.status !== 0) {
                fail(`${model.id} failed to compile.${diagnostics ? `\n${diagnostics}` : ''}`);
            }
            if (/\b(?:ERROR|WARNING):/u.test(diagnostics)) {
                fail(`${model.id} emitted OpenSCAD diagnostics:\n${diagnostics}`);
            }
            assert(existsSync(outputPath), `${model.id} did not produce ${model.output}.`);
            assert(statSync(outputPath).size > 0, `${model.id} produced an empty CAD artifact.`);
            console.log(`  compiled ${model.id} ${model.revision}`);
        }
    } finally {
        rmSync(outputDirectory, { recursive: true, force: true });
    }
}

function parseArguments() {
    const options = {
        requireOpenScad: false,
        staticOnly: false,
    };

    for (const argument of process.argv.slice(2)) {
        if (argument === '--') {
            continue;
        } else if (argument === '--require-openscad') {
            options.requireOpenScad = true;
        } else if (argument === '--static-only') {
            options.staticOnly = true;
        } else {
            fail(`Unknown argument: ${argument}`);
        }
    }

    assert(
        !(options.requireOpenScad && options.staticOnly),
        '--require-openscad and --static-only cannot be used together.',
    );
    return options;
}

try {
    const options = parseArguments();
    const registry = validateRegistry();
    console.log(`Static CAD validation passed for ${registry.models.length} registered model(s).`);

    if (!options.staticOnly) {
        const openScad = detectOpenScad();
        if (openScad) {
            assert(
                openScad.version === registry.openScadVersion,
                `OpenSCAD ${openScad.version} is installed, but the model registry requires exactly ${registry.openScadVersion}.`,
            );
            compileModels(registry, openScad.label);
        } else if (options.requireOpenScad) {
            fail('OpenSCAD is required but the openscad executable was not found.');
        } else {
            console.log('OpenSCAD is not installed; compilation skipped.');
        }
    }
} catch (error) {
    console.error(`CAD validation failed: ${error.message}`);
    process.exitCode = 1;
}
