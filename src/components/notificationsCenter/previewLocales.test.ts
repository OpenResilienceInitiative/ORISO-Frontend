import { describe, expect, it } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

/** #1824: every text of the writable preview exists in all six languages. */
const KEYS = [
	'composerPlaceholder',
	'markRead',
	'markedRead',
	'openToReply',
	'archivedOpenToReply',
	'notJoined',
	'supervisorNoComposer',
	'teamClosed',
	'curtained',
	'backToConversation',
	'sendFailed'
];

/** Keys of the first #1824 draft that nothing renders any more. */
const RETIRED = [
	'inputLabel',
	'editLabel',
	'saveEdit',
	'cancelEdit',
	'send',
	'groupPending',
	'coAccess'
];

describe.each([
	['de', de],
	['en', en],
	['fr', fr],
	['ru', ru],
	['ti', ti],
	['tr', tr]
])('writable preview texts (%s)', (_name, catalogue) => {
	it.each(RETIRED)('no longer carries "%s"', (key) => {
		expect(
			(catalogue as any).notifications?.center?.preview?.[key]
		).toBeUndefined();
	});

	it.each(KEYS)('has a non-empty "%s"', (key) => {
		const value = (catalogue as any).notifications?.center?.preview?.[key];
		expect(typeof value).toBe('string');
		expect(value.trim().length).toBeGreaterThan(0);
	});
});
