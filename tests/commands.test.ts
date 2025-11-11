// Mock child_process - use factory function to avoid hoisting issues
vi.mock('child_process', () => {
    const mockFn = vi.fn((command, options, callback) => {
        // Handle both callback style and promisified style
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

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

        // Reset mocks and set up default behavior
        vi.mocked(exec).mockClear();

        // Default mock: handles PowerShell detection + actual commands
        vi.mocked(exec).mockImplementation((command, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }

            // PowerShell detection calls - always succeed for tests
            if (
                typeof command === 'string' &&
                (command.includes('pwsh.exe -Command "exit 0"') ||
                    command.includes('powershell.exe -Command "exit 0"'))
            ) {
                if (typeof callback === 'function') {
                    setImmediate(() => callback(null, '', ''));
                }
            } else {
                // Regular command execution - default success
                if (typeof callback === 'function') {
                    setImmediate(() => callback(null, '', ''));
                }
            }

            return {} as ChildProcess;
        });
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
            await expect(
                executeCommand('echo "test"', testDir, 'Test echo'),
            ).resolves.not.toThrow();

            // Should be called: once for detection, once for actual command
            expect(vi.mocked(exec)).toHaveBeenCalled();
        });

        it('should execute command in specified working directory', async () => {
            await executeCommand('pwd', testDir, 'Write working directory');

            expect(vi.mocked(exec)).toHaveBeenCalled();
        });

        it('should throw error for invalid command', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof options === 'function') {
                    callback = options;
                }

                // PowerShell detection - succeed
                if (typeof command === 'string' && command.includes('exit 0')) {
                    if (typeof callback === 'function') {
                        setImmediate(() => callback(null, '', ''));
                    }
                } else {
                    // Actual command - fail
                    if (typeof callback === 'function') {
                        const error = Object.assign(new Error('command not found'), {
                            code: 127,
                            stderr: 'command not found',
                        });
                        setImmediate(() => callback(error, '', 'command not found'));
                    }
                }
                return {} as ChildProcess;
            });

            await expect(
                executeCommand('this-command-does-not-exist-xyz123', testDir, 'Invalid command'),
            ).rejects.toThrow();
        });

        it('should throw error for command with non-zero exit code', async () => {
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof options === 'function') {
                    callback = options;
                }

                // PowerShell detection - succeed
                if (typeof command === 'string' && command.includes('exit 0')) {
                    if (typeof callback === 'function') {
                        setImmediate(() => callback(null, '', ''));
                    }
                } else {
                    // Actual command - fail
                    if (typeof callback === 'function') {
                        const error = Object.assign(new Error('Command failed'), {
                            code: 1,
                            stderr: 'error',
                        });
                        setImmediate(() => callback(error, '', 'error'));
                    }
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
            const commands = ['command1', 'command2'];

            await executeCommands(commands, testDir, 'Test commands');

            // Detection call happens once (cached), then 2 command calls
            expect(vi.mocked(exec).mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('should stop execution on first failure', async () => {
            let actualCommandCount = 0;
            vi.mocked(exec).mockImplementation((command, options, callback) => {
                if (typeof options === 'function') {
                    callback = options;
                }

                // PowerShell detection - succeed
                if (typeof command === 'string' && command.includes('exit 0')) {
                    if (typeof callback === 'function') {
                        setImmediate(() => callback(null, '', ''));
                    }
                } else {
                    // Actual commands
                    actualCommandCount++;
                    if (actualCommandCount === 2) {
                        if (typeof callback === 'function') {
                            const error = Object.assign(new Error('Command failed'), {
                                code: 1,
                                stderr: 'command failed',
                            });
                            setImmediate(() => callback(error, '', 'command failed'));
                        }
                    } else {
                        if (typeof callback === 'function') {
                            setImmediate(() => callback(null, 'success', ''));
                        }
                    }
                }
                return {} as ChildProcess;
            });

            const commands = ['command1', 'this-command-will-fail', 'command3'];

            await expect(executeCommands(commands, testDir, 'Test commands')).rejects.toThrow();

            // Only first two commands should be executed (plus detection)
            expect(actualCommandCount).toBe(2);
        });

        it('should handle empty command array', async () => {
            await expect(executeCommands([], testDir, 'No commands')).resolves.not.toThrow();

            // Only detection call, no actual commands
            expect(vi.mocked(exec).mock.calls.length).toBeLessThan(3);
        });

        it('should execute commands with dependencies', async () => {
            const commands = ['write to file', 'read from file'];

            await expect(
                executeCommands(commands, testDir, 'Dependent commands'),
            ).resolves.not.toThrow();

            // Detection + 2 commands
            expect(vi.mocked(exec).mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
