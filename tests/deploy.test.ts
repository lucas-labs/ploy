// Mock modules
vi.mock('@actions/core');
vi.mock('@/utils/commands');
vi.mock('@/utils/healthcheck');

import { expect, it, describe, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { ActionInputs } from '@/types';
import { executeCommand, executeCommands } from '@/utils/commands';
import * as health from '@/utils/healthcheck';
import * as core from '@actions/core';
import modes from '@/action/modes';
import steps from '@/action/steps';

describe('Deploy Action', () => {
    let testDir: string;
    let repoPath: string;
    let deployRoot: string;
    let testCounter = 0;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create test directories with unique names to avoid conflicts
        testDir = path.join(process.cwd(), `test-deploy-${Date.now()}-${testCounter++}`);
        repoPath = path.join(testDir, 'repo');
        deployRoot = path.join(testDir, 'deploy');

        await fs.mkdir(repoPath, { recursive: true });
        await fs.mkdir(deployRoot, { recursive: true });

        // Create some test files in repo
        await fs.writeFile(path.join(repoPath, 'index.js'), 'console.log("app");');
        await fs.writeFile(path.join(repoPath, 'package.json'), '{"name": "test-app"}');

        // Mock core functions
        vi.mocked(core.info).mockImplementation(() => {});
        vi.mocked(core.debug).mockImplementation(() => {});
        vi.mocked(core.warning).mockImplementation(() => {});
        vi.mocked(core.error).mockImplementation(() => {});
        vi.mocked(core.startGroup).mockImplementation(() => {});
        vi.mocked(core.endGroup).mockImplementation(() => {});

        // Mock execute command to succeed
        if (executeCommand) {
            vi.mocked(executeCommand).mockResolvedValue(undefined);
        }
        if (executeCommands) {
            vi.mocked(executeCommands).mockResolvedValue(undefined);
        }

        // Mock health check to pass
        vi.mocked(health.check).mockResolvedValue({
            success: true,
            statusCode: 200,
            attempts: 1,
        });

        // Set environment variable for SHA
        process.env.GITHUB_SHA = 'abc1234567890';
    });

    afterEach(async () => {
        try {
            // Small delay to ensure all file operations complete
            await new Promise((resolve) => setTimeout(resolve, 10));
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
        delete process.env.GITHUB_SHA;
        vi.restoreAllMocks();
    });

    const createBasicInputs = (): ActionInputs => ({
        appName: 'test-app',
        deployRoot,
        repoPath,
        mode: 'default',
        expectedHealthcheckCodeRange: '200-299',
        healthcheckTimeout: 30,
        healthcheckRetries: 3,
        healthcheckDelay: 5,
        healthcheckInterval: 5,
        currentJunctionName: 'current',
    });

    describe('basic deployment flow', () => {
        it('should complete a basic deployment without optional steps', async () => {
            const inputs = createBasicInputs();

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.releasePath).toContain('releases');
            expect(outputs.releasePath).toContain('abc1234'.substring(0, 7));
            expect(outputs.releaseId).toMatch(/\d{8}-\d{6}-[a-f0-9]{7}/);
            expect(outputs.currentJunction).toBe(path.join(deployRoot, 'current'));
            expect(outputs.deploymentTime).toBeTruthy();
        });

        it('should create release directory with timestamp and SHA', async () => {
            const inputs = createBasicInputs();

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            const releaseExists = await fs
                .access(outputs.releasePath!)
                .then(() => true)
                .catch(() => false);
            expect(releaseExists).toBe(true);
        });

        it('should copy files to release directory', async () => {
            const inputs = createBasicInputs();

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            const indexExists = await fs
                .access(path.join(outputs.releasePath!, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(true);

            const packageExists = await fs
                .access(path.join(outputs.releasePath!, 'package.json'))
                .then(() => true)
                .catch(() => false);
            expect(packageExists).toBe(true);
        });

        it('should update current junction to new release', async () => {
            const inputs = createBasicInputs();

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            const currentPath = path.join(deployRoot, 'current');
            const target = await fs.readlink(currentPath);

            expect(target).toBe(outputs.releasePath);
        });
    });

    describe('optional steps', () => {
        it('should execute install command when provided', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                installCmds: ['npm install'],
            };

            await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(executeCommands).toHaveBeenCalledWith(
                ['npm install'],
                repoPath,
                'Install dependencies',
            );
        });

        it('should execute multiple install commands when provided', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                installCmds: ['npm ci', 'npm audit fix'],
            };

            await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(executeCommands).toHaveBeenCalledWith(
                ['npm ci', 'npm audit fix'],
                repoPath,
                'Install dependencies',
            );
        });

        it('should execute build command when provided', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                buildCmds: ['npm run build'],
            };

            await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(executeCommands).toHaveBeenCalledWith(
                ['npm run build'],
                repoPath,
                'Build application',
            );
        });

        it('should execute multiple build commands when provided', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                buildCmds: ['npm run lint', 'npm run build', 'npm run test'],
            };

            await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(executeCommands).toHaveBeenCalledWith(
                ['npm run lint', 'npm run build', 'npm run test'],
                repoPath,
                'Build application',
            );
        });

        it('should copy only dist directory when distDir is provided', async () => {
            // Create dist directory
            const distDir = path.join(repoPath, 'dist');
            await fs.mkdir(distDir);
            await fs.writeFile(path.join(distDir, 'bundle.js'), 'bundled code');

            const inputs: ActionInputs = {
                ...createBasicInputs(),
                distDir: 'dist',
            };

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            const bundleExists = await fs
                .access(path.join(outputs.releasePath!, 'bundle.js'))
                .then(() => true)
                .catch(() => false);
            expect(bundleExists).toBe(true);

            // Source files should NOT be copied
            const indexExists = await fs
                .access(path.join(outputs.releasePath!, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(false);
        });

        it('should execute pre-deploy commands in release directory', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                preDeployCmds: ['echo "pre-deploy"', 'echo "setup"'],
            };

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(executeCommands).toHaveBeenCalledWith(
                ['echo "pre-deploy"', 'echo "setup"'],
                outputs.releasePath!,
                'Pre-deploy commands',
            );
        });

        it('should perform health check when URL is provided', async () => {
            const inputs: ActionInputs = {
                ...createBasicInputs(),
                healthcheckUrl: 'http://localhost:3000/health',
            };

            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(health.check).toHaveBeenCalledWith(
                'http://localhost:3000/health',
                '200-299',
                30,
                3,
                5,
                5,
            );

            expect(outputs.healthcheckStatus).toBe('passed');
            expect(outputs.healthcheckCode).toBe(200);
            expect(outputs.healthcheckAttempts).toBe(1);
        });

        it('should throw error if health check fails', async () => {
            if (health.check) {
                vi.mocked(health.check).mockResolvedValue({
                    success: false,
                    statusCode: 500,
                    attempts: 3,
                    error: 'Server error',
                });
            }

            const inputs: ActionInputs = {
                ...createBasicInputs(),
                healthcheckUrl: 'http://localhost:3000/health',
            };

            await expect(steps.execute(modes.get(inputs.mode).steps, inputs)).rejects.toThrow(
                'Health check failed',
            );
        });
    });

    describe('previous release tracking', () => {
        it('should track previous release if it exists', async () => {
            // Create a previous deployment
            const oldRelease = path.join(deployRoot, 'releases', 'old-release');
            await fs.mkdir(oldRelease, { recursive: true });
            const currentPath = path.join(deployRoot, 'current');
            await fs.symlink(oldRelease, currentPath, 'junction');

            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.previousRelease).toBe(oldRelease);
        });

        it('should have undefined previousRelease for first deployment', async () => {
            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.previousRelease).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should fail if install command fails', async () => {
            if (executeCommands) {
                vi.mocked(executeCommands).mockRejectedValue(new Error('Install failed'));
            }

            const inputs: ActionInputs = {
                ...createBasicInputs(),
                installCmds: ['npm install'],
            };

            await expect(steps.execute(modes.get(inputs.mode).steps, inputs)).rejects.toThrow(
                'Install failed',
            );
        });

        it('should fail if build command fails', async () => {
            if (executeCommands) {
                vi.mocked(executeCommands).mockRejectedValue(new Error('Build failed'));
            }

            const inputs: ActionInputs = {
                ...createBasicInputs(),
                buildCmds: ['npm run build'],
            };

            await expect(steps.execute(modes.get(inputs.mode).steps, inputs)).rejects.toThrow(
                'Build failed',
            );
        });

        it('should fail if pre-deploy commands fail', async () => {
            if (executeCommands) {
                vi.mocked(executeCommands).mockRejectedValue(new Error('Pre-deploy failed'));
            }

            const inputs: ActionInputs = {
                ...createBasicInputs(),
                preDeployCmds: ['failing-command'],
            };

            await expect(steps.execute(modes.get(inputs.mode).steps, inputs)).rejects.toThrow(
                'Pre-deploy failed',
            );
        });
    });

    describe('timestamp and SHA generation', () => {
        it('should generate timestamp in correct format', async () => {
            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.releaseId).toMatch(/^\d{8}-\d{6}-[a-f0-9]{7}$/);
        });

        it('should use GITHUB_SHA environment variable', async () => {
            process.env.GITHUB_SHA = 'deadbeef1234567890';

            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.releaseId).toContain('deadbee');
        });

        it('should use GITEA_SHA if GITHUB_SHA is not available', async () => {
            delete process.env.GITHUB_SHA;
            process.env.GITEA_SHA = 'cafebabe1234567890';

            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.releaseId).toContain('cafebab');

            delete process.env.GITEA_SHA;
        });

        it('should use "unknown" if no SHA is available', async () => {
            delete process.env.GITHUB_SHA;
            delete process.env.GITEA_SHA;
            delete process.env.CI_COMMIT_SHA;

            const inputs = createBasicInputs();
            const outputs = await steps.execute(modes.get(inputs.mode).steps, inputs);

            expect(outputs.releaseId).toContain('unknown');
        });
    });
});
