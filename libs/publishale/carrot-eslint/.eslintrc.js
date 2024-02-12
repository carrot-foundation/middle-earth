const { createBaseEslintConfig } = require('../../../.eslint/eslint.base.config');

module.exports = { ...createBaseEslintConfig({ projectPath: __dirname }) };

