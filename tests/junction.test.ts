import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
    isJunction,
    createJunction,
    removeJunction,
    updateCurrentJunction,
} from '@/utils/junction';

describe('Junction Management Utilities', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(process.cwd(), 'test-junction-' + Date.now());
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('isJunction', () => {
        it('should return false for non-existent path', async () => {
            const result = await isJunction(path.join(testDir, 'non-existent'));
            expect(result).toBe(false);
        });

        it('should return false for regular directory', async () => {
            const regularDir = path.join(testDir, 'regular-dir');
            await fs.mkdir(regularDir);

            const result = await isJunction(regularDir);
            expect(result).toBe(false);
        });

        it('should return false for regular file', async () => {
            const regularFile = path.join(testDir, 'regular-file.txt');
            await fs.writeFile(regularFile, 'test');

            const result = await isJunction(regularFile);
            expect(result).toBe(false);
        });

        it('should return true for junction/symlink', async () => {
            const targetDir = path.join(testDir, 'target');
            await fs.mkdir(targetDir);

            const junctionPath = path.join(testDir, 'junction');
            await fs.symlink(targetDir, junctionPath, 'junction');

            const result = await isJunction(junctionPath);
            expect(result).toBe(true);
        });
    });

    describe('createJunction', () => {
        it('should create a junction successfully', async () => {
            const targetDir = path.join(testDir, 'target');
            await fs.mkdir(targetDir);

            const junctionPath = path.join(testDir, 'junction');
            await createJunction(junctionPath, targetDir);

            const exists = await fs
                .access(junctionPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);

            const isJunc = await isJunction(junctionPath);
            expect(isJunc).toBe(true);
        });

        it('should fail if junction path already exists', async () => {
            const targetDir = path.join(testDir, 'target');
            await fs.mkdir(targetDir);

            const junctionPath = path.join(testDir, 'junction');
            await createJunction(junctionPath, targetDir);

            await expect(createJunction(junctionPath, targetDir)).rejects.toThrow();
        });
    });

    describe('removeJunction', () => {
        it('should remove a junction successfully', async () => {
            const targetDir = path.join(testDir, 'target');
            await fs.mkdir(targetDir);

            const junctionPath = path.join(testDir, 'junction');
            await fs.symlink(targetDir, junctionPath, 'junction');

            await removeJunction(junctionPath);

            const exists = await fs
                .access(junctionPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);

            // Target should still exist
            const targetExists = await fs
                .access(targetDir)
                .then(() => true)
                .catch(() => false);
            expect(targetExists).toBe(true);
        });

        it('should not throw if junction does not exist', async () => {
            const junctionPath = path.join(testDir, 'non-existent-junction');

            await expect(removeJunction(junctionPath)).resolves.toBeUndefined();
        });

        it('should not delete the target directory', async () => {
            const targetDir = path.join(testDir, 'target');
            await fs.mkdir(targetDir);
            await fs.writeFile(path.join(targetDir, 'test.txt'), 'content');

            const junctionPath = path.join(testDir, 'junction');
            await fs.symlink(targetDir, junctionPath, 'junction');

            await removeJunction(junctionPath);

            // Target directory and its contents should still exist
            const fileContent = await fs.readFile(path.join(targetDir, 'test.txt'), 'utf-8');
            expect(fileContent).toBe('content');
        });
    });

    describe('updateCurrentJunction', () => {
        it('should create new junction if current does not exist', async () => {
            const newRelease = path.join(testDir, 'releases', 'release-1');
            await fs.mkdir(newRelease, { recursive: true });

            const currentPath = await updateCurrentJunction(testDir, newRelease);

            expect(currentPath).toBe(path.join(testDir, 'current'));

            const isJunc = await isJunction(currentPath);
            expect(isJunc).toBe(true);

            const target = await fs.readlink(currentPath);
            // Normalize path to handle Windows trailing backslash
            const normalizedTarget = target.replace(/[\\]+$/, '');
            expect(normalizedTarget).toBe(newRelease);
        });

        it('should update existing junction to new release', async () => {
            const oldRelease = path.join(testDir, 'releases', 'release-1');
            const newRelease = path.join(testDir, 'releases', 'release-2');
            await fs.mkdir(oldRelease, { recursive: true });
            await fs.mkdir(newRelease, { recursive: true });

            const currentPath = path.join(testDir, 'current');
            await fs.symlink(oldRelease, currentPath, 'junction');

            await updateCurrentJunction(testDir, newRelease);

            const target = await fs.readlink(currentPath);
            // Normalize path to handle Windows trailing backslash
            const normalizedTarget = target.replace(/[\\]+$/, '');
            expect(normalizedTarget).toBe(newRelease);
        });

        it('should throw error if current exists but is not a junction', async () => {
            const currentPath = path.join(testDir, 'current');
            await fs.mkdir(currentPath); // Create as regular directory

            const newRelease = path.join(testDir, 'releases', 'release-1');
            await fs.mkdir(newRelease, { recursive: true });

            await expect(updateCurrentJunction(testDir, newRelease)).rejects.toThrow(
                'is not a junction',
            );
        });

        it('should preserve old release directory after update', async () => {
            const oldRelease = path.join(testDir, 'releases', 'release-1');
            const newRelease = path.join(testDir, 'releases', 'release-2');
            await fs.mkdir(oldRelease, { recursive: true });
            await fs.mkdir(newRelease, { recursive: true });
            await fs.writeFile(path.join(oldRelease, 'old.txt'), 'old content');

            const currentPath = path.join(testDir, 'current');
            await fs.symlink(oldRelease, currentPath, 'junction');

            await updateCurrentJunction(testDir, newRelease);

            // Old release should still exist
            const oldContent = await fs.readFile(path.join(oldRelease, 'old.txt'), 'utf-8');
            expect(oldContent).toBe('old content');
        });
    });
});
