vi.mock('@actions/core', async () => {
    const actual = await vi.importActual<typeof core>('@actions/core');
    return {
        ...actual,
        getInput: vi.fn(),
        setOutput: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        startGroup: vi.fn(),
        endGroup: vi.fn(),
        setFailed: vi.fn(),
    };
});

import * as core from '@actions/core';
import { promises as fs } from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '@/action/run';

describe('Integration Tests', () => {
    let testDir: string;
    let repoPath: string;
    let deployRoot: string;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create test directories
        testDir = path.join(process.cwd(), `test-integration-${Date.now()}`);
        repoPath = path.join(testDir, 'repo');
        deployRoot = path.join(testDir, 'deploy');

        await fs.mkdir(repoPath, { recursive: true });
        await fs.mkdir(deployRoot, { recursive: true });

        // Create a sample application structure
        await fs.writeFile(path.join(repoPath, 'index.js'), 'console.log("Hello World");');
        await fs.writeFile(
            path.join(repoPath, 'package.json'),
            JSON.stringify({ name: 'test-app', version: '1.0.0' }),
        );
        await fs.mkdir(path.join(repoPath, 'src'));
        await fs.writeFile(path.join(repoPath, 'src', 'app.js'), 'export default {}');
        await fs.writeFile(path.join(repoPath, 'README.md'), '# Test App');

        // Create files that should be excluded
        await fs.mkdir(path.join(repoPath, 'node_modules'));
        await fs.writeFile(path.join(repoPath, 'node_modules', 'lib.js'), 'excluded');

        // Set environment variable for SHA
        process.env.GITHUB_SHA = 'abc1234567890def';
    });

    afterEach(async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 50));
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
        delete process.env.GITHUB_SHA;
        vi.restoreAllMocks();
    });

    describe('End-to-End Deployment Flow', () => {
        it('should complete a full deployment without optional steps', async () => {
            // Setup inputs
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            // Verify deploy root structure was created
            const deployRootExists = await fs
                .access(deployRoot)
                .then(() => true)
                .catch(() => false);
            expect(deployRootExists).toBe(true);

            const releasesDir = path.join(deployRoot, 'releases');
            const releasesDirExists = await fs
                .access(releasesDir)
                .then(() => true)
                .catch(() => false);
            expect(releasesDirExists).toBe(true);

            // Verify current junction was created
            const currentJunction = path.join(deployRoot, 'current');
            const currentExists = await fs
                .access(currentJunction)
                .then(() => true)
                .catch(() => false);
            expect(currentExists).toBe(true);

            // Verify junction points to a release
            const target = await fs.readlink(currentJunction);
            expect(target).toContain('releases');
            expect(target).toContain('abc1234'.substring(0, 7));

            // Verify files were copied
            const indexExists = await fs
                .access(path.join(target, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(true);

            const srcAppExists = await fs
                .access(path.join(target, 'src', 'app.js'))
                .then(() => true)
                .catch(() => false);
            expect(srcAppExists).toBe(true);

            // Verify excluded files were not copied
            const nodeModulesExists = await fs
                .access(path.join(target, 'node_modules'))
                .then(() => true)
                .catch(() => false);
            expect(nodeModulesExists).toBe(false);

            // Verify outputs were set
            expect(core.setOutput).toHaveBeenCalledWith(
                'release_path',
                expect.stringContaining('releases'),
            );
            expect(core.setOutput).toHaveBeenCalledWith(
                'release_id',
                expect.stringMatching(/\d{8}-\d{6}-[a-f0-9]{7}/),
            );
            expect(core.setOutput).toHaveBeenCalledWith('deployment_time', expect.any(String));
            expect(core.setOutput).toHaveBeenCalledWith('current_junction', currentJunction);
        });

        it('should deploy with dist_dir specified', async () => {
            // Create dist directory
            const distDir = path.join(repoPath, 'dist');
            await fs.mkdir(distDir);
            await fs.writeFile(path.join(distDir, 'bundle.js'), 'bundled code');
            await fs.writeFile(path.join(distDir, 'bundle.css'), 'bundled styles');

            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
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

            const currentJunction = path.join(deployRoot, 'current');
            const target = await fs.readlink(currentJunction);

            // Verify dist files were copied
            const bundleJsExists = await fs
                .access(path.join(target, 'bundle.js'))
                .then(() => true)
                .catch(() => false);
            expect(bundleJsExists).toBe(true);

            // Verify source files were NOT copied
            const indexExists = await fs
                .access(path.join(target, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(false);
        });

        it('should handle multiple deployments with release tracking', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            // First deployment
            await run();
            const firstTarget = await fs.readlink(path.join(deployRoot, 'current'));

            // Wait enough time to ensure different timestamp (at least 1 second for YYYYMMDD-HHMMSS format)
            await new Promise((resolve) => setTimeout(resolve, 1100));

            // Update file content to simulate a change
            await fs.writeFile(path.join(repoPath, 'index.js'), 'console.log("Hello World v2");');

            // Clear mocks for second deployment
            vi.clearAllMocks();
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            // Second deployment
            await run();
            const secondTarget = await fs.readlink(path.join(deployRoot, 'current'));

            // Verify different releases
            expect(firstTarget).not.toBe(secondTarget);

            // Verify both releases still exist
            const firstExists = await fs
                .access(firstTarget)
                .then(() => true)
                .catch(() => false);
            expect(firstExists).toBe(true);

            const secondExists = await fs
                .access(secondTarget)
                .then(() => true)
                .catch(() => false);
            expect(secondExists).toBe(true);

            // Verify previous_release output was set
            expect(core.setOutput).toHaveBeenCalledWith('previous_release', firstTarget);
        });

        it('should fail gracefully if dist_dir does not exist', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    dist_dir: 'non-existent-dist',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await expect(run()).rejects.toThrow('does not exist');
        });

        it('should fail if pre_deploy_cmds is invalid JSON', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    pre_deploy_cmds: '["unclosed array',
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
    });

    describe('Real Command Execution', () => {
        it('should execute real install and build commands', async () => {
            // Create a simple package.json with a test script
            await fs.writeFile(
                path.join(repoPath, 'package.json'),
                JSON.stringify({
                    name: 'test-app',
                    scripts: {
                        build: 'node -e "console.log(\'Building...\')"',
                    },
                }),
            );

            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    // Use simple echo commands that work cross-platform
                    install_cmd:
                        process.platform === 'win32' ? 'echo Installing' : 'echo "Installing"',
                    build_cmd: process.platform === 'win32' ? 'echo Building' : 'echo "Building"',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await expect(run()).resolves.not.toThrow();

            // Verify deployment completed
            expect(core.info).toHaveBeenCalledWith('🎉 Deployment completed successfully!');
        });

        it('should fail if install command fails', async () => {
            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    install_cmds: 'this-command-does-not-exist-xyz123',
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await expect(run()).rejects.toThrow();
        });
    });

    describe('File System Operations', () => {
        it('should preserve file contents during copy', async () => {
            const content = 'This is a test file with special characters: 你好 🎉 \n\r\t';
            await fs.writeFile(path.join(repoPath, 'special.txt'), content);

            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            const currentJunction = path.join(deployRoot, 'current');
            const target = await fs.readlink(currentJunction);
            const copiedContent = await fs.readFile(path.join(target, 'special.txt'), 'utf-8');

            expect(copiedContent).toBe(content);
        });

        it('should handle nested directory structures', async () => {
            // Create deep nested structure
            await fs.mkdir(path.join(repoPath, 'a', 'b', 'c', 'd'), { recursive: true });
            await fs.writeFile(path.join(repoPath, 'a', 'b', 'c', 'd', 'deep.txt'), 'deep file');

            vi.mocked(core.getInput).mockImplementation((name: string) => {
                const inputs: Record<string, string> = {
                    app_name: 'test-app',
                    deploy_root: deployRoot,
                    repo_path: repoPath,
                    expected_healthcheck_code_range: '200-299',
                    healthcheck_timeout: '30',
                    healthcheck_retries: '3',
                    healthcheck_delay: '5',
                    healthcheck_interval: '5',
                };
                return inputs[name] || '';
            });

            await run();

            const currentJunction = path.join(deployRoot, 'current');
            const target = await fs.readlink(currentJunction);
            const deepFile = await fs.readFile(
                path.join(target, 'a', 'b', 'c', 'd', 'deep.txt'),
                'utf-8',
            );

            expect(deepFile).toBe('deep file');
        });
    });
});
