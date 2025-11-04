import { expect, it, describe, afterEach, vi } from 'vitest';
import { performHealthCheck } from '../src/action/utils/healthcheck';

describe('Health Check Utilities', () => {
    // Mock fetch globally
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('performHealthCheck', () => {
        it('should pass health check with status code in range', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                status: 200,
                ok: true,
            } as Response);

            const result = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                5,
                3,
                0,
                1,
            );

            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.attempts).toBe(1);
        });

        it('should fail health check with status code outside range', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                status: 500,
                ok: false,
            } as Response);

            const result = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                5,
                3,
                0,
                1,
            );

            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(500);
            expect(result.attempts).toBe(3);
            expect(result.error).toContain('outside expected range');
        });

        it('should retry on failure and eventually succeed', async () => {
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.resolve({
                        status: 500,
                        ok: false,
                    } as Response);
                }
                return Promise.resolve({
                    status: 200,
                    ok: true,
                } as Response);
            });

            const result = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                5,
                3,
                0,
                0, // No interval delay for faster test
            );

            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.attempts).toBe(3);
            expect(callCount).toBe(3);
        });

        it('should handle network errors', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                5,
                2,
                0,
                0,
            );

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(2);
            expect(result.error).toContain('Network error');
        });

        it('should handle timeout', async () => {
            // Mock fetch to throw an abort error
            global.fetch = vi.fn().mockImplementation(() => {
                const error = new Error('Request timed out after 1 seconds');
                error.name = 'AbortError';
                return Promise.reject(error);
            });

            const result = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                1, // 1 second timeout
                1,
                0,
                0,
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out');
        });

        it('should respect custom status code ranges', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                status: 201,
                ok: true,
            } as Response);

            // Test 200-299 range (should pass)
            const result1 = await performHealthCheck(
                'http://example.com/health',
                '200-299',
                5,
                1,
                0,
                0,
            );
            expect(result1.success).toBe(true);

            // Test 200-200 range (should fail with 201)
            const result2 = await performHealthCheck(
                'http://example.com/health',
                '200-200',
                5,
                1,
                0,
                0,
            );
            expect(result2.success).toBe(false);

            // Test 201-201 range (should pass)
            const result3 = await performHealthCheck(
                'http://example.com/health',
                '201-201',
                5,
                1,
                0,
                0,
            );
            expect(result3.success).toBe(true);
        });

        it('should use delay before first attempt', async () => {
            try {
                vi.useFakeTimers();

                global.fetch = vi.fn().mockResolvedValue({
                    status: 200,
                    ok: true,
                } as Response);

                const promise = performHealthCheck(
                    'http://example.com/health',
                    '200-299',
                    5,
                    1,
                    1, // 1 second delay
                    0,
                );

                // Fast-forward past the initial delay
                await vi.advanceTimersByTimeAsync(1000);

                const result = await promise;
                expect(result.success).toBe(true);
                expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should use interval between retries', async () => {
            try {
                vi.useFakeTimers();

                global.fetch = vi.fn().mockResolvedValue({
                    status: 500,
                    ok: false,
                } as Response);

                const promise = performHealthCheck(
                    'http://example.com/health',
                    '200-299',
                    5,
                    3,
                    0,
                    1, // 1 second interval
                );

                // Fast-forward through all retries (2 intervals between 3 attempts)
                await vi.advanceTimersByTimeAsync(2000);

                const result = await promise;
                expect(result.success).toBe(false);
                expect(result.attempts).toBe(3);
                expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
            } finally {
                vi.useRealTimers();
            }
        });

        it('should throw error for invalid code range format', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                status: 200,
                ok: true,
            } as Response);

            await expect(
                performHealthCheck('http://example.com/health', 'invalid', 5, 1, 0, 0),
            ).rejects.toThrow('Invalid health check code range');
        });

        it('should handle abort signal correctly', async () => {
            let abortSignalReceived = false;
            global.fetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
                if (options?.signal) {
                    abortSignalReceived = true;
                }
                return Promise.resolve({
                    status: 200,
                    ok: true,
                } as Response);
            });

            await performHealthCheck('http://example.com/health', '200-299', 5, 1, 0, 0);

            expect(abortSignalReceived).toBe(true);
        });
    });
});
