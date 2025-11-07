import * as core from '@actions/core';
import { promises as fs } from 'fs';

/** checks if a path is a junction point */
export async function isJunction(targetPath: string): Promise<boolean> {
    try {
        const stats = await fs.lstat(targetPath);
        // on windows, nodejs returns isSymbolicLink true for junctions as well
        return stats.isSymbolicLink();
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

/** creates a Windows junction point */
export async function create(junctionPath: string, targetPath: string): Promise<void> {
    core.info(`Creating junction: ${junctionPath} -> ${targetPath}`);

    try {
        // create the junction (symlink with type 'junction')
        await fs.symlink(targetPath, junctionPath, 'junction');
        core.info('Junction created successfully');
    } catch (error) {
        throw new Error(
            `Failed to create junction: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/** removes a junction point (but not the target directory) */
export async function remove(junctionPath: string): Promise<void> {
    core.info(`Removing junction: ${junctionPath}`);

    try {
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

/** Updates the current junction to point to another path. */
export async function update(junctionPath: string, newPath: string): Promise<void> {
    core.info(`Updating ${junctionPath} junction to: ${newPath}`);

    const exists = await fs
        .access(junctionPath)
        .then(() => true)
        .catch(() => false);

    if (exists) {
        // if it exists, ensure it's actually a junction before removing
        if (!(await isJunction(junctionPath))) {
            throw new Error(
                `${junctionPath} exists but is not a junction. Manual intervention required to avoid data loss.`,
            );
        }

        // all good, remove existing junction
        await remove(junctionPath);
    }

    // create the new junction, pointing to the new path
    await create(junctionPath, newPath);
    core.info(`Junction ${junctionPath} updated successfully`);
}

/** try to get the target path of a junction */
export async function getTarget(junctionPath: string): Promise<string | undefined> {
    try {
        const target = await fs.readlink(junctionPath);
        return target.replace(/[\\]+$/, '');
    } catch {
        return undefined;
    }
}
