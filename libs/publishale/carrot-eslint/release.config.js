module.exports = {
  branches: ['main'],
  commitPaths: ['libs/publishale/carrot-eslint/*'],
  extends: '../../../release.config.base.js',
  pkgRoot: 'dist/carrot-eslint',
  plugins: [
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changeLogFile: 'libs/publishable/carrot-eslint/CHANGELOG.md',
      },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message:
          'release(version): Release carrot-eslint ' +
          // eslint-disable-next-line no-template-curly-in-string
          '${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
  // eslint-disable-next-line no-template-curly-in-string
  tagFormat: 'carrot-eslint@${version}',
};
