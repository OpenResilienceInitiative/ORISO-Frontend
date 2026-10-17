// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import de from '../../../resources/i18n/de/common.json';
import en from '../../../resources/i18n/en/common.json';
import fr from '../../../resources/i18n/fr/common.json';
import ru from '../../../resources/i18n/ru/common.json';
import ti from '../../../resources/i18n/ti/common.json';
import tr from '../../../resources/i18n/tr/common.json';
import { INTERNAL_SUBSET_REASON } from '../../../api/apiCreateInternalSubsetChat';
import {
	INTERNAL_SUBSET_NOTICE_KEYS,
	internalSubsetErrorKey,
	recipientScopeHintKey
} from './internalSubsetMessages';

const catalogues = { de, en, fr, ru, ti, tr } as const;

const lookup = (catalogue: unknown, key: string): unknown =>
	key.split('.').reduce<any>((node, part) => node?.[part], catalogue);

const reasons = Object.values(INTERNAL_SUBSET_REASON);
const scopes = ['AGENCY', 'TENANT', 'PLATFORM'] as const;

describe('internal subset chat messages', () => {
	it('has a message for every refusal code the endpoint can answer with', () => {
		expect(new Set(reasons.map(internalSubsetErrorKey)).size).toBe(
			reasons.length
		);
	});

	it.each(Object.entries(catalogues))(
		'%s: every refusal, scope hint and notice reads as real copy',
		(_locale, catalogue) => {
			const keys = [
				...reasons.map(internalSubsetErrorKey),
				...scopes.map(recipientScopeHintKey),
				...INTERNAL_SUBSET_NOTICE_KEYS
			];
			keys.forEach((key) => {
				const text = lookup(catalogue, key);
				expect(text, key).toEqual(expect.any(String));
				expect((text as string).trim(), key).not.toBe('');
			});
		}
	);
});
