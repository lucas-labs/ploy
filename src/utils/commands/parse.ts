/**
 * Parses command input that can be in multiple formats:
 * 1. Single command string: "npm install"
 * 2. JSON array: '["npm install", "npm run build"]'
 * 3. Multiline script (one command per line):
 *    ```
 *    npm install
 *    npm run build
 *    ```
 *
 * @param input - The command input string
 * @param inputName - Name of the input (for error messages)
 * @returns Array of commands, or undefined if input is empty
 */
export function parseCommandInput(
    input: string | undefined,
    inputName: string,
): string[] | undefined {
    if (!input || input.trim() === '') {
        return undefined;
    }

    const trimmed = input.trim();

    // Try to parse as JSON if it starts with [ or {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (!Array.isArray(parsed)) {
                throw new Error(`${inputName} must be a JSON array`);
            }
            if (parsed.some((cmd) => typeof cmd !== 'string')) {
                throw new Error(`${inputName} array must contain only strings`);
            }
            return parsed.filter((cmd) => cmd.trim() !== '');
        } catch (error) {
            throw new Error(
                `Failed to parse ${inputName} as JSON: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // Check if it's a multiline script (contains newlines)
    if (trimmed.includes('\n')) {
        const commands = trimmed
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '' && !line.startsWith('#')); // Filter empty lines and comments

        return commands.length > 0 ? commands : undefined;
    }

    // Single command string
    return [trimmed];
}
