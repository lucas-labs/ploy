import * as core from '@actions/core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let cachedPowerShell: string | null | undefined = undefined;

/** detects if powershell is available */
async function detectPowerShell(): Promise<string | null> {
    if (cachedPowerShell !== undefined) {
        return cachedPowerShell;
    }

    if (process.platform !== 'win32') {
        cachedPowerShell = null;
        return null;
    }

    // try pwsh first
    try {
        await execAsync('pwsh.exe -Command "exit 0"');
        cachedPowerShell = 'pwsh.exe';
        return cachedPowerShell;
    } catch {
        // dang! pwsh not available, try powershell
        try {
            await execAsync('powershell.exe -Command "exit 0"');
            cachedPowerShell = 'powershell.exe';
            return cachedPowerShell;
        } catch {
            cachedPowerShell = null;
            return null;
        }
    }
}

/**
 * Executes a shell command with proper error handling
 * Logs output and errors
 */
export async function executeCommand(
    command: string,
    cwd: string,
    description?: string,
): Promise<void> {
    const desc = description || command;
    core.info(`Executing: ${desc}`);
    core.debug(`Command: ${command}`);
    core.debug(`Working directory: ${cwd}`);

    try {
        // use powershell if available
        const powerShell = await detectPowerShell();
        const shellCommand = powerShell
            ? `${powerShell} -Command "${command.replace(/"/g, '`"')}"`
            : command;

        const { stdout, stderr } = await execAsync(shellCommand, {
            cwd,
            maxBuffer: 10 * 1024 * 1024, // 10mb buffer
        });

        if (stdout) {
            core.info(stdout.trim());
        }
        if (stderr) {
            core.warning(stderr.trim());
        }

        core.info(`✓ ${desc} completed successfully`);
    } catch (error: unknown) {
        const errorObj = error as { stdout?: string; stderr?: string; code?: number };

        core.error(`✗ ${desc} failed`);
        if (errorObj.stdout) {
            core.error(`stdout: ${errorObj.stdout}`);
        }
        if (errorObj.stderr) {
            core.error(`stderr: ${errorObj.stderr}`);
        }

        throw new Error(
            `Command failed: ${desc}\n` +
                `Exit code: ${errorObj.code || 'unknown'}\n` +
                `${errorObj.stderr || errorObj.stdout || 'No output'}`,
        );
    }
}

/**
 * Executes multiple commands sequentially
 * Stops at the first failure
 */
export async function executeCommands(
    commands: string[],
    cwd: string,
    description: string,
): Promise<void> {
    core.info(`Executing ${description} (${commands.length} commands)`);

    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        await executeCommand(
            command,
            cwd,
            `${description} [${i + 1}/${commands.length}]: ${command}`,
        );
    }

    core.info(`All ${description} completed successfully`);
}
