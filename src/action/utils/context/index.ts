import * as core from '@actions/core';
import type { ActionInputs, ActionOutputs } from '../../types';

/** parses action inputs from the environment */
const getInputs = (): ActionInputs => {
    // required inputs
    const appName = core.getInput('app_name', { required: true });
    const deployRoot = core.getInput('deploy_root', { required: true });

    // optional inputs with defaults
    const repoPath = core.getInput('repo_path') || process.cwd();
    const installCmd = core.getInput('install_cmd') || undefined;
    const buildCmd = core.getInput('build_cmd') || undefined;
    const distDir = core.getInput('dist_dir') || undefined;

    // pre-deploy commands
    const preDeployCmdsInput = core.getInput('pre_deploy_cmds');
    let preDeployCmds: string[] | undefined;
    if (preDeployCmdsInput) {
        try {
            preDeployCmds = JSON.parse(preDeployCmdsInput);
            if (!Array.isArray(preDeployCmds)) {
                throw new Error('pre_deploy_cmds must be a JSON array');
            }
        } catch (error) {
            throw new Error(
                `Failed to parse pre_deploy_cmds: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // health check inputs
    const healthcheckUrl = core.getInput('healthcheck_url') || undefined;
    const expectedHealthcheckCodeRange =
        core.getInput('expected_healthcheck_code_range') || '200-299';
    const healthcheckTimeout = parseInt(core.getInput('healthcheck_timeout') || '30', 10);
    const healthcheckRetries = parseInt(core.getInput('healthcheck_retries') || '3', 10);
    const healthcheckDelay = parseInt(core.getInput('healthcheck_delay') || '5', 10);
    const healthcheckInterval = parseInt(core.getInput('healthcheck_interval') || '5', 10);

    return {
        appName,
        deployRoot,
        repoPath,
        installCmd,
        buildCmd,
        distDir,
        preDeployCmds,
        healthcheckUrl,
        expectedHealthcheckCodeRange,
        healthcheckTimeout,
        healthcheckRetries,
        healthcheckDelay,
        healthcheckInterval,
    };
};

/** sets action outputs */
const setOutputs = (outputs: ActionOutputs): void => {
    core.setOutput('release_path', outputs.releasePath);
    core.setOutput('release_id', outputs.releaseId);
    core.setOutput('deployment_time', outputs.deploymentTime);
    core.setOutput('current_junction', outputs.currentJunction);

    if (outputs.previousRelease !== undefined) {
        core.setOutput('previous_release', outputs.previousRelease);
    }
    if (outputs.healthcheckStatus !== undefined) {
        core.setOutput('healthcheck_status', outputs.healthcheckStatus);
    }
    if (outputs.healthcheckCode !== undefined) {
        core.setOutput('healthcheck_code', String(outputs.healthcheckCode));
    }
    if (outputs.healthcheckAttempts !== undefined) {
        core.setOutput('healthcheck_attempts', String(outputs.healthcheckAttempts));
    }
};

export { getInputs, setOutputs };
