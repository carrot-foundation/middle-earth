module.exports = {
  '*': 'prettier --write --ignore-unknown',
  '**/*.{[jt]s?(x),yaml,json}': 'eslint --fix',
  '*': 'cspell --no-must-find-files',
  'package.json': 'npmPkgJsonLint .'
}
