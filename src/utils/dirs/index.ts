import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Ensures the deploy root directory exists and is writable
 * Creates the directory structure: deploy_root/releases/
 */
export async function ensureDeployRoot(deployRoot: string): Promise<void> {
    core.info(`Ensuring deploy root exists: ${deployRoot}`);

    try {
        // Check if deploy_root exists
        const stats = await fs.stat(deployRoot).catch(() => null);

        if (!stats) {
            // Create deploy_root if it doesn't exist
            core.info(`Creating deploy root: ${deployRoot}`);
            await fs.mkdir(deployRoot, { recursive: true });
        } else if (!stats.isDirectory()) {
            throw new Error(`Deploy root exists but is not a directory: ${deployRoot}`);
        }

        // Test write access by creating and deleting a temp file
        const testFile = path.join(deployRoot, '.write-test');
        await fs.writeFile(testFile, '');
        await fs.unlink(testFile);
        core.info('Deploy root is writable');

        // Ensure releases subdirectory exists
        const releasesDir = path.join(deployRoot, 'releases');
        await fs.mkdir(releasesDir, { recursive: true });
        core.info(`Releases directory ready: ${releasesDir}`);
    } catch (error) {
        throw new Error(
            `Failed to setup deploy root: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Validates that a directory exists
 */
export async function validateDirectory(dirPath: string, name: string): Promise<void> {
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            throw new Error(`${name} exists but is not a directory: ${dirPath}`);
        }
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`${name} does not exist: ${dirPath}`);
        }
        throw error;
    }
}

/**
 * Creates a new release directory with timestamp-sha format
 */
export async function createReleaseDirectory(
    deployRoot: string,
    timestamp: string,
    shortSha: string,
): Promise<string> {
    const releaseId = `${timestamp}-${shortSha}`;
    const releasePath = path.join(deployRoot, 'releases', releaseId);

    core.info(`Creating release directory: ${releasePath}`);

    try {
        await fs.mkdir(releasePath, { recursive: true });
        return releasePath;
    } catch (error) {
        throw new Error(
            `Failed to create release directory: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Gets the previous release path by reading the current junction
 */
export async function getPreviousRelease(deployRoot: string): Promise<string | undefined> {
    const currentPath = path.join(deployRoot, 'current');

    try {
        const target = await fs.readlink(currentPath);
        // Normalize the path to remove trailing backslashes on Windows
        const normalizedTarget = target.replace(/[\\]+$/, '');
        core.info(`Previous release: ${normalizedTarget}`);
        return normalizedTarget;
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            core.info('No previous release found (current junction does not exist)');
            return undefined;
        }
        // If readlink fails for other reasons, it might not be a junction
        core.warning(
            `Could not read previous release: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
    }
}
