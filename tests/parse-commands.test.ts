import { describe, it, expect } from 'vitest';
import { parseCommandInput } from '../src/action/utils/commands/parse';

describe('parseCommandInput', () => {
    it('returns undefined for empty input', () => {
        expect(parseCommandInput(undefined, 'test_input')).toBeUndefined();
        expect(parseCommandInput('', 'test_input')).toBeUndefined();
        expect(parseCommandInput('   ', 'test_input')).toBeUndefined();
    });

    it('parses single command string', () => {
        const result = parseCommandInput('npm install', 'test_input');
        expect(result).toEqual(['npm install']);
    });

    it('parses single command with extra whitespace', () => {
        const result = parseCommandInput('  npm install  ', 'test_input');
        expect(result).toEqual(['npm install']);
    });

    it('parses JSON array format', () => {
        const input = '["npm install", "npm run build"]';
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build']);
    });

    it('parses JSON array with empty strings filtered out', () => {
        const input = '["npm install", "", "npm run build", "  "]';
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build']);
    });

    it('throws error for invalid JSON array', () => {
        const input = '["npm install", "npm run build"';
        expect(() => parseCommandInput(input, 'test_input')).toThrow(
            'Failed to parse test_input as JSON',
        );
    });

    it('throws error for JSON non-array', () => {
        const input = '{"cmd": "npm install"}';
        expect(() => parseCommandInput(input, 'test_input')).toThrow(
            'test_input must be a JSON array',
        );
    });

    it('throws error for JSON array with non-strings', () => {
        const input = '["npm install", 123, "npm run build"]';
        expect(() => parseCommandInput(input, 'test_input')).toThrow(
            'test_input array must contain only strings',
        );
    });

    it('parses multiline script format', () => {
        const input = `npm install
npm run build
npm test`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build', 'npm test']);
    });

    it('parses multiline script with empty lines', () => {
        const input = `npm install

npm run build

npm test`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build', 'npm test']);
    });

    it('parses multiline script with comments', () => {
        const input = `# Install dependencies
npm install
# Build the app
npm run build`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build']);
    });

    it('parses multiline script with mixed whitespace', () => {
        const input = `  npm install  
  
  npm run build  
npm test`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual(['npm install', 'npm run build', 'npm test']);
    });

    it('returns undefined for multiline with only comments and empty lines', () => {
        const input = `# Just comments


# More comments`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toBeUndefined();
    });

    it('parses complex multiline script', () => {
        const input = `echo Pre-deploy: Listing deployment directory
dir
echo Pre-deploy: Checking package.json exists
pwsh -Command Test-Path package.json`;
        const result = parseCommandInput(input, 'test_input');
        expect(result).toEqual([
            'echo Pre-deploy: Listing deployment directory',
            'dir',
            'echo Pre-deploy: Checking package.json exists',
            'pwsh -Command Test-Path package.json',
        ]);
    });
});
