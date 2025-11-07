import type { Step } from '@/types';
import { executeCommands } from '@/utils/commands';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    if (ctx.inputs.installCmds && ctx.inputs.installCmds.length > 0) {
        return executeCommands(ctx.inputs.installCmds, ctx.inputs.repoPath, 'Install dependencies');
    } else {
        core.info('Install Dependencies Skipped (no install_cmds provided)');
    }
};

/**
 * Install project dependencies in the repository path (repo where the code is checked out)
 * by executing the specified installation commands.
 *
 * This step is typically used to run package managers like npm, yarn, bun, etc. before building
 * the application.
 *
 * *optional, will not run if no `install_cmds` are provided*
 */
export default {
    moji: '📦',
    description: 'Install Dependencies',
    run,
} satisfies Step;
