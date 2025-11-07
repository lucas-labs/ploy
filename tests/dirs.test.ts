import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
    ensureDeployRoot,
    validateDirectory,
    createReleaseDirectory,
    getPreviousRelease,
} from '@/utils/dirs';

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

    describe('validateDirectory', () => {
        it('should not throw for valid directory', async () => {
            await fs.mkdir(testDir);

            await expect(validateDirectory(testDir, 'Test Directory')).resolves.not.toThrow();
        });

        it('should throw for non-existent directory', async () => {
            await expect(validateDirectory(testDir, 'Test Directory')).rejects.toThrow(
                'does not exist',
            );
        });

        it('should throw if path exists but is not a directory', async () => {
            await fs.mkdir(path.dirname(testDir), { recursive: true });
            await fs.writeFile(testDir, 'test');

            await expect(validateDirectory(testDir, 'Test Directory')).rejects.toThrow(
                'is not a directory',
            );
        });
    });

    describe('createReleaseDirectory', () => {
        it('should create a release directory with correct naming', async () => {
            await fs.mkdir(path.join(testDir, 'releases'), { recursive: true });

            const timestamp = '20250104-143052';
            const shortSha = 'a1b2c3d';

            const releasePath = await createReleaseDirectory(testDir, timestamp, shortSha);

            expect(releasePath).toContain('20250104-143052-a1b2c3d');
            expect(releasePath).toContain(path.join('releases', '20250104-143052-a1b2c3d'));

            const stats = await fs.stat(releasePath);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create parent directories if they do not exist', async () => {
            const timestamp = '20250104-143052';
            const shortSha = 'a1b2c3d';

            const releasePath = await createReleaseDirectory(testDir, timestamp, shortSha);

            const stats = await fs.stat(releasePath);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('getPreviousRelease', () => {
        it('should return undefined if no current junction exists', async () => {
            await fs.mkdir(testDir, { recursive: true });

            const previousRelease = await getPreviousRelease(testDir);
            expect(previousRelease).toBeUndefined();
        });

        it('should return the target of current junction if it exists', async () => {
            await fs.mkdir(testDir, { recursive: true });
            const targetDir = path.join(testDir, 'releases', 'release-1');
            await fs.mkdir(targetDir, { recursive: true });

            const currentPath = path.join(testDir, 'current');
            await fs.symlink(targetDir, currentPath, 'junction');

            const previousRelease = await getPreviousRelease(testDir);
            expect(previousRelease).toBe(targetDir);
        });

        it('should handle non-junction file in current path gracefully', async () => {
            await fs.mkdir(testDir, { recursive: true });
            const currentPath = path.join(testDir, 'current');
            await fs.writeFile(currentPath, 'not a junction');

            const previousRelease = await getPreviousRelease(testDir);
            expect(previousRelease).toBeUndefined();
        });
    });
});
