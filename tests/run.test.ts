// Mock the dependencies
vi.mock('@actions/core');
vi.mock('@/action/subactions/deploy/action');

import { expect, it, describe, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { deployAction } from '@/action/subactions/deploy/action';
import { run } from '@/action/run';

describe('Action Run Function', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Set up default mock implementations
        vi.mocked(core.getInput).mockImplementation((name: string, options?: core.InputOptions) => {
            const defaults: Record<string, string> = {
                app_name: 'test-app',
                deploy_root: '/deploy',
                repo_path: '/repo',
                install_cmd: '',
                build_cmd: '',
                dist_dir: '',
                pre_deploy_cmds: '',
                healthcheck_url: '',
                expected_healthcheck_code_range: '200-299',
                healthcheck_timeout: '30',
                healthcheck_retries: '3',
                healthcheck_delay: '5',
                healthcheck_interval: '5',
            };

            if (options?.required && !defaults[name]) {
                throw new Error(`Input required and not supplied: ${name}`);
            }

            return defaults[name] || '';
        });

        if (deployAction) {
            vi.mocked(deployAction).mockResolvedValue({
                releasePath: '/deploy/releases/20250104-143052-abc1234',
                releaseId: '20250104-143052-abc1234',
                deploymentTime: '2025-01-04T14:30:52.000Z',
                currentJunction: '/deploy/current',
            });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getInputs parsing', () => {
        it('should parse required inputs correctly', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/var/www/deploy',
                    repo_path: '/home/user/repo',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            expect(deployAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    appName: 'my-app',
                    deployRoot: '/var/www/deploy',
                    repoPath: '/home/user/repo',
                }),
            );
        });

        it('should use process.cwd() as default repo_path', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/var/www/deploy',
                    repo_path: '', // Empty
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            expect(deployAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    repoPath: process.cwd(),
                }),
            );
        });

        it('should parse optional inputs', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/deploy',
                    repo_path: '/repo',
                    install_cmds: 'npm install',
                    build_cmds: 'npm run build',
                    dist_dir: 'dist',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            expect(deployAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    installCmds: ['npm install'],
                    buildCmds: ['npm run build'],
                    distDir: 'dist',
                }),
            );
        });

        it('should parse pre_deploy_cmds JSON array', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/deploy',
                    repo_path: '/repo',
                    pre_deploy_cmds: '["npm install", "npm test"]',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            expect(deployAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    preDeployCmds: ['npm install', 'npm test'],
                }),
            );
        });

        it('should throw error for invalid pre_deploy_cmds JSON', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/deploy',
                    repo_path: '/repo',
                    pre_deploy_cmds: '{"invalid": "json object"}',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await expect(run()).rejects.toThrow('Failed to parse pre_deploy_cmds');
        });

        it('should throw error if pre_deploy_cmds is not an array', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/deploy',
                    repo_path: '/repo',
                    pre_deploy_cmds: '{"key": "value"}',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await expect(run()).rejects.toThrow('must be a JSON array');
        });

        it('should parse health check inputs', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'my-app',
                    deploy_root: '/deploy',
                    repo_path: '/repo',
                    healthcheck_url: 'http://localhost:3000/health',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '60',
                    healthcheck_retries: '5',
                    healthcheck_delay: '10',
                    healthcheck_interval: '15',
                };
                return inputs[name] || '';
            });

            await run();

            expect(deployAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    healthcheckUrl: 'http://localhost:3000/health',
                    expectedHealthcheckCodeRange: '200-299',
                    healthcheckTimeout: 60,
                    healthcheckRetries: 5,
                    healthcheckDelay: 10,
                    healthcheckInterval: 15,
                }),
            );
        });
    });

    describe('setOutputs', () => {
        it('should set required outputs', async () => {
            await run();

            expect(core.setOutput).toHaveBeenCalledWith(
                'release_path',
                '/deploy/releases/20250104-143052-abc1234',
            );
            expect(core.setOutput).toHaveBeenCalledWith('release_id', '20250104-143052-abc1234');
            expect(core.setOutput).toHaveBeenCalledWith(
                'deployment_time',
                '2025-01-04T14:30:52.000Z',
            );
            expect(core.setOutput).toHaveBeenCalledWith('current_junction', '/deploy/current');
        });

        it('should set optional outputs when present', async () => {
            if (deployAction) {
                vi.mocked(deployAction).mockResolvedValue({
                    releasePath: '/deploy/releases/20250104-143052-abc1234',
                    releaseId: '20250104-143052-abc1234',
                    deploymentTime: '2025-01-04T14:30:52.000Z',
                    currentJunction: '/deploy/current',
                    previousRelease: '/deploy/releases/20250103-120000-xyz9876',
                    healthcheckStatus: 'passed',
                    healthcheckCode: 200,
                    healthcheckAttempts: 1,
                });
            }

            await run();

            expect(core.setOutput).toHaveBeenCalledWith(
                'previous_release',
                '/deploy/releases/20250103-120000-xyz9876',
            );
            expect(core.setOutput).toHaveBeenCalledWith('healthcheck_status', 'passed');
            expect(core.setOutput).toHaveBeenCalledWith('healthcheck_code', '200');
            expect(core.setOutput).toHaveBeenCalledWith('healthcheck_attempts', '1');
        });

        it('should not set optional outputs when not present', async () => {
            await run();

            const allCalls = vi.mocked(core.setOutput).mock.calls;
            const optionalOutputs = allCalls.filter(
                (call) =>
                    call[0] === 'previous_release' ||
                    call[0] === 'healthcheck_status' ||
                    call[0] === 'healthcheck_code' ||
                    call[0] === 'healthcheck_attempts',
            );

            expect(optionalOutputs).toHaveLength(0);
        });
    });

    describe('integration', () => {
        it('should call deployAction with parsed inputs and set outputs', async () => {
            await run();

            expect(deployAction).toHaveBeenCalledTimes(1);
            expect(core.setOutput).toHaveBeenCalledTimes(4); // 4 required outputs
            expect(core.info).toHaveBeenCalledWith('🎉 Deployment completed successfully!');
        });

        it('should propagate errors from deployAction', async () => {
            if (deployAction) {
                vi.mocked(deployAction).mockRejectedValue(new Error('Deployment failed'));
            }

            await expect(run()).rejects.toThrow('Deployment failed');
        });
    });
});
