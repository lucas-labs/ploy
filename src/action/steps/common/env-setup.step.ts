import type { Step } from '@/types';
import * as core from '@actions/core';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ensures the deploy root directory exists and is writable;
 * Creates the directory structure: deploy_root/releases/
 */
export async function ensureDeployRoot(deployRoot: string): Promise<void> {
    core.info(`Ensuring deploy root exists: ${deployRoot}`);

    try {
        // check if deploy_root exists
        const stats = await fs.stat(deployRoot).catch(() => null);
        if (!stats) {
            // does not exist, let's create it
            core.info(`Creating deploy root: ${deployRoot}`);
            await fs.mkdir(deployRoot, { recursive: true });
        } else if (!stats.isDirectory()) {
            throw new Error(`Deploy root exists but is not a directory: ${deployRoot}`);
        }

        // test write access by creating and deleting a temp file
        const testFile = path.join(deployRoot, '.write-test');
        await fs.writeFile(testFile, '');
        await fs.unlink(testFile);
        core.info('Deploy root is writable');

        // ensure releases subdirectory exists
        const releasesDir = path.join(deployRoot, 'releases');
        await fs.mkdir(releasesDir, { recursive: true });
        core.info(`Releases directory ready: ${releasesDir}`);
    } catch (error) {
        throw new Error(
            `Failed to setup deploy root: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

const run: Step['run'] = async (context) => {
    return ensureDeployRoot(context.inputs.deployRoot);
};

/**
 * Setup the deployment environment:
 * - Ensures the deploy root directory exists and is writable
 * - Creates the releases subdirectory if it does not yet exist
 */
export default {
    moji: '📁',
    description: 'Environment Setup',
    run,
} satisfies Step;
