import type { Step } from '@/types';
import * as core from '@actions/core';
import fs from 'node:fs/promises';
import path from 'node:path';

function generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/** get the short SHA from the Git context */
function getShortSha(): string {
    const sha =
        process.env.GITHUB_SHA || process.env.GITEA_SHA || process.env.CI_COMMIT_SHA || 'unknown';

    return sha.substring(0, 7);
}

/** creates a new release directory */
export async function createReleaseDirectory(
    deployRoot: string,
    releaseId: string,
): Promise<string> {
    const releasePath = path.join(deployRoot, 'releases', releaseId);
    try {
        await fs.mkdir(releasePath, { recursive: true });
        return releasePath;
    } catch (error) {
        throw new Error(
            `Failed to create release directory: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

const run: Step['run'] = async (ctx) => {
    const timestamp = generateTimestamp();
    const shortSha = getShortSha();
    const releaseId = `${timestamp}-${shortSha}`;

    core.info('Creating release directory...');

    const releasePath = await createReleaseDirectory(ctx.inputs.deployRoot, releaseId);

    core.info(`Release ID: ${releaseId}`);
    core.info(`Release path: ${releasePath}`);

    // set outputs in context
    ctx.outputs = { ...ctx.outputs, releaseId, releasePath };
};

/**
 * Prepare the release directory by generating a unique release ID and creating the corresponding
 * directory under `{deploy_root}/releases/`.
 *
 * The release ID is formed using the current timestamp and the short Git SHA:
 * `YYYYMMDD-HHMMSS-SHORTSHA`
 */
export default {
    moji: '📂',
    description: 'Prepare Release Directory',
    run,
} satisfies Step;
