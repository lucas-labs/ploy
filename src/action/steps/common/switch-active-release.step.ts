import type { Step } from '@/types';
import * as junction from '@/utils/junction';
import * as core from '@actions/core';
import path from 'node:path';

const run: Step['run'] = async (ctx) => {
    const releasePath = ctx.outputs.releasePath;
    if (!releasePath) {
        throw new Error('Release path is not defined in context outputs.');
    }

    const currentPath = path.join(ctx.inputs.deployRoot, 'current');

    const previousRelease = await junction.getTarget(currentPath);
    await junction.update(currentPath, releasePath);

    core.info(`Switched active release from '${previousRelease ?? 'none'}' to '${currentPath}'`);

    ctx.outputs = { ...ctx.outputs, previousRelease, currentJunction: currentPath };
};

/**
 * Switch the active release by updating the 'current' junction to point to the new release
 * directory.
 */
export default {
    moji: '🔄',
    description: 'Switch Active Release',
    run,
} satisfies Step;
