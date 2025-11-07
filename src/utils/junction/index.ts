import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Checks if a path is a junction point
 */
export async function isJunction(targetPath: string): Promise<boolean> {
    try {
        const stats = await fs.lstat(targetPath);
        // On Windows, junctions are symbolic links
        return stats.isSymbolicLink();
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

/**
 * Creates a Windows junction point
 * Uses the mklink command on Windows
 */
export async function createJunction(junctionPath: string, targetPath: string): Promise<void> {
    core.info(`Creating junction: ${junctionPath} -> ${targetPath}`);

    try {
        // On Windows, we use mklink /J
        // Note: fs.symlink with 'junction' type should work, but we'll use it for better Windows compatibility
        await fs.symlink(targetPath, junctionPath, 'junction');
        core.info('Junction created successfully');
    } catch (error) {
        throw new Error(
            `Failed to create junction: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Removes a junction point (but not the target directory)
 */
export async function removeJunction(junctionPath: string): Promise<void> {
    core.info(`Removing junction: ${junctionPath}`);

    try {
        // Use fs.unlink to remove the junction (not rmdir, which would delete the target)
        await fs.unlink(junctionPath);
        core.info('Junction removed successfully');
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            core.info('Junction does not exist, nothing to remove');
            return;
        }
        throw new Error(
            `Failed to remove junction: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Updates the current junction to point to a new release
 * Performs safety checks before updating
 */
export async function updateCurrentJunction(
    deployRoot: string,
    newReleasePath: string,
): Promise<string> {
    const currentPath = path.join(deployRoot, 'current');

    core.info(`Updating current junction to: ${newReleasePath}`);

    // Check if current exists
    const exists = await fs
        .access(currentPath)
        .then(() => true)
        .catch(() => false);

    if (exists) {
        // Safety check: ensure it's actually a junction
        const isJunc = await isJunction(currentPath);
        if (!isJunc) {
            throw new Error(
                `Safety check failed: ${currentPath} exists but is not a junction. ` +
                    `Manual intervention required to avoid data loss.`,
            );
        }

        // Remove the existing junction
        await removeJunction(currentPath);
    }

    // Create new junction
    await createJunction(currentPath, newReleasePath);

    core.info(`Current junction updated successfully`);
    return currentPath;
}
