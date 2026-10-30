import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.local/**', '.superpowers/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  { files: ['**/*.ts','**/*.tsx'], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
);
