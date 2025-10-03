const {
  getNextEslintConfig,
} = require('../../../../.eslint/eslint.next.config');

module.exports = getNextEslintConfig({
  overrides: [
    {
      files: ['**/*'],
      rules: {
        '@next/next/no-html-link-for-pages': ['error', 'apps/web/src/pages/'],
      },
    },
  ],
  projectPath: __dirname,
});
