import type { Step } from '@/types';
import { copyFiles } from '@/utils/files';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    const releasePath = ctx.outputs.releasePath;
    if (!releasePath) {
        throw new Error('Release path is not defined in context outputs.');
    }
    core.info(
        `Copying files from '${ctx.inputs.distDir ? ctx.inputs.distDir : ctx.inputs.repoPath}' to release directory`,
    );
    await copyFiles(ctx.inputs.repoPath, releasePath, ctx.inputs.distDir);
    core.info('Files copied successfully');
};

/**
 * Copy application files from the repository (or specified distribution directory) to the newly
 * created release directory.
 *
 * If a `dist_dir` is specified, files will be copied from that directory inside the repository.
 * Otherwise, files will be copied from the root of the repository.
 */
export default {
    moji: '📋',
    description: 'Copy Files to Release Directory',
    run,
} satisfies Step;
