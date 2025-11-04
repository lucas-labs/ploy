import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        clearMocks: true,
        isolate: true,
        pool: 'forks',
        fileParallelism: false,
        sequence: { concurrent: false },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', '**/*.test.ts', '**/*.spec.ts'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
