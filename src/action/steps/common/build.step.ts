import type { Step } from '@/types';
import { executeCommands } from '@/utils/commands';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    if (ctx.inputs.buildCmds && ctx.inputs.buildCmds.length > 0) {
        return executeCommands(ctx.inputs.buildCmds, ctx.inputs.repoPath, 'Build application');
    } else {
        core.info('Build Application Skipped (no build_cmds provided)');
    }
};

/** Build the application by executing the specified build commands in the repository path */
export default {
    moji: '🔨',
    description: 'Build Application',
    run,
} satisfies Step;
