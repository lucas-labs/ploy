#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import semver from 'semver';
import { confirm, select } from '@inquirer/prompts';

// Release Script for ploy
// This script automates the release process of the ploy gitea action by updating the version,
// creating git tags, and pushing changes to the remote repository.

/**
 * Execute a shell command and return the output
 */
function exec(command: string, silent = false): string {
    try {
        const result = execSync(command, {
            encoding: 'utf-8',
            stdio: silent ? 'pipe' : 'inherit',
        });
        return result?.toString().trim() || '';
    } catch (error) {
        if (!silent) {
            console.error(`Error executing command: ${command}`);
            throw error;
        }
        return '';
    }
}

/**
 * Execute a shell command that returns output
 */
function execOutput(command: string): string {
    return execSync(command, { encoding: 'utf-8' }).toString().trim();
}

/**
 * Get the current version from package.json
 */
function getCurrentVersion(): string {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
}

/**
 * Update the version in package.json
 */
function updatePackageVersion(newVersion: string): void {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    packageJson.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n', 'utf-8');
}

/**
 * Get the major version tag (e.g., "v1" from "1.2.3")
 */
function getMajorTag(version: string): string {
    const major = semver.major(version);
    return `v${major}`;
}

/**
 * Get the full version tag (e.g., "v1.2.3" from "1.2.3")
 */
function getFullTag(version: string): string {
    return `v${version}`;
}

/**
 * Check if a tag exists locally or remotely
 */
function tagExists(tag: string): boolean {
    try {
        execOutput(`git rev-parse ${tag}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the latest tag (excluding the current release tag)
 */
function getLatestTag(): string | null {
    try {
        const tags = execOutput('git tag --sort=-version:refname');
        const tagList = tags.split('\n').filter((t) => t.trim());
        return tagList.length > 0 ? tagList[0] : null;
    } catch {
        return null;
    }
}

/**
 * Generate release notes from git commits since the last tag
 */
function generateReleaseNotes(fromTag: string | null, toRef: string): string {
    try {
        const range = fromTag ? `${fromTag}..${toRef}` : toRef;
        const commits = execOutput(`git log ${range} --pretty=format:"- %s (%h)" --no-merges`);

        if (!commits.trim()) {
            return 'No changes since last release.';
        }

        const lines = commits.split('\n').filter((line) => {
            // Filter out release commits
            return !line.match(/^-\s*release:/i);
        });

        if (lines.length === 0) {
            return 'No changes since last release.';
        }

        const grouped: Record<string, string[]> = {
            Features: [],
            Fixes: [],
            Chores: [],
            Other: [],
        };

        // Group commits by type (conventional commits style)
        for (const line of lines) {
            if (line.match(/^-\s*(feat|feature):/i)) {
                grouped.Features.push(line.replace(/^-\s*(feat|feature):\s*/i, '- '));
            } else if (line.match(/^-\s*fix:/i)) {
                grouped.Fixes.push(line.replace(/^-\s*fix:\s*/i, '- '));
            } else if (line.match(/^-\s*(chore|ci|docs|style|refactor|perf|test):/i)) {
                grouped.Chores.push(
                    line.replace(/^-\s*(chore|ci|docs|style|refactor|perf|test):\s*/i, '- '),
                );
            } else {
                grouped.Other.push(line);
            }
        }

        // Build the release notes
        let notes = '';

        if (grouped.Features.length > 0) {
            notes += '## ✨ Features\n\n' + grouped.Features.join('\n') + '\n\n';
        }

        if (grouped.Fixes.length > 0) {
            notes += '## 🐛 Bug Fixes\n\n' + grouped.Fixes.join('\n') + '\n\n';
        }

        if (grouped.Chores.length > 0) {
            notes += '## 🧹 Chores\n\n' + grouped.Chores.join('\n') + '\n\n';
        }

        if (grouped.Other.length > 0) {
            notes += '## 📝 Other Changes\n\n' + grouped.Other.join('\n') + '\n\n';
        }

        return notes.trim();
    } catch {
        console.error('⚠️  Failed to generate release notes from git log');
        return 'Release notes could not be generated automatically.';
    }
}

/**
 * Main release function
 */
async function release() {
    console.log('🚀 Starting release process...\n');

    // Step 1: Update tags from remote
    console.log('📥 Step 1: Fetching tags from remote...');
    const shouldFetch = await confirm({
        message: 'Fetch tags from remote?',
        default: true,
    });

    if (shouldFetch) {
        exec('git fetch --tags');
        console.log('✅ Tags fetched successfully\n');
    } else {
        console.log('⏭️  Skipped fetching tags\n');
    }

    // Step 2: Get previous tag for release notes (before creating new tags)
    const previousTag = getLatestTag();
    if (previousTag) {
        console.log(`📝 Previous release: ${previousTag}\n`);
    } else {
        console.log(`📝 No previous releases found\n`);
    }

    // Step 3: Get current version
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}\n`);

    // Clean the version (remove pre-release tags like -rc1)
    const cleanVersion = semver.clean(currentVersion) || currentVersion;
    const parsedVersion = semver.parse(cleanVersion);

    if (!parsedVersion) {
        console.error('❌ Invalid version format in package.json');
        process.exit(1);
    }

    // Step 4: Ask for release type
    const releaseType = await select({
        message: 'Select release type:',
        choices: [
            { name: 'Major (breaking changes)', value: 'major' },
            { name: 'Minor (new features)', value: 'minor' },
            { name: 'Patch (bug fixes)', value: 'patch' },
        ],
    });

    // Generate new version
    const newVersion = semver.inc(cleanVersion, releaseType as semver.ReleaseType);

    if (!newVersion) {
        console.error('❌ Failed to generate new version');
        process.exit(1);
    }

    console.log(`\n📈 New version will be: ${newVersion}`);

    const majorTag = getMajorTag(newVersion);
    const fullTag = getFullTag(newVersion);
    const isMajorRelease = releaseType === 'major';

    console.log(`\n📌 Tags to create/update:`);
    console.log(`   - ${fullTag}`);
    console.log(`   - ${majorTag} (${isMajorRelease ? 'new' : 'updated'})`);

    // Step 5: Update package.json
    console.log('\n📝 Step 5: Updating package.json...');
    const shouldUpdate = await confirm({
        message: `Update package.json version to ${newVersion}?`,
        default: true,
    });

    if (!shouldUpdate) {
        console.log('❌ Release cancelled');
        process.exit(0);
    }

    updatePackageVersion(newVersion);
    console.log('✅ package.json updated\n');

    // Step 6: Commit package.json
    console.log('💾 Step 6: Committing changes...');
    const commitMessage = `release: 🔖 v${newVersion}`;

    const shouldCommit = await confirm({
        message: `Commit package.json with message: "${commitMessage}"?`,
        default: true,
    });

    if (!shouldCommit) {
        console.log('❌ Release cancelled');
        console.log('⚠️  Note: package.json has been updated but not committed');
        process.exit(0);
    }

    exec('git add package.json');
    exec(`git commit -m "${commitMessage}"`);
    console.log('✅ Changes committed\n');

    // Step 7: Create tags
    console.log('🏷️  Step 7: Creating tags...');
    const shouldTag = await confirm({
        message: `Create tag ${fullTag}${isMajorRelease ? ` and ${majorTag}` : ''}?`,
        default: true,
    });

    if (!shouldTag) {
        console.log('❌ Release cancelled');
        console.log('⚠️  Note: Changes have been committed but tags not created');
        process.exit(0);
    }

    // Create the full version tag
    exec(`git tag -a ${fullTag} -m "Release ${newVersion}"`);
    console.log(`✅ Created tag: ${fullTag}`);

    // Handle major tag
    if (isMajorRelease) {
        // For a new major release, create the major tag
        exec(`git tag -a ${majorTag} -m "Major version ${semver.major(newVersion)}"`);
        console.log(`✅ Created tag: ${majorTag}`);
    } else {
        // For minor/patch, update the major tag to point to the same commit
        if (tagExists(majorTag)) {
            // Delete the old major tag locally and remotely
            exec(`git tag -d ${majorTag}`, true);
            exec(`git push origin :refs/tags/${majorTag}`, true);
            console.log(`🔄 Deleted old ${majorTag} tag`);
        } else {
            console.log(`ℹ️  Major tag ${majorTag} does not exist, creating new one`);
        }

        // Create new major tag pointing to current commit
        exec(`git tag -a ${majorTag} -m "Major version ${semver.major(newVersion)}"`);
        console.log(`✅ Created/updated tag: ${majorTag}`);
    }

    // Step 8: Push tags
    console.log('\n📤 Step 8: Pushing tags...');
    const shouldPush = await confirm({
        message: 'Push commit and tags to remote?',
        default: true,
    });

    if (!shouldPush) {
        console.log('⚠️  Release completed locally but not pushed to remote');
        console.log(`   To push manually, run:`);
        console.log(`   git push && git push origin ${fullTag} ${majorTag} --force`);
        process.exit(0);
    }

    // Push the commit
    exec('git push');
    console.log('✅ Commit pushed');

    // Push the tags (use --force for major tag in case it was updated)
    exec(`git push origin ${fullTag}`);
    console.log(`✅ Pushed tag: ${fullTag}`);

    exec(`git push origin ${majorTag} --force`);
    console.log(`✅ Pushed tag: ${majorTag}`);

    // Step 9: Create Gitea release
    console.log('\n📝 Step 9: Creating Gitea release...');
    const shouldCreateRelease = await confirm({
        message: 'Create a release in Gitea?',
        default: true,
    });

    const releaseTitle = `v${newVersion}`;

    if (shouldCreateRelease) {
        // Generate release notes from git commits
        console.log(
            `\n📝 Generating release notes from commits${previousTag ? ` since ${previousTag}` : ''}...`,
        );
        const autoNotes = generateReleaseNotes(previousTag, 'HEAD');

        // Create a temporary directory and file for the release notes
        const tempDir = mkdtempSync(join(tmpdir(), 'ploy-release-'));
        const notesFile = join(tempDir, 'RELEASE_NOTES.md');
        writeFileSync(notesFile, autoNotes, 'utf-8');

        console.log('✅ Release notes generated\n');

        try {
            exec(
                `tea release create --remote origin --tag ${fullTag} --title "${releaseTitle}" --note-file "${notesFile}"`,
            );
            console.log('✅ Gitea release created successfully');
        } catch {
            console.error('⚠️  Failed to create Gitea release');
            console.error('   Make sure:');
            console.error('   - The tea CLI is installed and configured');
            console.error('   - You are logged in to your Gitea instance (run: tea login add)');
            console.error('   - You have permission to create releases in this repository');
            console.error('\n   To create the release manually, run:');

            // backup the notes to .
            const backupNotesFilePath = resolve(
                process.cwd(),
                `RELEASE_NOTES_${fullTag.replace(/\./g, '_')}.md`,
            );
            writeFileSync(backupNotesFilePath, autoNotes, 'utf-8');

            console.error(
                `   tea release create --tag ${fullTag} --title "${releaseTitle}" --note-file "${backupNotesFilePath}"`,
            );
            console.error(`\n   Note: The release notes file is at: ${backupNotesFilePath}`);
        } finally {
            // Clean up the temporary directory
            try {
                rmSync(tempDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        }
    } else {
        console.log('⏭️  Skipped creating Gitea release');
        console.log(`   To create manually later, run:`);
        console.log(`   tea release create --tag ${fullTag} --title "${releaseTitle}"`);
        console.log(`   (You can add --note "Your release notes" or --note-file path/to/notes.md)`);
    }

    console.log('\n🎉 Release completed successfully!');
    console.log(`\n📦 Released version: ${newVersion}`);
    console.log(`🏷️  Tags: ${fullTag}, ${majorTag}`);
}

// Run the release script
release().catch((error) => {
    console.error('\n❌ Release failed:', error.message);
    process.exit(1);
});
