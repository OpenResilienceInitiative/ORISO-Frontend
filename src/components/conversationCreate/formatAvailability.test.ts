import { describe, expect, it } from 'vitest';
import {
	getAvailableFormats,
	getConversationFormatAvailability,
	isGroupChatTranslationAvailable
} from './formatAvailability';

describe('getConversationFormatAvailability', () => {
	it('falls back to featureGroupChatV2Enabled for both formats', () => {
		expect(
			getConversationFormatAvailability({
				settings: { featureGroupChatV2Enabled: true } as any
			})
		).toEqual({ internal: true, circle: true });
		expect(
			getConversationFormatAvailability({
				settings: { featureGroupChatV2Enabled: false } as any
			})
		).toEqual({ internal: false, circle: false });
	});

	it('lets dedicated per-format flags win over the fallback', () => {
		expect(
			getConversationFormatAvailability({
				settings: {
					featureGroupChatV2Enabled: true,
					featureSelfHelpGroupsEnabled: false
				} as any
			})
		).toEqual({ internal: true, circle: false });
		expect(
			getConversationFormatAvailability({
				settings: {
					featureGroupChatV2Enabled: false,
					featureInternalGroupChatEnabled: true
				} as any
			})
		).toEqual({ internal: true, circle: false });
	});

	it('treats a missing tenant as nothing enabled', () => {
		expect(getConversationFormatAvailability(null)).toEqual({
			internal: false,
			circle: false
		});
	});
});

describe('getAvailableFormats', () => {
	it('lists the enabled formats in picker order', () => {
		expect(getAvailableFormats({ internal: true, circle: true })).toEqual([
			'internal',
			'circle'
		]);
		expect(getAvailableFormats({ internal: false, circle: true })).toEqual([
			'circle'
		]);
		expect(getAvailableFormats({ internal: false, circle: false })).toEqual(
			[]
		);
	});
});

describe('isGroupChatTranslationAvailable', () => {
	it('defaults to available until the backend exposes the key signal', () => {
		expect(isGroupChatTranslationAvailable(null)).toBe(true);
	});

	it('honours a dedicated flag once present', () => {
		expect(
			isGroupChatTranslationAvailable({
				settings: { featureGroupChatTranslationEnabled: false } as any
			})
		).toBe(false);
	});
});
