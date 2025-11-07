// Mock child_process - use factory function to avoid hoisting issues
vi.mock('child_process', () => {
    const mockFn = vi.fn((command, options, callback) => {
        // Default: successful execution
        if (typeof callback === 'function') {
            setImmediate(() => callback(null, '', ''));
        }
        return {} as ChildProcess;
    });
    return { exec: mockFn };
});

import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { executeCommand, executeCommands } from '@/utils/commands';
import { exec } from 'child_process';
import type { ChildProcess } from 'child_process';

describe('Command Execution Utilities', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(process.cwd(), 'test-commands-' + Date.now());
        await fs.mkdir(testDir, { recursive: true });

        // Reset mocks
        vi.mocked(exec).mockClear();
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('executeCommand', () => {
        it('should execute a simple command successfully', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    setImmediate(() => callback(null, 'test output', ''));
                }
                return {} as ChildProcess;
            });

            await expect(
                executeCommand('echo "test"', testDir, 'Test echo'),
            ).resolves.not.toThrow();

            expect(vi.mocked(exec)).toHaveBeenCalledWith(
                'echo "test"',
                expect.objectContaining({
                    cwd: testDir,
                }),
                expect.any(Function),
            );
        });

        it('should execute command in specified working directory', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    setImmediate(() => callback(null, testDir, ''));
                }
                return {} as ChildProcess;
            });

            await executeCommand('pwd', testDir, 'Write working directory');

            expect(vi.mocked(exec)).toHaveBeenCalledWith(
                'pwd',
                expect.objectContaining({
                    cwd: testDir,
                }),
                expect.any(Function),
            );
        });

        it('should throw error for invalid command', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    const error = Object.assign(new Error('command not found'), {
                        code: 127,
                        stderr: 'command not found',
                    });
                    setImmediate(() => callback(error, '', 'command not found'));
                }
                return {} as ChildProcess;
            });

            await expect(
                executeCommand('this-command-does-not-exist-xyz123', testDir, 'Invalid command'),
            ).rejects.toThrow();
        });

        it('should throw error for command with non-zero exit code', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    const error = Object.assign(new Error('Command failed'), {
                        code: 1,
                        stderr: 'error',
                    });
                    setImmediate(() => callback(error, '', 'error'));
                }
                return {} as ChildProcess;
            });

            await expect(executeCommand('exit 1', testDir, 'Failing command')).rejects.toThrow(
                'Command failed',
            );
        });
    });

    describe('executeCommands', () => {
        it('should execute multiple commands sequentially', async () => {
            let callCount = 0;
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    callCount++;
                    setImmediate(() => callback(null, `output ${callCount}`, ''));
                }
                return {} as ChildProcess;
            });

            const commands = ['command1', 'command2'];

            await executeCommands(commands, testDir, 'Test commands');

            expect(vi.mocked(exec)).toHaveBeenCalledTimes(2);
        });

        it('should stop execution on first failure', async () => {
            let callCount = 0;
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    callCount++;
                    if (callCount === 2) {
                        const error = Object.assign(new Error('Command failed'), {
                            code: 1,
                            stderr: 'command failed',
                        });
                        setImmediate(() => callback(error, '', 'command failed'));
                    } else {
                        setImmediate(() => callback(null, 'success', ''));
                    }
                }
                return {} as ChildProcess;
            });

            const commands = ['command1', 'this-command-will-fail', 'command3'];

            await expect(executeCommands(commands, testDir, 'Test commands')).rejects.toThrow();

            // Only first two commands should be executed
            expect(vi.mocked(exec)).toHaveBeenCalledTimes(2);
        });

        it('should handle empty command array', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    setImmediate(() => callback(null, '', ''));
                }
                return {} as ChildProcess;
            });

            await expect(executeCommands([], testDir, 'No commands')).resolves.not.toThrow();

            expect(vi.mocked(exec)).not.toHaveBeenCalled();
        });

        it('should execute commands with dependencies', async () => {
            const content = 'hello world';
            let callCount = 0;
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof callback === 'function') {
                    callCount++;
                    if (callCount === 1) {
                        setImmediate(() => callback(null, 'file created', ''));
                    } else {
                        setImmediate(() => callback(null, content, ''));
                    }
                }
                return {} as ChildProcess;
            });

            const commands = ['write to file', 'read from file'];

            await expect(
                executeCommands(commands, testDir, 'Dependent commands'),
            ).resolves.not.toThrow();

            expect(vi.mocked(exec)).toHaveBeenCalledTimes(2);
        });
    });
});
