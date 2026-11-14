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
								resolve(process.cwd(), 'node_modules', url.slice(1))
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
