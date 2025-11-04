# @lucode/ploy

Gitea Action with a set of tools to deploy applications

## Release instructions

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
