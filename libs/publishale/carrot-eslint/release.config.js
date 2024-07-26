const name = 'carrot-eslint';
const sourceRoot = 'libs/publishale/carrot-eslint';

module.exports = {
  branches: ['main'],
  commitPaths: [`${sourceRoot}/*`],
  extends: 'semantic-release-npm-github-publish',
  pkgRoot: `dist/${name}`,
  plugins: [
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changeLogFile: `${sourceRoot}/CHANGELOG.md`,
      },
    ],
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: [`${sourceRoot}}CHANGELOG.md`, `${sourceRoot}/package.json`],
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
