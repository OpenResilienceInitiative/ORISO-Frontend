// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scss = () =>
	fs.readFileSync(
		path.join(
			process.cwd(),
			'src/components/inputField/inputField.styles.scss'
		),
		'utf8'
	);

describe('InputField icon adornment', () => {
	it('keeps the start icon in document flow so MUI reserves input inset', () => {
		const withIcon = scss().match(
			/&--withIcon\s*&[\s\S]*?&__icon\s*\{([^}]+)\}/
		);
		expect(withIcon?.[1]).toBeTruthy();
		expect(withIcon?.[1]).not.toMatch(/position:\s*absolute/);
	});

	it('does not ship dead pre-MUI input/label rules', () => {
		const source = scss();
		expect(source).not.toMatch(/&__input\s*\{/);
		expect(source).not.toMatch(/&__label\s*\{/);
	});
});
