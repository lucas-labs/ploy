import type { Step } from '@/types';
import * as health from '@/utils/healthcheck';
import * as core from '@actions/core';

const run: Step['run'] = async (ctx) => {
    if (ctx.inputs.healthcheckUrl) {
        core.startGroup('🏥 Step 7: Health Check');
        const healthCheck = await health.check(
            ctx.inputs.healthcheckUrl,
            ctx.inputs.expectedHealthcheckCodeRange,
            ctx.inputs.healthcheckTimeout,
            ctx.inputs.healthcheckRetries,
            ctx.inputs.healthcheckDelay,
            ctx.inputs.healthcheckInterval,
        );

        ctx.outputs = {
            ...ctx.outputs,
            healthcheckStatus: healthCheck.success ? 'passed' : 'failed',
            healthcheckCode: healthCheck.statusCode,
            healthcheckAttempts: healthCheck.attempts,
        };

        if (!healthCheck.success) {
            throw new Error(`Health check failed: ${healthCheck.error}`);
        }
    } else {
        core.info('Health Check Skipped (no healthcheck_url provided)');
    }
};

/**
 * Perform a health check on the deployed application by sending requests to the specified URL
 * and verifying the response status code is within the expected range.
 */
export default {
    moji: '🏥',
    description: 'Health Check',
    run,
} satisfies Step;
