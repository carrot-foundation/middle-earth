const {
  getBaseEslintConfig,
} = require('../../../../.eslint/eslint.base.config');

module.exports = getBaseEslintConfig({
  projectPath: __dirname,
});
