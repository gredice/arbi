#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const ignoredDirectories = new Set([
    '.git',
    '.next',
    '.turbo',
    'coverage',
    'dist',
    'node_modules',
]);
const inlineLinkPattern = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/gu;
const referenceLinkPattern = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/u;
const schemePattern = /^[a-z][a-z0-9+.-]*:/iu;

function isWithin(parent, candidate) {
    const pathFromParent = relative(parent, candidate);
    return (
        pathFromParent === '' ||
        (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== '..' && !isAbsolute(pathFromParent))
    );
}

function listMarkdownFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
            return [];
        }

        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            return listMarkdownFiles(path);
        }

        return entry.isFile() && extname(entry.name).toLowerCase() === '.md' ? [path] : [];
    });
}

function stripInlineCode(line) {
    return line.replace(/(`+)(.*?)\1/gu, '');
}

function extractLinks(path) {
    const links = [];
    const lines = readFileSync(path, 'utf8').split(/\r?\n/u);
    let fence = null;

    for (const [index, sourceLine] of lines.entries()) {
        const fenceMatch = sourceLine.match(/^\s*(`{3,}|~{3,})/u);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (!fence) {
                fence = { character: marker[0], length: marker.length };
            } else if (marker[0] === fence.character && marker.length >= fence.length) {
                fence = null;
            }
            continue;
        }
        if (fence) {
            continue;
        }

        const line = stripInlineCode(sourceLine);
        inlineLinkPattern.lastIndex = 0;
        for (const match of line.matchAll(inlineLinkPattern)) {
            links.push({ line: index + 1, target: match[1] ?? match[2] });
        }

        const referenceMatch = line.match(referenceLinkPattern);
        if (referenceMatch) {
            links.push({ line: index + 1, target: referenceMatch[1] ?? referenceMatch[2] });
        }
    }

    return links;
}

function resolveLocalTarget(sourcePath, rawTarget) {
    if (
        rawTarget.startsWith('#') ||
        rawTarget.startsWith('//') ||
        schemePattern.test(rawTarget)
    ) {
        return null;
    }

    const pathPart = rawTarget.split(/[?#]/u, 1)[0];
    if (!pathPart) {
        return null;
    }

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathPart);
    } catch {
        throw new Error('contains invalid percent encoding');
    }

    const targetPath = decodedPath.startsWith('/')
        ? resolve(repositoryRoot, `.${decodedPath}`)
        : resolve(dirname(sourcePath), decodedPath);
    if (!isWithin(repositoryRoot, targetPath)) {
        throw new Error('escapes the repository');
    }

    return targetPath;
}

const markdownFiles = listMarkdownFiles(repositoryRoot).sort();
const errors = [];

for (const sourcePath of markdownFiles) {
    for (const link of extractLinks(sourcePath)) {
        let targetPath;
        try {
            targetPath = resolveLocalTarget(sourcePath, link.target);
        } catch (error) {
            errors.push(`${relative(repositoryRoot, sourcePath)}:${link.line}: ${link.target} (${error.message})`);
            continue;
        }

        if (targetPath && (!existsSync(targetPath) || !statSync(targetPath).isFile() && !statSync(targetPath).isDirectory())) {
            errors.push(`${relative(repositoryRoot, sourcePath)}:${link.line}: missing ${link.target}`);
        }
    }
}

if (errors.length > 0) {
    console.error(`Markdown link validation failed:\n${errors.join('\n')}`);
    process.exitCode = 1;
} else {
    console.log(`Markdown link validation passed for ${markdownFiles.length} file(s).`);
}
