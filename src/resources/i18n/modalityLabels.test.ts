import { describe, expect, it } from 'vitest';
import deCommon from './de/common.json';
import deInformalCommon from './de@informal/common.json';
import enCommon from './en/common.json';

/**
 * The asynchronous agency modality is called "Mail" in the product language
 * (ORISO-Frontend#985). "Nähe" was rejected by the counselling practitioners,
 * so no filter chip or list label may fall back to it again.
 */

type ChipLabels = { nearby: string; chats: string };

const chips = (bundle: unknown): ChipLabels =>
	(bundle as { sessionList: { toolbar: { chips: ChipLabels } } }).sessionList
		.toolbar.chips;

describe('agency counselling modality label (ORISO-Frontend#985)', () => {
	it('labels the modality "Mail" for German counsellors', () => {
		expect(chips(deCommon).nearby).toBe('Mail');
		expect(chips(deCommon).chats).toBe('Mail');
	});

	it('labels the modality "Mail" in the informal German variant', () => {
		expect(chips(deInformalCommon).nearby).toBe('Mail');
		expect(chips(deInformalCommon).chats).toBe('Mail');
	});

	it('labels the modality "Mail" in English', () => {
		expect(chips(enCommon).nearby).toBe('Mail');
		expect(chips(enCommon).chats).toBe('Mail');
	});
});
