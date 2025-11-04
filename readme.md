# @lucode/ploy

Gitea Action for automated Windows release preparation and deployment.

This action automates the preparation of deployable releases for applications running on **Windows servers**. It
provides an opinionated deployment workflow tailored for Windows environments using an immutable release directory
structure with a `current` junction pointing to the active version.

## Features

- 🚀 **Automated Deployment** - Handles the complete deployment lifecycle from build to activation
- 📦 **Dependency Management** - Optionally install dependencies before building
- 🔨 **Build Support** - Execute custom build commands
- 📂 **Immutable Releases** - Creates timestamped release directories (format: `YYYYMMDD-HHMMSS-{shortSha}`)
- 🔄 **Atomic Switching** - Uses Windows junctions for zero-downtime deployments
- ⚙️ **Pre-Deploy Commands** - Run custom commands in the release directory before activation
- 🏥 **Health Checks** - Verify deployment success with configurable HTTP health checks
- 🔁 **Retry Logic** - Automatic retries for health checks with configurable intervals

## Inputs

### Required

| Input         | Description                         | Example              |
| ------------- | ----------------------------------- | -------------------- |
| `app_name`    | Logical name of the application     | `orders-api`         |
| `deploy_root` | Root path where releases are stored | `C:\apps\orders-api` |

### Optional

| Input                             | Description                                    | Default                   | Example                                           |
| --------------------------------- | ---------------------------------------------- | ------------------------- | ------------------------------------------------- |
| `repo_path`                       | Path to the repository                         | `${{ github.workspace }}` | `C:\actions\runner\_work\repo`                    |
| `install_cmd`                     | Command to install dependencies                | -                         | `bun install`                                     |
| `build_cmd`                       | Command to build the application               | -                         | `npm run build`                                   |
| `dist_dir`                        | Relative path to built files directory         | -                         | `dist`, `build`                                   |
| `pre_deploy_cmds`                 | JSON array of commands to run after deployment | -                         | `["bun install --production", "bun run migrate"]` |
| `healthcheck_url`                 | URL for health check after deployment          | -                         | `http://localhost:8080/health`                    |
| `expected_healthcheck_code_range` | Acceptable HTTP status code range              | `200-299`                 | `200-299`, `200-204`                              |
| `healthcheck_timeout`             | Timeout in seconds for health check            | `30`                      | `60`                                              |
| `healthcheck_retries`             | Number of health check retries                 | `3`                       | `5`                                               |
| `healthcheck_delay`               | Delay before first health check (seconds)      | `5`                       | `10`                                              |
| `healthcheck_interval`            | Interval between retries (seconds)             | `5`                       | `10`                                              |

## Outputs

| Output                 | Description                                 | Example                                               |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `release_path`         | Absolute path to the new release directory  | `C:\apps\orders-api\releases\20250104-143052-a1b2c3d` |
| `release_id`           | Release identifier (timestamp-sha format)   | `20250104-143052-a1b2c3d`                             |
| `previous_release`     | Path to the previous release (if any)       | `C:\apps\orders-api\releases\20250103-120000-def4567` |
| `deployment_time`      | ISO 8601 timestamp of deployment completion | `2025-01-04T14:30:52Z`                                |
| `healthcheck_status`   | Health check status                         | `passed` or `failed`                                  |
| `healthcheck_code`     | HTTP status code from health check          | `200`                                                 |
| `healthcheck_attempts` | Number of health check attempts made        | `2`                                                   |
| `current_junction`     | Path to the current junction                | `C:\apps\orders-api\current`                          |

## Usage Examples

### Basic Deployment

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Deploy Application
    uses: lucode/ploy@v1
    with:
      app_name: my-app
      deploy_root: C:\apps\my-app
```

### Deployment with Build

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '20'

  - name: Deploy Application
    uses: lucode/ploy@v1
    with:
      app_name: my-app
      deploy_root: C:\apps\my-app
      install_cmd: npm ci
      build_cmd: npm run build
      dist_dir: dist
```

### Deployment with Pre-Deploy Commands and Health Check

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Deploy Application
    uses: lucode/ploy@v1
    with:
      app_name: orders-api
      deploy_root: C:\apps\orders-api
      install_cmd: bun install
      build_cmd: bun run build
      dist_dir: dist
      pre_deploy_cmds: '["bun install --production", "bun run migrate"]'
      healthcheck_url: http://localhost:8080/health
      expected_healthcheck_code_range: '200-299'
      healthcheck_timeout: 30
      healthcheck_retries: 3
```

## Deployment Flow

1. **Environment Setup** - Creates and validates deploy root structure
2. **Install Dependencies** - Runs `install_cmd` in the repository (if provided)
3. **Build Application** - Runs `build_cmd` in the repository (if provided)
4. **Prepare Release** - Creates timestamped release directory and copies files
5. **Pre-Deploy Commands** - Runs commands in the release directory (if provided)
6. **Switch Active Release** - Updates the `current` junction to point to new release
7. **Health Check** - Verifies deployment with HTTP health check (if provided)

## Directory Structure

The action creates and maintains the following structure:

```
C:\apps\my-app\                    (deploy_root)
├── releases\
│   ├── 20250103-120000-def4567\   (previous release)
│   └── 20250104-143052-a1b2c3d\   (new release)
└── current -> releases\20250104-143052-a1b2c3d\  (junction)
```

## Error Handling

The action will fail gracefully with clear error messages in these scenarios:

- Invalid or missing required inputs
- Permission issues (cannot create directories, junctions, or write files)
- Command failures (install, build, or pre-deploy commands exit with non-zero status)
- Health check failures (endpoint unreachable or returns unexpected status code)
- Safety checks (e.g., existing `current` path is not a junction)

## Security Notes

- No sensitive information (tokens, passwords) is logged
- File permissions are preserved during copying
- All paths are validated to prevent directory traversal attacks

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- TypeScript

### Build

```bash
bun install
bun run build
```

### Test

```bash
bun test
```

### Lint

```bash
bun run lint
bun run lint:fix
```

## Release Instructions

This repository includes a release helper script at `scripts/release.ts` that automates version bumps, tagging and
pushing.

Recommended (uses Bun):

```
bun run release
```

What the script does (interactive):

- Fetch tags from the remote
- Ask for release type (major / minor / patch)
- Update `package.json` version
- Commit the change and create tags (full version tag and major tag)
- Push commit and tags to the remote (optional)
- Create a release in Gitea with auto-generated release notes (optional, requires `tea` CLI)

Notes:

- The npm `release` script runs `bun run scripts/release.ts` as defined in `package.json`.
- Make sure you have Git configured and permission to push tags to the remote repository.
- For Gitea release creation, install and configure the [`tea` CLI](https://gitea.com/gitea/tea) beforehand.
- Release notes are automatically generated from git commit messages since the last tag, grouped by type (features,
  fixes, chores, etc.).
- If you don't use Bun you can run the TypeScript script with a runner that supports TS (for example `ts-node` /
  `ts-node-esm`), but Bun is recommended since the provided npm script expects it.

## License

See [LICENSE](./LICENSE) file.

## Contributing

Contributions are welcome! Please open an issue or pull request.
