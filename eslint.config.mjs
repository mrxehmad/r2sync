import obsidianmd from 'eslint-plugin-obsidianmd';
import tseslint from 'typescript-eslint';

export default [
	// TypeScript and project-specific configuration
	{
		files: ['**/*.ts'],
		ignores: [
			'node_modules/**',
			'main.js',
			'*.json',
			'esbuild.config.mjs',
			'version-bump.mjs'
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'obsidianmd': obsidianmd,
		},
		rules: {
			// TypeScript rules
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-prototype-builtins': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'@typescript-eslint/no-duplicate-type-constituents': 'off',

			// Obsidian-specific rule customizations (all from recommended, but you can override)
			// Command rules
			'obsidianmd/commands/no-command-in-command-id': 'error',
			'obsidianmd/commands/no-command-in-command-name': 'error',
			'obsidianmd/commands/no-default-hotkeys': 'warn',
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',

			// Memory leak prevention
			'obsidianmd/detach-leaves': 'error',
			'obsidianmd/no-plugin-as-component': 'error',
			'obsidianmd/no-view-references-in-plugin': 'error',

			// Best practices
			'obsidianmd/no-forbidden-elements': 'error',
			'obsidianmd/no-static-styles-assignment': 'warn',
			'obsidianmd/no-tfile-tfolder-cast': 'error',
			'obsidianmd/prefer-file-manager-trash-file': 'error',
			'obsidianmd/vault/iterate': 'error',

			// Code quality
			'obsidianmd/no-sample-code': 'error',
			'obsidianmd/sample-names': 'error',
			'obsidianmd/hardcoded-config-path': 'error',
			'obsidianmd/object-assign': 'warn',
			'obsidianmd/platform': 'error',
			'obsidianmd/regex-lookbehind': 'error',

			// Settings tab best practices
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',

			// UI conventions (sentence case)
			'obsidianmd/ui/sentence-case': ['warn', {
				// Add your brand names and acronyms here
				brands: ['R2Sync', 'Cloudflare', 'R2'],
				acronyms: ['AWS', 'S3', 'API', 'URL', 'ID'],
				// Set to true to enforce lowercase for CamelCase words
				enforceCamelCaseLower: false,
				// Enable auto-fix (will change text when running eslint --fix)
				allowAutoFix: true,
			}],

			// Validation rules
			'obsidianmd/validate-license': 'error',
			'obsidianmd/validate-manifest': 'error',

			// Advanced: prefer built-in APIs
			'obsidianmd/prefer-abstract-input-suggest': 'warn',
		},
	},

	// Optional: If you have English locale files (en.json, en.ts, etc.)
	// Uncomment to enable stricter sentence case checks for locale files
	{
		files: ['**/en*.json', '**/en*.ts', '**/en*.js', '**/en/**/*'],
		rules: {
			'obsidianmd/ui/sentence-case-json': 'warn',
			'obsidianmd/ui/sentence-case-locale-module': 'warn',
		},
	},
];