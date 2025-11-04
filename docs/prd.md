# **Product Requirements Document (PRD)**

## **Project:** `lucode/ploy` Gitea Action — Windows Release Preparer

### **Summary**

This Gitea Action automates the preparation of deployable releases for applications running on **Windows servers**.

It provides an opinionated deployment workflow tailored for Windows environments.

It handles:

- installing dependencies,
- building the application (if applicable),
- performing lightweight validation (optional),
- moving files into an immutable release directory structure,
- switching the active release by updating a `current` junction (optional),
- health checks (optional)

---

### **Goals**

1. Automate the build and preparation of application releases.
2. Avoid “in-place” updates to running code.
3. Use an immutable release directory structure with a `current` Junction (or junction) pointing to the active version.

---

### **Functional Scope**

#### **Inputs**

The Action should accept the following parameters as inputs:

| Input Name                                     | Description                                                                                                                                                                       | Example                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `app_name`                                     | Logical name of the application                                                                                                                                                   | `orders-api`                                               |
| `deploy_root`                                  | Root path where releases are stored                                                                                                                                               | `C:\apps\orders-api`                                       |
| `repo_path`                                    | Defaults to current working directory of the Action because it runs in the checked-out repo (e.g. preceded by `actions/checkout`)                                                 | `C:\actions\runner\_work\repo`                             |
| `install_cmd` _(optional)_                     | Command to install dependencies (if any). If not provided, no installation is done.                                                                                               | `poetry install --no-interaction --no-root`, `bun install` |
| `build_cmd` _(optional)_                       | Command to build the application (if applicable). If not provided, no build step is done.                                                                                         | `npm run build`, `uv build`, `bun run build`               |
| `dist_dir` _(optional)_                        | Relative path to the directory containing built files to be deployed. If not provided, the entire repo is used.                                                                   | `dist`, `build`, `out`                                     |
| `pre_deploy_cmds` _(optional)_                 | List of commands to run after deployment (e.g., database migrations, cache clearing, build). These commands will be run in sequence in the `deploy_root/{release_dir}` directory. | `["bun install", "bun run migrate"]`                       |
| `healthcheck_url` _(optional)_                 | URL to perform a health check after deployment. If not provided, no health check is done.                                                                                         | `http://localhost:8080/health`                             |
| `expected_healthcheck_code_range` _(optional)_ | A string indicating a range of acceptable HTTP status codes for the health check (e.g. `200-299`). Defaults to `200-299`.                                                         | `200-299`, `200-204`                                       |
| `healthcheck_timeout` _(optional)_             | Timeout in seconds for the health check HTTP request. Defaults to `30` seconds.                                                                                                   | `30`, `60`                                                 |
| `healthcheck_retries` _(optional)_             | Number of retries for the health check HTTP request. Defaults to `3`.                                                                                                             | `3`, `5`                                                   |
| `healthcheck_delay` _(optional)_               | Delay in seconds before performing the health check after deployment. Defaults to `5` seconds.                                                                                    | `5`, `10`                                                  |
| `healthcheck_interval` _(optional)_            | Interval in seconds between health check retries. Defaults to `5` seconds.                                                                                                        | `5`, `10`                                                  |

---

### **Flow Overview**

#### **1. Environment Setup**

Ensure `deploy_root` exists and contains the standard layout:

```
{deploy_root}\
{deploy_root}\releases\
{deploy_root}\current -> (junction)
```

The action must:

- `deploy_root` is a directory and it's writable.
- `releases` subdirectory exists -> create if missing.
- `current` junction exists or can be created.

The Action must FAIL if:

- `deploy_root` is missing and cannot be created.
- `deploy_root` is not a directory or not writable.
- `releases` cannot be created.

---

#### **2. Install Dependencies**

If `install_cmd` is provided:

- Navigate to `repo_path`
- Execute the `install_cmd`
- If the command exits with non-zero status, FAIL the Action

Example commands:

- `npm install --production`
- `bun install`
- `poetry install --no-interaction --no-root`
- `uv sync --frozen`

---

#### **3. Build Application**

If `build_cmd` is provided:

- Navigate to `repo_path`
- Execute the `build_cmd`
- If the command exits with non-zero status, FAIL the Action

Example commands:

- `npm run build`
- `bun run build`
- `tsc`
- `cargo build --release`

---

#### **4. Prepare Release Directory**

Create a new timestamped release directory:

```
{deploy_root}\releases\{timestamp}-{short_sha}\
```

Where:

- `{timestamp}` is the current timestamp in format `YYYYMMDD-HHMMSS` (e.g., `20250104-143052`)
- `{short_sha}` is the first 7 characters of the Git commit SHA

Example: `C:\apps\orders-api\releases\20250104-143052-a1b2c3d\`

Copy files to the release directory:

- If `dist_dir` is provided:
  - Copy contents of `{repo_path}\{dist_dir}\*` to the release directory
  - FAIL if `dist_dir` was provided but does not exist
- If `dist_dir` is NOT provided:
  - Copy contents of `{repo_path}\*` to the release directory (excluding common paths like `.git`, `node_modules`, etc.)

The Action must FAIL if:

- The release directory cannot be created
- Files cannot be copied
- The source directory (`dist_dir` if provided, or `repo_path`) doesn't exist

---

#### **5. Run Pre-Deploy Commands (Optional)**

If `pre_deploy_cmds` is provided:

- Navigate to `{deploy_root}\releases\{new_release_dir}` (the newly created release directory)
- Execute each command in the list sequentially
- If any command exits with non-zero status, FAIL the Action and do not proceed to the next command

Example use cases:

- Install production dependencies: `bun install --production`
- Run database migrations: `bun run migrate`
- Clear application caches: `bun run cache:clear`
- Build assets in the release directory: `npm run build:assets`

Implementation notes:

- Commands are executed in the order they appear in the array
- Each command is executed in the context of the release directory
- Environment variables from the action context are available to the commands
- Standard output and error streams are logged
- Execution stops at the first failure

The Action must FAIL if:

- Any command in `pre_deploy_cmds` exits with non-zero status
- The release directory is not accessible

---

#### **6. Switch Active Release (Update Current Junction)**

Update the `current` junction to point to the new release:

1. Check if `{deploy_root}\current` exists
   - If it exists and is a junction, remove it
   - If it exists and is NOT a junction, FAIL the Action (safety check)
2. Create a new junction: `{deploy_root}\current` → `{deploy_root}\releases\{new_release_dir}`

The Action must FAIL if:

- The junction cannot be deleted
- The junction cannot be created
- An existing `current` path is not a junction

---

#### **7. Health Check (Optional)**

If `healthcheck_url` is provided:

1. Wait for `healthcheck_delay` seconds (default: 5 seconds) to allow the application to start/restart
2. Make an HTTP GET request to `healthcheck_url` with timeout of `healthcheck_timeout` seconds (default: 30 seconds)
3. Check if the response status code is within `expected_healthcheck_code_range` (default: `200-299`)
4. If the health check fails:
   - Retry up to `healthcheck_retries` times (default: 3) with `healthcheck_interval` seconds (default: 5) between
     attempts
   - Log the failure details (status code, error message, attempt number)
   - Optionally: rollback to the previous release (advanced feature)
   - FAIL the Action after all retries are exhausted

Implementation notes:

- Use `healthcheck_timeout` (default: 30 seconds) for each HTTP request attempt
- Retry logic: retry up to `healthcheck_retries` times (default: 3) with `healthcheck_interval` seconds (default: 5)
  between attempts
- Initial delay: wait `healthcheck_delay` seconds (default: 5) before the first attempt
- Log the response status code, attempt number, and any error messages for each attempt
- Total maximum time: `healthcheck_delay` + (`healthcheck_timeout` + `healthcheck_interval`) × `healthcheck_retries`

---

### **Outputs**

The Action should produce the following outputs:

| Output Name            | Description                                             | Example                                               |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `release_path`         | Absolute path to the new release directory              | `C:\apps\orders-api\releases\20250104-143052-a1b2c3d` |
| `release_id`           | The release identifier (timestamp-sha format)           | `20250104-143052-a1b2c3d`                             |
| `previous_release`     | Path to the previous release (if any)                   | `C:\apps\orders-api\releases\20250103-120000-def4567` |
| `deployment_time`      | ISO 8601 timestamp of when the deployment completed     | `2025-01-04T14:30:52Z`                                |
| `healthcheck_status`   | Final status of the health check (`passed` or `failed`) | `passed`                                              |
| `healthcheck_code`     | HTTP status code returned by the health check           | `200`                                                 |
| `healthcheck_attempts` | Number of health check attempts made                    | `2`                                                   |
| `current_junction`     | Path to the `current` junction                          | `C:\apps\orders-api\current`                          |

---

### **Error Handling**

The Action should fail gracefully with clear error messages in the following scenarios:

1. **Invalid Inputs**
   - `deploy_root` is not provided or is empty
   - `app_name` is not provided or is empty
   - `dist_dir` is provided but doesn't exist after the build step

2. **Permission Issues**
   - Cannot create directories in `deploy_root`
   - Cannot write files to the release directory
   - Cannot create or update the `current` junction

3. **Command Failures**
   - `install_cmd` exits with non-zero status
   - `build_cmd` exits with non-zero status
   - Any command in `pre_deploy_cmds` exits with non-zero status

4. **Health Check Failures**
   - Health check endpoint is unreachable after all retries
   - Health check returns status code outside the expected range
   - Health check times out (exceeds `healthcheck_timeout`) after `healthcheck_retries` attempts

Each error should:

- Include a descriptive error message
- Log relevant context (paths, commands, exit codes, etc.)
- Set the Action status to failed
- Preserve logs for debugging

---

### **Success Criteria**

The Action is considered successful when:

1. All required inputs are valid
2. Dependencies are installed successfully (if `install_cmd` provided)
3. Application is built successfully (if `build_cmd` provided)
4. Files are copied to the new release directory
5. Pre-deploy commands execute successfully (if `pre_deploy_cmds` provided)
6. The `current` junction is updated to point to the new release
7. Health check passes (if `healthcheck_url` provided)

---

#### **Reliability**

- The Action must be idempotent: running it multiple times with the same commit should be safe
- Atomic junction updates to minimize downtime
- No in-place modifications to running code

#### **Security**

- No sensitive information (tokens, passwords) should be logged
- File permissions should be preserved during copying
- Validate all paths to prevent directory traversal attacks

#### **Maintainability**

- Clear, structured logs for each step
- Modular code design with testable functions
- Comprehensive error messages

---

### **Implementation Details**

#### **Technology Stack**

- **Runtime**: Node.js
- **Language**: TypeScript
- **Package Manager**: Bun (with npm compatibility)
- **Testing**: Vitest

#### **Directory Structure**

Use a modular structure for maintainability, avoid spaghetti code. Keep it simple and organized.

Example of directory structure:

```
.
├── action.yaml          # Action metadata and input/output definitions
├── src/
│   ├── index.ts                  # Entry point
│   └── action/
│       ├── utils/                # shared utilities
│       │   ├── healthcheck/      # Directory for health check utilities
│       │   ├── dirs/             # Directory for directory management utilities
│       │   └── etc...
│       ├── subactions/           # Directory for sub-actions... for now we only have a "deploy" sub-action... might add more in future
│       │   └── deploy/           # Directory for deployment logic
│       │       └── action.ts     # The action logic
│       └── run.ts                # orchestrates (calls the requested sub-action)
├── tests/
│   └── run.test.ts      # Unit tests
└── dist/
    └── index.js         # Compiled bundle (automatically created by ncc)
```

---

### **Testing Strategy**

#### **Unit Tests**

- Test input validation logic
- Test path manipulation and Junction creation logic
- Test Pre-deploy commands execution with mocked command results
- Test health check retry logic with mocked HTTP responses
- Test error handling for various failure scenarios

#### **Integration Tests**

- Test the complete workflow in a controlled environment
- Test with different application types (Node.js, Python, static files)
- Test rollback scenarios
- Test with and without optional inputs

---

### **Future Enhancements**

1. **Automatic Rollback**
   - If health check fails, automatically rollback to the previous release
   - Provide `auto_rollback` input (default: `false`)

2. **Release Retention**
   - Automatically clean up old releases based on retention policy
   - Provide `keep_releases` input (default: `5`)

3. **Pre-Deployment Hooks**
   - Allow custom scripts to run before deployment
   - Provide `pre_deploy_cmds` input (similar to `pre_deploy_cmds`)

4. **Slack/Discord Notifications**
   - Send deployment notifications to communication channels
   - Provide `webhook_url` input

5. **Multi-Stage Deployments**
   - Support deploying to multiple servers
   - Support staging → production promotion workflow

6. **Deployment Metrics**
   - Track deployment duration, frequency, and success rate
   - Provide `metrics_endpoint` input for pushing metrics

---

### **Acceptance Criteria**

The Action is ready for release when:

- [ ] All inputs are properly documented in `action.yaml`
- [ ] Core functionality is implemented and tested
- [ ] Unit tests achieve >80% code coverage
- [ ] Integration tests pass on Windows environment
- [ ] Error messages are clear and actionable
- [ ] README includes usage examples and troubleshooting guide
- [ ] Action successfully deploys a sample application
- [ ] Performance benchmarks meet requirements (<10 min for typical apps)
- [ ] Security review completed (no credential leaks, safe path handling)
- [ ] Documentation includes migration guide from manual deployments

---

### **Glossary**

- **Deploy Root**: The base directory where all releases for an application are stored
- **Release Directory**: A timestamped, immutable directory containing a specific version of the application
- **Current Junction**: A junction pointing to the active release
- **Atomic Deployment**: A deployment method where the active version is switched instantly by updating a Junction
- **Health Check**: An HTTP endpoint that verifies an application is running correctly
- **Rollback**: Reverting to a previous release by updating the `current` Junction

---

### **References**

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Gitea Actions Documentation](https://docs.gitea.com/next/usage/actions/overview)
- [Atomic Deployment Pattern](https://blog.codinghorror.com/atomic-deployment/)
- [Windows Junction Points](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points)

---

- **Document Version**: 1.0
- **Last Updated**: November 4, 2025
- **Author**: @lucode
- **Status**: Approved
