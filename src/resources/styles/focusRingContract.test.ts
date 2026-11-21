// @vitest-environment node

/**
 * Guard for the keyboard focus ring contract (Frontend#1134, ADR-037).
 * The visual guard is the Storybook story Design Tokens/Focus ring contract;
 * this test keeps the stylesheets from drifting back to colours that fail in
 * one scheme.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const scssFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return scssFiles(path);
		return name.endsWith('.scss') ? [path] : [];
	});

/** Intentional exceptions, each with its reason. */
const ALLOWED = new Map<string, string>([
	[
		'src/components/call/GroupCallWidget.scss',
		'the group-call stage is always dark video; its trigger keeps a white ring'
	],
	[
		'src/components/messageSubmitInterface/inputField/sendButton.styles.scss',
		'the filled send button gets its inner on-primary ring in Frontend#2451; drop this entry there'
	]
]);

describe('focus ring contract', () => {
	const settings = read('src/resources/styles/settings.scss');
	const listItemSelection = read(
		'src/resources/styles/_listItemSelection.scss'
	);

	it('draws $focus-outline with the themed primary role', () => {
		expect(settings).toMatch(
			/\$focus-ring-color: var\(--oriso-focus-ring-color, var\(--m3-primary,/
		);
		expect(settings).toMatch(
			/\$focus-outline: \$focus-ring-width solid \$focus-ring-color;/
		);
		expect(settings).not.toMatch(/\$focus-outline:[^;]*\$focus-blue/);
	});

	it('lets the control mixins read the same ring', () => {
		expect(listItemSelection).toMatch(
			/\$control-focus-ring-color: \$focus-ring-color !default;/
		);
		expect(listItemSelection).toMatch(
			/@mixin control-focus-ring-on-fill\(/
		);
	});

	it('switches the ring to on-primary on the primary-painted login stage', () => {
		expect(read('src/components/stage/stage.styles.scss')).toMatch(
			/\.stage \{[^}]*--oriso-focus-ring-color: var\(--m3-on-primary,/
		);
	});

	it('keeps colours that fail in a scheme out of every outline', () => {
		const offenders = scssFiles(resolve(root, 'src'))
			.map((path) => relative(root, path))
			.filter((path) => !ALLOWED.has(path))
			.flatMap((path) =>
				read(path)
					.split('\n')
					.map((line, index) => ({
						path,
						// A token's literal fallback is not the drawn colour.
						line: line.replace(/,\s*#[0-9a-f]{3,8}\s*\)/gi, ')'),
						index
					}))
			)
			.filter(({ line }) =>
				/^\s*outline:[^;]*(--m3-primary-outline|#199fff|\$focus-blue|#fff\b|#ffffff\b|\bwhite\b)/i.test(
					line
				)
			)
			.map(
				({ path, index, line }) => `${path}:${index + 1} ${line.trim()}`
			);

		expect(offenders).toEqual([]);
	});
});
