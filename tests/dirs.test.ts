import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ensureDeployRoot } from '@/action/steps/common/env-setup.step';
import { createReleaseDirectory } from '@/action/steps/common/prepare-release-dir.step';

describe('Directory Management Utilities', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join(process.cwd(), 'test-dirs-' + Date.now());
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('ensureDeployRoot', () => {
        it('should create deploy root and releases subdirectory', async () => {
            await ensureDeployRoot(testDir);

            // Verify directories exist
            const deployRootStats = await fs.stat(testDir);
            expect(deployRootStats.isDirectory()).toBe(true);

            const releasesDir = path.join(testDir, 'releases');
            const releasesStats = await fs.stat(releasesDir);
            expect(releasesStats.isDirectory()).toBe(true);
        });

        it('should handle existing deploy root directory', async () => {
            await fs.mkdir(testDir, { recursive: true });
            await ensureDeployRoot(testDir);

            const deployRootStats = await fs.stat(testDir);
            expect(deployRootStats.isDirectory()).toBe(true);
        });

        it('should throw error if deploy root exists but is not a directory', async () => {
            // Create a file instead of directory
            await fs.mkdir(path.dirname(testDir), { recursive: true });
            await fs.writeFile(testDir, 'test');

            await expect(ensureDeployRoot(testDir)).rejects.toThrow('is not a directory');
        });

        it('should verify write permissions', async () => {
            await ensureDeployRoot(testDir);

            // Should be able to write files
            const testFile = path.join(testDir, 'test.txt');
            await fs.writeFile(testFile, 'test');
            const content = await fs.readFile(testFile, 'utf-8');
            expect(content).toBe('test');
        });
    });

    describe('createReleaseDirectory', () => {
        it('should create a release directory with correct naming', async () => {
            await fs.mkdir(path.join(testDir, 'releases'), { recursive: true });

            const timestamp = '20250104-143052';
            const shortSha = 'a1b2c3d';
            const releaseId = `${timestamp}-${shortSha}`;

            const releasePath = await createReleaseDirectory(testDir, releaseId);

            expect(releasePath).toContain('20250104-143052-a1b2c3d');
            expect(releasePath).toContain(path.join('releases', '20250104-143052-a1b2c3d'));

            const stats = await fs.stat(releasePath);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create parent directories if they do not exist', async () => {
            const timestamp = '20250104-143052';
            const shortSha = 'a1b2c3d';
            const releaseId = `${timestamp}-${shortSha}`;

            const releasePath = await createReleaseDirectory(testDir, releaseId);

            const stats = await fs.stat(releasePath);
            expect(stats.isDirectory()).toBe(true);
        });
    });
});
