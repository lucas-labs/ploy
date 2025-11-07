import * as core from '@actions/core';
import type { HealthCheckResult } from '@/types';

/**
 * Parses a health check code range string (e.g., "200-299") into min and max values
 */
function parseCodeRange(range: string): { min: number; max: number } {
    const parts = range.split('-').map((p) => parseInt(p.trim(), 10));

    if (parts.length !== 2 || parts.some((p) => isNaN(p))) {
        throw new Error(`Invalid health check code range: ${range}. Expected format: "200-299"`);
    }

    return { min: parts[0], max: parts[1] };
}

/**
 * Checks if a status code is within the expected range
 */
function isStatusCodeInRange(statusCode: number, range: string): boolean {
    const { min, max } = parseCodeRange(range);
    return statusCode >= min && statusCode <= max;
}

/**
 * Performs a single health check HTTP request
 */
async function performHealthCheckRequest(
    url: string,
    timeout: number,
): Promise<{ statusCode: number; success: boolean; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET',
        });

        clearTimeout(timeoutId);

        return {
            statusCode: response.status,
            success: response.ok,
        };
    } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
            return {
                statusCode: 0,
                success: false,
                error: `Request timed out after ${timeout} seconds`,
            };
        }

        return {
            statusCode: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Waits for a specified number of seconds
 */
function sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Performs a health check with retry logic
 */
export async function performHealthCheck(
    url: string,
    expectedCodeRange: string,
    timeout: number,
    retries: number,
    delay: number,
    interval: number,
): Promise<HealthCheckResult> {
    core.info(`Starting health check: ${url}`);
    core.info(`Expected status code range: ${expectedCodeRange}`);
    core.info(
        `Timeout: ${timeout}s, Retries: ${retries}, Delay: ${delay}s, Interval: ${interval}s`,
    );

    // Initial delay before first attempt
    if (delay > 0) {
        core.info(`Waiting ${delay} seconds before first health check attempt...`);
        await sleep(delay);
    }

    let lastStatusCode: number | undefined;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
        core.info(`Health check attempt ${attempt}/${retries}...`);

        const result = await performHealthCheckRequest(url, timeout);
        lastStatusCode = result.statusCode;

        if (result.error) {
            lastError = result.error;
            core.warning(`Attempt ${attempt} failed: ${result.error}`);
        } else {
            core.info(`Received status code: ${result.statusCode}`);

            if (isStatusCodeInRange(result.statusCode, expectedCodeRange)) {
                core.info(`✓ Health check passed on attempt ${attempt}`);
                return {
                    success: true,
                    statusCode: result.statusCode,
                    attempts: attempt,
                };
            } else {
                lastError = `Status code ${result.statusCode} is outside expected range ${expectedCodeRange}`;
                core.warning(`Attempt ${attempt} failed: ${lastError}`);
            }
        }

        // Wait before next attempt (unless this was the last attempt)
        if (attempt < retries) {
            core.info(`Waiting ${interval} seconds before next attempt...`);
            await sleep(interval);
        }
    }

    // All attempts failed
    core.error(`✗ Health check failed after ${retries} attempts`);
    return {
        success: false,
        statusCode: lastStatusCode,
        attempts: retries,
        error: lastError || 'Health check failed',
    };
}
