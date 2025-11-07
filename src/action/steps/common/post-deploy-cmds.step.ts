import type { Step } from '@/types';
import { executeCommands } from '@/utils/commands';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    const releasePath = ctx.outputs.releasePath;
    if (!releasePath) {
        throw new Error('Release path is not defined in context outputs.');
    }

    if (ctx.inputs.postDeployCmds && ctx.inputs.postDeployCmds.length > 0) {
        return await executeCommands(
            ctx.inputs.postDeployCmds,
            releasePath,
            'Post-deploy commands',
        );
    } else {
        core.info('Execute Post-Deploy Commands Skipped (no post_deploy_cmds provided)');
    }
};

/**
 * Execute post-deployment commands in the newly created release directory.
 *
 * This step is typically used to perform tasks in the freshly created release directory, after
 * it has become the active release (current junction points to it). Example:
 *
 * - Starting processes / services (e.g., starting the newly deployed application)
 * - Running non-url based health checks or sanity checks
 * - Notifying of successful deployment (e.g., sending messages to Slack, email, etc.)
 *
 * *optional, will not run if no `post_deploy_cmds` are provided*
 */
export default {
    moji: '⚙️',
    description: 'Execute post-Deployment Commands',
    run,
} satisfies Step;
