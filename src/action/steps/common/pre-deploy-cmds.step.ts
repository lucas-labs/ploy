import type { Step } from '@/types';
import { executeCommands } from '@/utils/commands';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    const releasePath = ctx.outputs.releasePath;
    if (!releasePath) {
        throw new Error('Release path is not defined in context outputs.');
    }

    if (ctx.inputs.preDeployCmds && ctx.inputs.preDeployCmds.length > 0) {
        return await executeCommands(ctx.inputs.preDeployCmds, releasePath, 'Pre-deploy commands');
    } else {
        core.info('Execute Pre-Deploy Commands Skipped (no pre_deploy_cmds provided)');
    }
};

/**
 * Execute pre-deployment commands in the newly created release directory.
 *
 * This step is typically used to perform tasks in the freshly created release directory, before
 * it becomes the active release. Example:
 *
 * - Installing dependencies
 * - Running database migrations
 * - Stopping processes / services (e.g., stopping the running application to prepare for the new
 *   version)
 *
 * *optional, will not run if no `pre_deploy_cmds` are provided*
 */
export default {
    moji: '⚙️',
    description: 'Execute Pre-Deployment Commands',
    run,
} satisfies Step;
