import * as core from '@actions/core';
import type { ActionInputs, ActionOutputs } from '../../types';
import { ensureDeployRoot, createReleaseDirectory, getPreviousRelease } from '../../utils/dirs';
import { updateCurrentJunction } from '../../utils/junction';
import { executeCommands } from '../../utils/commands';
import { performHealthCheck } from '../../utils/healthcheck';
import { copyFiles } from '../../utils/files';

/**
 * Generates a timestamp in YYYYMMDD-HHMMSS format
 */
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

/**
 * Gets the short SHA from the Git context
 */
function getShortSha(): string {
    // Try to get SHA from environment variables (GitHub/Gitea Actions)
    const sha =
        process.env.GITHUB_SHA || process.env.GITEA_SHA || process.env.CI_COMMIT_SHA || 'unknown';

    return sha.substring(0, 7);
}

/**
 * Main deployment action
 */
export async function deployAction(inputs: ActionInputs): Promise<ActionOutputs> {
    core.startGroup('🚀 Starting deployment');
    core.info(`Application: ${inputs.appName}`);
    core.info(`Deploy root: ${inputs.deployRoot}`);
    core.info(`Repository path: ${inputs.repoPath}`);
    core.endGroup();

    // Step 1: Environment Setup
    core.startGroup('📁 Step 1: Environment Setup');
    await ensureDeployRoot(inputs.deployRoot);
    core.endGroup();

    // Step 2: Install Dependencies
    if (inputs.installCmds && inputs.installCmds.length > 0) {
        core.startGroup('📦 Step 2: Install Dependencies');
        await executeCommands(inputs.installCmds, inputs.repoPath, 'Install dependencies');
        core.endGroup();
    } else {
        core.info('📦 Step 2: Install Dependencies - Skipped (no install_cmds provided)');
    }

    // Step 3: Build Application
    if (inputs.buildCmds && inputs.buildCmds.length > 0) {
        core.startGroup('🔨 Step 3: Build Application');
        await executeCommands(inputs.buildCmds, inputs.repoPath, 'Build application');
        core.endGroup();
    } else {
        core.info('🔨 Step 3: Build Application - Skipped (no build_cmds provided)');
    }

    // Step 4: Prepare Release Directory
    core.startGroup('📂 Step 4: Prepare Release Directory');
    const timestamp = generateTimestamp();
    const shortSha = getShortSha();
    const releaseId = `${timestamp}-${shortSha}`;
    const releasePath = await createReleaseDirectory(inputs.deployRoot, timestamp, shortSha);

    core.info(`Release ID: ${releaseId}`);
    core.info(`Release path: ${releasePath}`);

    // Copy files to release directory
    await copyFiles(inputs.repoPath, releasePath, inputs.distDir);
    core.endGroup();

    // Step 5: Run Pre-Deploy Commands
    if (inputs.preDeployCmds && inputs.preDeployCmds.length > 0) {
        core.startGroup('⚙️  Step 5: Run Pre-Deploy Commands');
        await executeCommands(inputs.preDeployCmds, releasePath, 'Pre-deploy commands');
        core.endGroup();
    } else {
        core.info('⚙️  Step 5: Run Pre-Deploy Commands - Skipped (no pre_deploy_cmds provided)');
    }

    // Step 6: Switch Active Release
    core.startGroup('🔄 Step 6: Switch Active Release');
    const previousRelease = await getPreviousRelease(inputs.deployRoot);
    const currentJunction = await updateCurrentJunction(inputs.deployRoot, releasePath);
    core.endGroup();

    // Step 7: Health Check
    let healthcheckStatus: string | undefined;
    let healthcheckCode: number | undefined;
    let healthcheckAttempts: number | undefined;

    if (inputs.healthcheckUrl) {
        core.startGroup('🏥 Step 7: Health Check');
        const healthCheck = await performHealthCheck(
            inputs.healthcheckUrl,
            inputs.expectedHealthcheckCodeRange,
            inputs.healthcheckTimeout,
            inputs.healthcheckRetries,
            inputs.healthcheckDelay,
            inputs.healthcheckInterval,
        );

        healthcheckStatus = healthCheck.success ? 'passed' : 'failed';
        healthcheckCode = healthCheck.statusCode;
        healthcheckAttempts = healthCheck.attempts;

        if (!healthCheck.success) {
            core.endGroup();
            throw new Error(`Health check failed: ${healthCheck.error}`);
        }
        core.endGroup();
    } else {
        core.info('🏥 Step 7: Health Check - Skipped (no healthcheck_url provided)');
    }

    // Generate outputs
    const deploymentTime = new Date().toISOString();

    core.startGroup('✅ Deployment Complete');
    core.info(`Release ID: ${releaseId}`);
    core.info(`Release path: ${releasePath}`);
    core.info(`Current junction: ${currentJunction}`);
    if (previousRelease) {
        core.info(`Previous release: ${previousRelease}`);
    }
    core.info(`Deployment time: ${deploymentTime}`);
    if (healthcheckStatus) {
        core.info(
            `Health check: ${healthcheckStatus} (code: ${healthcheckCode}, attempts: ${healthcheckAttempts})`,
        );
    }
    core.endGroup();

    return {
        releasePath,
        releaseId,
        previousRelease,
        deploymentTime,
        healthcheckStatus,
        healthcheckCode,
        healthcheckAttempts,
        currentJunction,
    };
}
