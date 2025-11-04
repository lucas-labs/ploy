import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Common directories to exclude when copying files
 */
const DEFAULT_EXCLUDE_PATTERNS = [
    '.git',
    '.gitignore',
    '.gitattributes',
    'node_modules',
    '__pycache__',
    '.venv',
    'venv',
    '.env',
    '.pytest_cache',
    '.mypy_cache',
    '.tox',
    'dist',
    'build',
    'target',
    '.idea',
    '.vscode',
    '.vs',
    '.DS_Store',
    'Thumbs.db',
];

/**
 * Checks if a path should be excluded based on patterns
 */
function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
    const parts = relativePath.split(path.sep);

    for (const part of parts) {
        if (excludePatterns.includes(part)) {
            return true;
        }
    }

    return false;
}

/**
 * Recursively copies a directory, excluding specified patterns
 */
async function copyDirectoryRecursive(
    src: string,
    dest: string,
    rootSrc: string,
    excludePatterns: string[],
): Promise<number> {
    let fileCount = 0;
    const entries = await fs.readdir(src, { withFileTypes: true });

    await fs.mkdir(dest, { recursive: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const relativePath = path.relative(rootSrc, srcPath);

        if (shouldExclude(relativePath, excludePatterns)) {
            core.debug(`Skipping excluded path: ${relativePath}`);
            continue;
        }

        if (entry.isDirectory()) {
            const count = await copyDirectoryRecursive(srcPath, destPath, rootSrc, excludePatterns);
            fileCount += count;
        } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
            fileCount++;
        }
    }

    return fileCount;
}

/**
 * Copies files from source to destination
 * If distDir is provided, copies only that directory's contents
 * Otherwise, copies the entire repo excluding common patterns
 */
export async function copyFiles(
    repoPath: string,
    releasePath: string,
    distDir?: string,
): Promise<void> {
    let sourcePath: string;
    let excludePatterns: string[];

    if (distDir) {
        // Copy only the dist directory
        sourcePath = path.join(repoPath, distDir);
        excludePatterns = []; // Don't exclude anything from dist

        core.info(`Copying files from dist directory: ${sourcePath}`);

        // Validate that dist directory exists
        try {
            const stats = await fs.stat(sourcePath);
            if (!stats.isDirectory()) {
                throw new Error(`dist_dir exists but is not a directory: ${sourcePath}`);
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                throw new Error(`dist_dir does not exist: ${sourcePath}`);
            }
            throw error;
        }
    } else {
        // Copy entire repo with exclusions
        sourcePath = repoPath;
        excludePatterns = DEFAULT_EXCLUDE_PATTERNS;

        core.info(`Copying files from repository: ${sourcePath}`);
        core.info(`Excluding patterns: ${excludePatterns.join(', ')}`);
    }

    try {
        const fileCount = await copyDirectoryRecursive(
            sourcePath,
            releasePath,
            sourcePath,
            excludePatterns,
        );

        core.info(`✓ Copied ${fileCount} files to release directory`);
    } catch (error) {
        throw new Error(
            `Failed to copy files: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}
