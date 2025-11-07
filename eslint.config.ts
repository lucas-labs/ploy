import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        ignores: ['dist/**', 'node_modules/**', '**/*.js.map'],
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: globals.node },
    },
    { files: ['**/*.js'], languageOptions: { sourceType: 'script' } },
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,mts,cts}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
]);
