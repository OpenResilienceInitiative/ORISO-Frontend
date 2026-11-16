// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileString } from 'sass';
import { describe, expect, it } from 'vite-plus/test';

// As the build compiles it: with the shared settings in front.
const file = resolve(
	process.cwd(),
	'src/components/calendar/calendar.styles.scss'
);
const settings = resolve(process.cwd(), 'src/resources/styles/settings.scss');
const css = compileString(
	`@import "${settings}"; ${readFileSync(file, 'utf8')}`,
	{
		url: pathToFileURL(file),
		logger: { warn: () => undefined },
		// webpack's "~package/…" imports from node_modules.
		importers: [
			{
				findFileUrl: (url: string) =>
					url.startsWith('~')
						? pathToFileURL(
								resolve(
									process.cwd(),
									'node_modules',
									url.slice(1)
								)
							)
						: null
			}
		]
	}
).css;

/** Positions of the rules that set `--cal-kind` for a selector. */
const kindRules = (selector: RegExp) =>
	Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
		.filter(
			([, selectors, body]) =>
				/--cal-kind\s*:/.test(body) &&
				selectors.split(',').some((s) => selector.test(s.trim()))
		)
		.map((m) => m.index ?? 0);

describe('calendar kind colours (review 4574775682)', () => {
	it.each([
		['calEntry', 'calEntry--k-phone'],
		['calendarPeek', 'calendarPeek--k-phone'],
		['calendarSide__row', 'calendarSide__row--k-phone'],
		['calendarQuick__kind', 'calendarQuick__kind--k-phone']
	])('lets .%s take the colour of its kind modifier', (base, modifier) => {
		const defaults = kindRules(new RegExp(`^\\.${base}$`));
		const [kind] = kindRules(new RegExp(`^\\.${modifier}$`));
		expect(defaults.length).toBeGreaterThan(0);
		expect(kind).toBeDefined();
		// Same specificity: the rule that comes later wins.
		defaults.forEach((at) => expect(at).toBeLessThan(kind));
	});
});

describe('calendar kind colours are neutral (Frank, prototype v15)', () => {
	/** The value a custom property gets in the rule that defines the kinds. */
	const kindValues = () => {
		const block = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).find(
			([, , body]) => /--cal-kind-video\s*:/.test(body)
		);
		expect(block).toBeDefined();
		const body = block![2];
		const value = (name: string): string => {
			const raw = new RegExp(`--cal-kind-${name}\\s*:\\s*([^;]+);`)
				.exec(body)?.[1]
				.trim();
			expect(raw).toBeDefined();
			// Follow var(--cal-kind-…) to the value it names.
			const ref = /^var\(--cal-kind-([a-z]+)\)$/.exec(raw!);
			return ref ? value(ref[1]) : raw!;
		};
		return ['video', 'phone', 'onsite', 'chat', 'group', 'blocker'].map(
			value
		);
	};

	it('gives every kind the same grey, so only the icon tells them apart', () => {
		const values = kindValues();
		expect(new Set(values).size).toBe(1);
		expect(values[0]).toContain('#444748');
	});
});

describe('calendar scrollbars (Frank, prototype v15)', () => {
	/** The selectors of every rule that sets `property: value`. */
	const selectorsWith = (property: string, value: string) =>
		Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
			.filter(([, , body]) =>
				new RegExp(`${property}\\s*:\\s*${value}`).test(body)
			)
			.flatMap(([, selectors]) =>
				selectors.split(',').map((x) => x.trim())
			);

	it('hides the scrollbar of the time grid and the split view, keeping them scrollable', () => {
		const hidden = selectorsWith('scrollbar-width', 'none');
		expect(hidden).toContain('.calendarView *');
		expect(hidden).toContain('.calendarSplit__scroll');
		const webkit = selectorsWith('display', 'none');
		expect(webkit).toContain('.calendarView *::-webkit-scrollbar');
		expect(webkit).toContain('.calendarSplit__scroll::-webkit-scrollbar');
		// Scrolling itself stays on.
		expect(
			selectorsWith('overflow', 'auto').includes('.calendarSplit__scroll')
		).toBe(true);
	});
});

describe('quick entry fields (Frank, prototype v15)', () => {
	const rule = (selector: string) =>
		Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).find(([, sel]) =>
			sel.split(',').some((s) => s.trim() === selector)
		)?.[2] ?? '';

	it('puts Tag on its own row and Beginn and Dauer side by side', () => {
		expect(rule('.calendarQuick__when')).toMatch(
			/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/
		);
		expect(rule('.calendarQuick__when > .calendarQuick__day')).toMatch(
			/grid-column:\s*1\s*\/\s*-1/
		);
	});

	it('gives quick entry its own white box (prototype v17)', () => {
		const box = rule('.calendarQuick');
		expect(box).toMatch(/padding:\s*18px 12px 16px/);
		expect(box).toMatch(/border-radius:\s*22px/);
		expect(box).toMatch(/background:\s*var\(--m3-surface-container-lowest/);
	});
});
