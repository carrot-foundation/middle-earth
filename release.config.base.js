module.exports = {
  branches: ['main'],
  extends: 'semantic-release-npm-github-publish',
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      { preset: 'conventionalcommits' },
    ],
    '@semantic-release/github',
  ],
};
