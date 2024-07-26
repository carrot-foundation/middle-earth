module.exports = {
  branches: ['main'],
  extends: 'semantic-release-npm-github-publish',
  preset: 'conventionalcommits',
  plugins: [
    '@semantic-release/github',
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      { preset: 'conventionalcommits' },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: `./CHANGELOG.md`,
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [`libs/**/package.json`, `package.json`, `CHANGELOG.md`],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
};
