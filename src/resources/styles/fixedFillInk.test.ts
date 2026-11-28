// @vitest-environment node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'postcss-scss';
import { describe, expect, it } from 'vite-plus/test';

const scssFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return scssFiles(path);
		return name.endsWith('.scss') ? [path] : [];
	});

const BACKGROUND = /^background(?:-color)?$/;
const FIXED_FILL = /^var\(--(?:m3|oriso)-primary-fixed[,)]/;
const FIXED_ONLY_INK =
	/^var\(--m3-(?:primary-container|on-secondary-fixed-variant)[,)]/;
const FOREGROUND = /^(?:color|(?:border|outline)(?:-[\w-]+)?|fill|stroke)$/;
const FIRST_ROLE = /var\(\s*(--[\w-]+)/;
const FIXED_DIM = /^--(?:m3|oriso)-primary-fixed-dim$/;

const contrastOffenders = (scss: string): number[] => {
	const lines: number[] = [];
	parse(scss).walkDecls((decl) => {
		const isBackground = BACKGROUND.test(decl.prop);
		const parent = decl.parent;
		const incompatibleInk =
			isBackground &&
			FIXED_FILL.test(decl.value) &&
			parent?.nodes.some(
				(sibling) =>
					sibling.type === 'decl' &&
					sibling.prop === 'color' &&
					FIXED_ONLY_INK.test(sibling.value)
			);
		const standaloneHighlight =
			isBackground &&
			parent?.type === 'rule' &&
			parent.selector.includes('::highlight(');
		const fixedDimForeground =
			(FOREGROUND.test(decl.prop) || standaloneHighlight) &&
			FIXED_DIM.test(decl.value.match(FIRST_ROLE)?.[1] ?? '');
		if ((incompatibleInk || fixedDimForeground) && decl.source) {
			lines.push(decl.source.start.line);
		}
	});
	return lines;
};

describe('fixed brand fill contrast', () => {
	it('checks only direct declarations of a rule', () => {
		expect(
			contrastOffenders(`
			.chip {
				background: var(--m3-primary-fixed);
				.label {
					background: var(--m3-on-primary-container);
					color: var(--m3-primary-container);
				}
			}
		`)
		).toEqual([]);
		expect(
			contrastOffenders(`
			.chip {
				background: var(--m3-primary-fixed);
				color: var(--m3-primary-container);
			}
		`)
		).toEqual([3]);
	});

	it('allows fixed-dim fills and fallbacks while rejecting standalone foregrounds', () => {
		expect(
			contrastOffenders(`
			.chip {
				background: var(--m3-primary-fixed-dim);
				color: var(--m3-on-primary-fixed);
				border-color: var(--oriso-outline-rest, var(--m3-primary-fixed-dim));
			}
			.outline { border: 1px solid var(--m3-primary-fixed-dim); }
			.icon { color: var(--oriso-primary-fixed-dim); }
			::highlight(hit) { background-color: var(--m3-primary-fixed-dim); }
		`)
		).toEqual([7, 8, 9]);
	});

	it('keeps fixed-dim on fills and uses readable ink on fixed brand fills', () => {
		const offenders = scssFiles('src').flatMap((file) =>
			contrastOffenders(readFileSync(file, 'utf8')).map(
				(line) => `${relative(process.cwd(), file)}:${line}`
			)
		);
		expect(offenders).toEqual([]);
	});
});
