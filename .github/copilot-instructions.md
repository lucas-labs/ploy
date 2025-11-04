# Copilot Instructions for @lucode/ploy

## Project Overview

This is a **GitHub Actions/Gitea Actions** plugin for automated Windows deployments. It implements an immutable release
pattern using Windows junction points for zero-downtime deployments.

**Core Architecture:** The action follows a 7-step deployment pipeline (see `src/action/subactions/deploy/action.ts`):

1. Environment Setup → Creates `{deploy_root}/releases/` structure
2. Install Dependencies (optional)
3. Build Application (optional)
4. Prepare Release Directory → Creates timestamped dirs: `YYYYMMDD-HHMMSS-{shortSha}`
5. Run Pre-Deploy Commands (optional) → Runs in the new release directory
6. Switch Active Release → Updates `current` junction atomically
7. Health Check (optional) → Validates deployment with retries

## Critical Windows-Specific Patterns

### Junction Management (`src/action/utils/junction/index.ts`)

- **Never use `rmdir` on junctions** - Use `fs.unlink()` to remove the junction pointer without deleting target
- Safety check: Always verify with `isJunction()` before removing `current` to prevent data loss
- Create junctions with `fs.symlink(target, junction, 'junction')` type parameter

### File Exclusions (`src/action/utils/files/index.ts`)

- Default exclusions in `DEFAULT_EXCLUDE_PATTERNS`: `.git`, `node_modules`, `__pycache__`, `.venv`, etc.
- When `dist_dir` is specified, copy ONLY that directory with no exclusions
- When `dist_dir` is omitted, copy entire repo excluding patterns

### Release Directory Structure

```
{deploy_root}/
├── releases/
│   ├── 20250104-143052-a1b2c3d/  # Immutable release dirs
│   └── 20250103-120000-def4567/
└── current → releases/20250104-143052-a1b2c3d/  # Junction pointer
```

## Development Workflow

### Testing

- Run tests: `bun test` (uses Vitest with v8 coverage)
- **Important:** Tests use `fileParallelism: false` and `sequence: { concurrent: false }` to avoid junction conflicts on
  Windows
- Test cleanup pattern: Each test creates unique dirs with `test-{type}-${Date.now()}-${counter}` to prevent race
  conditions
- Integration tests (`tests/integration.test.ts`) mock the full GitHub Actions environment

### Building & Distribution

- Build command: `bun run build` (uses `@vercel/ncc` to bundle into `dist/index.js`)
- The action runs via `dist/index.js` (specified in `action.yaml` → `runs.main`)
- Always rebuild before committing action changes: The bundled `dist/` must be committed

### Code Quality

- Linting: `bun run lint` (uses ESLint 9 with flat config in `eslint.config.ts`)
- Formatting: `bun run fmt` (Prettier)
- Combined check: `bun run check` (runs both)
- Pre-commit hooks managed by Husky

### Release Process

- Use `bun run release` to run the interactive release script (`scripts/release.ts`)
- Creates git tags following semver (e.g., `v1.0.0`)
- Script handles version bumping, building, tagging, and pushing

## Key Conventions

### Module Structure

- **Utils are single-concern modules**: Each util directory (`commands/`, `dirs/`, `files/`, `healthcheck/`,
  `junction/`) exports focused functions
- **Types are centralized**: All action types defined in `src/action/types.ts` (ActionInputs, ActionOutputs,
  HealthCheckResult, ReleaseInfo)
- **Context utilities**: `src/action/utils/context/index.ts` handles mapping between GitHub Actions I/O and internal
  types

### Error Handling

- Throw descriptive errors with context: `throw new Error(\`Failed to X: ${error.message}\`)`
- Commands run via `child_process.exec` with 10MB buffer (`maxBuffer: 10 * 1024 * 1024`)
- Health checks use `AbortController` for proper timeout handling

### Code comments

- Prefer clear, self-documenting code (good names, small functions) over explanatory comments for obvious logic.
- Avoid comments that simply restate what the code does (e.g., `// increment i` next to `i++`). Such comments add noise
  and can become stale.
- Use comments for intent, rationale, or non-obvious decisions (why something is implemented a certain way), not for
  describing straightforward operations.
- Example (bad):
  - `// create release directory`\n `await fs.mkdir(releasePath)` Example (better): Add a short comment only when the
    intent isn't obvious or when documenting constraints (e.g., windows junction safety checks).

### Input Parsing

- `pre_deploy_cmds` is parsed from JSON array string in `getInputs()` (`src/action/utils/context/index.ts`)
- Health check ranges use format `"200-299"` (parsed in `healthcheck/index.ts`)
- SHA extraction tries multiple env vars: `GITHUB_SHA`, `GITEA_SHA`, `CI_COMMIT_SHA`

### GitHub Actions Integration

- All logging uses `@actions/core` methods: `core.info()`, `core.startGroup()`, `core.setOutput()`
- Mock `@actions/core` in ALL tests to avoid side effects
- Inputs read with `core.getInput()`, outputs set with `core.setOutput()`

## Testing Patterns

- **Mock external dependencies**: Always mock `@actions/core`, `commands`, `healthcheck` at top of test files
- **Cleanup after tests**: Use `afterEach()` to remove test directories with
  `fs.rm(testDir, { recursive: true, force: true })`
- **Async assertions**: Use `await expect(promise).rejects.toThrow()` for error cases
- Coverage thresholds: 80% for lines/functions/branches/statements (enforced in `vitest.config.ts`)

## Common Pitfalls

1. **Don't manually delete junctions**: Use the `removeJunction()` utility to avoid deleting target directories
2. **Don't run tests in parallel**: Junction creation on Windows has race conditions
3. **Don't forget to rebuild**: Action changes require `bun run build` + committing `dist/`
4. **Health check URL must be reachable**: Tests mock `performHealthCheck()` since URLs don't exist in CI
5. **Windows paths**: Use `path.join()` consistently; tests verify junction behavior on Windows filesystem

## Documentation

- User-facing docs: `readme.md` (includes usage examples, input/output tables)
- Architecture/decisions: `docs/prd.md` (original product requirements document)
- This file: Focus on patterns that aren't obvious from reading individual files
