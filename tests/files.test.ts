import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { copyFiles } from '../src/action/utils/files';

describe('File Management Utilities', () => {
    let testDir: string;
    let repoPath: string;
    let releasePath: string;

    beforeEach(async () => {
        testDir = path.join(process.cwd(), 'test-files-' + Date.now());
        repoPath = path.join(testDir, 'repo');
        releasePath = path.join(testDir, 'release');
        await fs.mkdir(repoPath, { recursive: true });
        await fs.mkdir(releasePath, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('copyFiles', () => {
        it('should copy files from repo to release (excluding patterns)', async () => {
            // Create test files
            await fs.writeFile(path.join(repoPath, 'index.js'), 'console.log("hello");');
            await fs.writeFile(path.join(repoPath, 'package.json'), '{}');
            await fs.mkdir(path.join(repoPath, 'src'));
            await fs.writeFile(path.join(repoPath, 'src', 'app.js'), 'export default {};');

            // Create files that should be excluded
            await fs.mkdir(path.join(repoPath, 'node_modules'));
            await fs.writeFile(path.join(repoPath, 'node_modules', 'lib.js'), 'excluded');
            await fs.mkdir(path.join(repoPath, '.git'));
            await fs.writeFile(path.join(repoPath, '.git', 'config'), 'excluded');

            await copyFiles(repoPath, releasePath);

            // Check copied files
            const indexExists = await fs
                .access(path.join(releasePath, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(true);

            const srcAppExists = await fs
                .access(path.join(releasePath, 'src', 'app.js'))
                .then(() => true)
                .catch(() => false);
            expect(srcAppExists).toBe(true);

            // Check excluded files
            const nodeModulesExists = await fs
                .access(path.join(releasePath, 'node_modules'))
                .then(() => true)
                .catch(() => false);
            expect(nodeModulesExists).toBe(false);

            const gitExists = await fs
                .access(path.join(releasePath, '.git'))
                .then(() => true)
                .catch(() => false);
            expect(gitExists).toBe(false);
        });

        it('should copy only dist directory when distDir is specified', async () => {
            // Create repo structure
            await fs.writeFile(path.join(repoPath, 'index.js'), 'source');
            await fs.mkdir(path.join(repoPath, 'src'));
            await fs.writeFile(path.join(repoPath, 'src', 'app.js'), 'source');

            // Create dist directory
            await fs.mkdir(path.join(repoPath, 'dist'));
            await fs.writeFile(path.join(repoPath, 'dist', 'bundle.js'), 'bundled');
            await fs.mkdir(path.join(repoPath, 'dist', 'assets'));
            await fs.writeFile(path.join(repoPath, 'dist', 'assets', 'style.css'), 'css');

            await copyFiles(repoPath, releasePath, 'dist');

            // Check dist files are copied
            const bundleExists = await fs
                .access(path.join(releasePath, 'bundle.js'))
                .then(() => true)
                .catch(() => false);
            expect(bundleExists).toBe(true);

            const cssExists = await fs
                .access(path.join(releasePath, 'assets', 'style.css'))
                .then(() => true)
                .catch(() => false);
            expect(cssExists).toBe(true);

            // Check source files are NOT copied
            const indexExists = await fs
                .access(path.join(releasePath, 'index.js'))
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(false);

            const srcExists = await fs
                .access(path.join(releasePath, 'src'))
                .then(() => true)
                .catch(() => false);
            expect(srcExists).toBe(false);
        });

        it('should throw error if distDir does not exist', async () => {
            await expect(copyFiles(repoPath, releasePath, 'non-existent-dist')).rejects.toThrow(
                'does not exist',
            );
        });

        it('should throw error if distDir is not a directory', async () => {
            await fs.writeFile(path.join(repoPath, 'dist'), 'not a directory');

            await expect(copyFiles(repoPath, releasePath, 'dist')).rejects.toThrow(
                'is not a directory',
            );
        });

        it('should handle nested directory structures', async () => {
            // Create nested structure
            await fs.mkdir(path.join(repoPath, 'a', 'b', 'c'), { recursive: true });
            await fs.writeFile(path.join(repoPath, 'a', 'b', 'c', 'file.txt'), 'nested');

            await copyFiles(repoPath, releasePath);

            const nestedFile = await fs.readFile(
                path.join(releasePath, 'a', 'b', 'c', 'file.txt'),
                'utf-8',
            );
            expect(nestedFile).toBe('nested');
        });

        it('should preserve file contents', async () => {
            const content = 'This is test content with special chars: 你好 🎉';
            await fs.writeFile(path.join(repoPath, 'test.txt'), content);

            await copyFiles(repoPath, releasePath);

            const copiedContent = await fs.readFile(path.join(releasePath, 'test.txt'), 'utf-8');
            expect(copiedContent).toBe(content);
        });

        it('should exclude multiple patterns correctly', async () => {
            // Create files with various exclusion patterns
            await fs.mkdir(path.join(repoPath, 'node_modules'));
            await fs.writeFile(path.join(repoPath, 'node_modules', 'lib.js'), 'excluded');

            await fs.mkdir(path.join(repoPath, '__pycache__'));
            await fs.writeFile(path.join(repoPath, '__pycache__', 'cache.pyc'), 'excluded');

            await fs.mkdir(path.join(repoPath, '.vscode'));
            await fs.writeFile(path.join(repoPath, '.vscode', 'settings.json'), 'excluded');

            await fs.writeFile(path.join(repoPath, 'app.js'), 'included');

            await copyFiles(repoPath, releasePath);

            const appExists = await fs
                .access(path.join(releasePath, 'app.js'))
                .then(() => true)
                .catch(() => false);
            expect(appExists).toBe(true);

            const nodeModulesExists = await fs
                .access(path.join(releasePath, 'node_modules'))
                .then(() => true)
                .catch(() => false);
            expect(nodeModulesExists).toBe(false);

            const pycacheExists = await fs
                .access(path.join(releasePath, '__pycache__'))
                .then(() => true)
                .catch(() => false);
            expect(pycacheExists).toBe(false);

            const vscodeExists = await fs
                .access(path.join(releasePath, '.vscode'))
                .then(() => true)
                .catch(() => false);
            expect(vscodeExists).toBe(false);
        });
    });
});
