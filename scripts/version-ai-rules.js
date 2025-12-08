#!/usr/bin/env node

/**
 * Wrapper script for standard-version to handle .ai/ folder versioning
 *
 * This script:
 * 1. Checks if .ai/ files were changed in the last commit
 * 2. Skips if it's a version bump commit (to avoid loops)
 * 3. Runs standard-version to update versions
 */

const { execSync } = require('child_process');

// Get the last commit message
function getLastCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error('Error getting commit message:', error.message);
    process.exit(1);
  }
}

// Check if .ai/ files were changed in the last commit
function hasAiFilesChanged() {
  try {
    const changedFiles = execSync(
      'git diff-tree --no-commit-id --name-only -r HEAD',
      {
        encoding: 'utf-8',
      },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    return changedFiles.some((file) => file.startsWith('.ai/'));
  } catch (error) {
    // If no previous commit, assume files changed
    return true;
  }
}

// Check if this is a version bump commit (to avoid infinite loops)
function isVersionBumpCommit(commitMessage) {
  const message = commitMessage.toLowerCase();
  return (
    message.includes('bump') &&
    (message.includes('version') || message.includes('ai rules'))
  );
}

// Check if this is a standard-version commit
function isStandardVersionCommit(commitMessage) {
  const message = commitMessage.toLowerCase();
  return (
    message.includes('chore(release)') ||
    message.includes('chore: release') ||
    message.includes('standard-version')
  );
}

// Main execution
function main() {
  // Get commit message first to check if it's a version bump
  const commitMessage = getLastCommitMessage();
  console.log(`📝 Commit message: ${commitMessage.split('\n')[0]}`);

  // Skip if this is a version bump commit (to avoid infinite loops)
  if (
    isVersionBumpCommit(commitMessage) ||
    isStandardVersionCommit(commitMessage)
  ) {
    console.log('ℹ Version bump commit detected, skipping version update');
    process.exit(0);
  }

  // Check if .ai/ files were changed
  if (!hasAiFilesChanged()) {
    console.log(
      'ℹ No .ai/ files changed in last commit, skipping version update',
    );
    process.exit(0);
  }

  // Determine version bump type from commit message
  const commitType = commitMessage.match(
    /^(feat|fix|refactor|docs|style|test|chore|perf|build|ci)(\(.+\))?:/i,
  );
  let releaseType = 'patch'; // default

  if (
    commitMessage.toLowerCase().includes('breaking change') ||
    commitMessage.toLowerCase().includes('breaking:')
  ) {
    releaseType = 'major';
  } else if (commitType && commitType[1].toLowerCase() === 'feat') {
    releaseType = 'minor';
  }

  console.log(`📦 Version bump type: ${releaseType}`);

  // Run standard-version (without committing, we'll do that manually)
  console.log('🔄 Running standard-version for .ai/ folder...');
  try {
    execSync(`npx standard-version --release-as ${releaseType} --skip.commit`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Version update complete');
    console.log("💡 Don't forget to commit the version changes!");
  } catch (error) {
    console.error('❌ Error running standard-version:', error.message);
    process.exit(1);
  }
}

main();
