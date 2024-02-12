const path = require('path');

function createBaseEslintConfig({ projectPath, overrides = [] }) {
  return {
    extends: [path.join(__dirname, '../.eslintrc.js')],
    ignorePatterns: ['!**/*', 'src/generated/'],
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        rules: {
          'import/no-extraneous-dependencies': [
            'error',
            { packageDir: `${process.cwd()}` },
          ],
        },
      },
      {
        files: ['*.ts', '*.tsx'],
        parserOptions: {
          project: `${projectPath}/tsconfig.lint.json`,
          ecmaVersion: 2023,
          lib: ['es2022'],
        },
      },
      ...overrides,
    ],
  };
}

module.exports = {
  createBaseEslintConfig,
};
