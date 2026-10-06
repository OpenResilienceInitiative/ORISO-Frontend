import de from '../resources/i18n/de/common.json';

/**
 * Test-only `t` backed by the real German bundle, so a missing or misspelled
 * practice key fails the test instead of printing the key. `extra` adds copy
 * that is not shipped yet (e.g. the tour titles of the stub tours).
 */
export const makeTranslate =
	(extra: Record<string, string> = {}) =>
	(key: string, options?: Record<string, unknown>): string => {
		const raw =
			extra[key] ??
			key
				.split('.')
				.reduce<unknown>(
					(node, part) =>
						node && typeof node === 'object'
							? (node as Record<string, unknown>)[part]
							: undefined,
					de
				);
		if (typeof raw !== 'string') {
			return key;
		}
		return raw.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
			String(options?.[name] ?? '')
		);
	};
