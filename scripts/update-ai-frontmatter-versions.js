#!/usr/bin/env node

/**
 * Updates YAML frontmatter versions in .ai/ rule files
 * This script runs as a standard-version prerelease hook
 * to sync frontmatter versions with manifest.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AI_DIR = path.join(process.cwd(), '.ai');
const MANIFEST_PATH = path.join(AI_DIR, 'manifest.json');

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// Get version from manifest.json
function getVersionFromManifest() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    return manifest.version;
  } catch (error) {
    console.error('Error reading manifest.json:', error.message);
    process.exit(1);
  }
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
  // Note: This runs as a standard-version prerelease hook
  // standard-version updates manifest.json first, then we read the new version
  const newVersion = getVersionFromManifest();
  console.log(`🔄 Updating frontmatter versions to ${newVersion}`);

  const ruleFiles = findRuleFiles();
  console.log(`📄 Found ${ruleFiles.length} rule files to update`);

  ruleFiles.forEach((filePath) => {
    updateRuleFile(filePath, newVersion);
  });

  // Also update lastUpdated in manifest.json
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    manifest.lastUpdated = getCurrentDate();

    // Update all rule versions in manifest
    Object.values(manifest.rules).forEach((category) => {
      Object.values(category).forEach((rule) => {
        rule.version = newVersion;
      });
    });

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✓ Updated manifest.json metadata`);
  } catch (error) {
    console.error('Error updating manifest.json metadata:', error.message);
  }

  console.log(`✅ Frontmatter versions updated to ${newVersion}`);
}

main();

