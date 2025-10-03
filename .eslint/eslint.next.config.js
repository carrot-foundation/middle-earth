const { getBaseEslintConfig } = require('./eslint.base.config');
const nextPlugin = require('@next/eslint-plugin-next');

const { fixupPluginRules } = require('@eslint/compat');

function getNextEslintConfig({ projectPath, overrides = [] }) {
  const baseConfig = getBaseEslintConfig({ projectPath });

  return [
    ...baseConfig,
    {
      ignores: ['**/*.json', '**/.next/*', '**/public/sw.js'],
    },
    {
      plugins: {
        '@next/next': fixupPluginRules(nextPlugin),
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'import/extensions': [
          'error',
          {
            js: 'never',
            mjs: 'never',
            jsx: 'never',
            ts: 'never',
            tsx: 'never',
          },
        ],
      },
    },
    {
      files: ['jest.config.ts', 'vite.config.mts'],
      rules: {
        'import/no-relative-packages': 'off',
      },
    },
    {
      files: ['**/next-env.d.ts'],
      rules: {
        'unicorn/prevent-abbreviations': 'off',
      },
    },
    {
      files: ['**/next.config.js'],
      rules: {
        'import/no-commonjs': 'off',
        'dot-notation': 'off',
      },
    },
    {
      files: ['**/*'],
      rules: {
        '@next/next/no-html-link-for-pages': [
          'error',
          `${projectPath}/src/pages/`,
        ],
      },
    },
    ...overrides,
  ];
}

module.exports = {
  getNextEslintConfig,
};
