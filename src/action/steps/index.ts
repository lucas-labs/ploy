import type { ActionInputs, Context, Step } from '@/types';
import * as core from '@actions/core';

const summary = (ctx: Context) => {
    core.startGroup('✅ Deployment Complete');
    core.info(`Release ID: ${ctx.outputs.releaseId}`);
    core.info(`Release path: ${ctx.outputs.releasePath}`);
    core.info(`Current junction: ${ctx.outputs.currentJunction}`);
    if (ctx.outputs.previousRelease) {
        core.info(`Previous release: ${ctx.outputs.previousRelease}`);
    }
    core.info(`Deployment time: ${ctx.outputs.deploymentTime}`);
    if (ctx.outputs.healthcheckStatus) {
        core.info(
            `Health check: ${ctx.outputs.healthcheckStatus} (code: ${ctx.outputs.healthcheckCode}, attempts: ${ctx.outputs.healthcheckAttempts})`,
        );
    }
    core.endGroup();
    return;
};

/** runs the provided steps in sequence and returns the final outputs */
const execute = async (steps: Step[], inputs: ActionInputs) => {
    const ctx: Context = { inputs, outputs: {} };
    const t0 = performance.now(); // to measure total deployment time

    for (let i = 1; i <= steps.length; i++) {
        const step = steps[i - 1];
        core.startGroup(`${step.moji} Step ${i}: ${step.description}`);
        await step.run(ctx);
        core.endGroup();
    }

    ctx.outputs = {
        ...ctx.outputs,
        deploymentTime: new Date().toISOString(),
        elapsed: (performance.now() - t0) / 1000,
    };

    // log summary
    summary(ctx);

    return ctx.outputs;
};

export default { execute };
