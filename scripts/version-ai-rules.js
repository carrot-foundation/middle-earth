#!/usr/bin/env node

/**
 * Automated versioning script for .ai/ rules
 *
 * Analyzes commit messages and updates version numbers in:
 * - .ai/manifest.json (global version)
 * - Individual rule files (frontmatter versions)
 *
 * Version bump logic:
 * - BREAKING CHANGE: major version bump
 * - feat: minor version bump
 * - fix, refactor, docs, style, test: patch version bump
 * - Only updates if .ai/ files were changed in the commit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AI_DIR = path.join(process.cwd(), '.ai');
const MANIFEST_PATH = path.join(AI_DIR, 'manifest.json');

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

// Determine version bump type from commit message
function getVersionBumpType(commitMessage) {
  const message = commitMessage.toLowerCase();

  // Check for breaking changes
  if (
    message.includes('breaking change') ||
    message.includes('breaking:') ||
    commitMessage.includes('BREAKING CHANGE:')
  ) {
    return 'major';
  }

  // Parse conventional commit format: type(scope): description
  const conventionalCommitMatch = commitMessage.match(/^(\w+)(?:\([^)]+\))?:/);

  if (conventionalCommitMatch) {
    const type = conventionalCommitMatch[1].toLowerCase();

    switch (type) {
      case 'feat':
        return 'minor';
      case 'fix':
      case 'refactor':
      case 'docs':
      case 'style':
      case 'test':
      case 'chore':
      case 'perf':
      case 'build':
      case 'ci':
        return 'patch';
      default:
        return 'patch';
    }
  }

  // Default to patch if no conventional commit format
  return 'patch';
}

// Increment version based on bump type
function incrementVersion(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// Update manifest.json
function updateManifest(newVersion) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  manifest.version = newVersion;
  manifest.lastUpdated = getCurrentDate();

  // Update all rule versions in manifest
  Object.values(manifest.rules).forEach((category) => {
    Object.values(category).forEach((rule) => {
      rule.version = newVersion;
    });
  });

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ Updated manifest.json to version ${newVersion}`);
}

// Find all rule markdown files
function findRuleFiles() {
  const ruleFiles = [];

  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (
        file.endsWith('.md') &&
        !file.includes('README') &&
        !file.includes('instructions')
      ) {
        ruleFiles.push(filePath);
      }
    }
  }

  walkDir(path.join(AI_DIR, 'categories'));
  return ruleFiles;
}

// Update frontmatter in a markdown file
function updateRuleFile(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match YAML frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;

  if (!frontmatterRegex.test(content)) {
    console.warn(`⚠ Warning: ${filePath} does not have frontmatter, skipping`);
    return;
  }

  const updatedContent = content.replace(
    frontmatterRegex,
    (match, frontmatter) => {
      let updated = frontmatter;

      // Update version
      if (updated.includes('version:')) {
        updated = updated.replace(
          /^version:\s*['"]?([^'"]+)['"]?$/m,
          `version: '${newVersion}'`,
        );
      } else {
        updated = `version: '${newVersion}'\n${updated}`;
      }

      // Update lastUpdated
      if (updated.includes('lastUpdated:')) {
        updated = updated.replace(
          /^lastUpdated:\s*['"]?([^'"]+)['"]?$/m,
          `lastUpdated: '${getCurrentDate()}'`,
        );
      } else {
        updated = `lastUpdated: '${getCurrentDate()}'\n${updated}`;
      }

      return `---\n${updated}\n---\n`;
    },
  );

  fs.writeFileSync(filePath, updatedContent);
}

// Main execution
function main() {
  // Get commit message first to check if it's a version bump
  const commitMessage = getLastCommitMessage();
  console.log(`📝 Commit message: ${commitMessage.split('\n')[0]}`);

  // Skip if this is a version bump commit (to avoid infinite loops)
  if (isVersionBumpCommit(commitMessage)) {
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

  // Determine version bump
  const bumpType = getVersionBumpType(commitMessage);
  console.log(`📦 Version bump type: ${bumpType}`);

  // Read current manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ manifest.json not found');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const currentVersion = manifest.version || '1.0.0';
  const newVersion = incrementVersion(currentVersion, bumpType);

  if (currentVersion === newVersion) {
    console.log('ℹ Version unchanged');
    process.exit(0);
  }

  console.log(`🔄 Updating version: ${currentVersion} → ${newVersion}`);

  // Update manifest.json
  updateManifest(newVersion);

  // Update all rule files
  const ruleFiles = findRuleFiles();
  console.log(`📄 Found ${ruleFiles.length} rule files to update`);

  ruleFiles.forEach((filePath) => {
    updateRuleFile(filePath, newVersion);
  });

  console.log(`✅ Version update complete: ${newVersion}`);
  console.log(`\n💡 Don't forget to commit the version changes!`);
}

main();
