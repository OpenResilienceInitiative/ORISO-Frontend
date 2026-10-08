import { describe, expect, it } from 'vitest';
import {
	getAgenciesOfferingFormat,
	getAvailableFormats,
	getConversationFormatAvailability,
	isGroupChatTranslationAvailable,
	resolveInitialStep
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
	});

	// Master switch: featureGroupChatV2Enabled === false turns both formats
	// off on its level, whatever the format flags say. Format flags only
	// refine an enabled v2.
	it('lets featureGroupChatV2Enabled === false switch both formats off', () => {
		expect(
			getConversationFormatAvailability({
				settings: {
					featureGroupChatV2Enabled: false,
					featureInternalGroupChatEnabled: true,
					featureSelfHelpGroupsEnabled: true
				} as any
			})
		).toEqual({ internal: false, circle: false });
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

describe('resolveInitialStep', () => {
	const both = { internal: true, circle: true };
	const internalOnly = { internal: true, circle: false };
	const circleOnly = { internal: false, circle: true };

	it('forces the circle step for a duplicate occurrence only when circle is available', () => {
		expect(resolveInitialStep(both, ['internal', 'circle'], true)).toBe(
			'circle'
		);
		// Finding 7: a duplicate must not force circle when it is disabled.
		expect(resolveInitialStep(internalOnly, ['internal'], true)).toBe(
			'internal'
		);
	});

	it('skips the picker when a single format is available', () => {
		expect(resolveInitialStep(internalOnly, ['internal'], false)).toBe(
			'internal'
		);
		expect(resolveInitialStep(circleOnly, ['circle'], false)).toBe(
			'circle'
		);
	});

	it('opens the picker when several formats are available', () => {
		expect(resolveInitialStep(both, ['internal', 'circle'], false)).toBe(
			'picker'
		);
	});
});

// #1440: a Beratungsstelle can only restrict what the Träger allows. The
// agency settings come from the public agency response and already carry the
// effective values (Träger AND Beratungsstelle combined).
describe('getConversationFormatAvailability with the counsellor’s agencies', () => {
	const tenantAllowsBoth = {
		settings: { featureGroupChatV2Enabled: true } as any
	};

	it('drops the circle format when the only agency switched circles off', () => {
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{
					id: 1,
					settings: {
						featureGroupChatV2Enabled: true,
						featureInternalGroupChatEnabled: true,
						featureSelfHelpGroupsEnabled: false
					}
				}
			])
		).toEqual({ internal: true, circle: false });
	});

	it('treats null agency values as no restriction', () => {
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{
					id: 1,
					settings: {
						featureGroupChatV2Enabled: null,
						featureInternalGroupChatEnabled: null,
						featureSelfHelpGroupsEnabled: null
					}
				}
			])
		).toEqual({ internal: true, circle: true });
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{ id: 1, settings: null },
				{ id: 2 }
			])
		).toEqual({ internal: true, circle: true });
	});

	it('never lets an agency enable what the Träger switched off', () => {
		expect(
			getConversationFormatAvailability(
				{
					settings: {
						featureGroupChatV2Enabled: true,
						featureSelfHelpGroupsEnabled: false
					} as any
				},
				[
					{
						id: 1,
						settings: {
							featureGroupChatV2Enabled: true,
							featureInternalGroupChatEnabled: true,
							featureSelfHelpGroupsEnabled: true
						}
					}
				]
			)
		).toEqual({ internal: true, circle: false });
		expect(
			getConversationFormatAvailability(
				{ settings: { featureGroupChatV2Enabled: false } as any },
				[{ id: 1, settings: { featureGroupChatV2Enabled: true } }]
			)
		).toEqual({ internal: false, circle: false });
	});

	it('falls back to the agency’s featureGroupChatV2Enabled per format', () => {
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{ id: 1, settings: { featureGroupChatV2Enabled: false } }
			])
		).toEqual({ internal: false, circle: false });
	});

	it('lets an agency’s featureGroupChatV2Enabled === false switch both formats off', () => {
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{
					id: 1,
					settings: {
						featureGroupChatV2Enabled: false,
						featureInternalGroupChatEnabled: true,
						featureSelfHelpGroupsEnabled: true
					}
				}
			])
		).toEqual({ internal: false, circle: false });
		expect(
			getAgenciesOfferingFormat(
				tenantAllowsBoth,
				[
					{
						id: 1,
						settings: {
							featureGroupChatV2Enabled: false,
							featureInternalGroupChatEnabled: true
						}
					},
					{ id: 2, settings: { featureGroupChatV2Enabled: null } }
				],
				'internal'
			)
		).toEqual([2]);
	});

	it('offers a format as long as one of several agencies allows it', () => {
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{
					id: 1,
					settings: {
						featureInternalGroupChatEnabled: true,
						featureSelfHelpGroupsEnabled: false
					}
				},
				{
					id: 2,
					settings: {
						featureInternalGroupChatEnabled: false,
						featureSelfHelpGroupsEnabled: true
					}
				}
			])
		).toEqual({ internal: true, circle: true });
	});

	it('offers nothing when every agency switched both formats off', () => {
		const off = {
			featureInternalGroupChatEnabled: false,
			featureSelfHelpGroupsEnabled: false
		};
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, [
				{ id: 1, settings: off },
				{ id: 2, settings: off }
			])
		).toEqual({ internal: false, circle: false });
	});

	it('offers only the target agency’s formats when one is given', () => {
		const agencies = [
			{
				id: 1,
				settings: {
					featureInternalGroupChatEnabled: true,
					featureSelfHelpGroupsEnabled: false
				}
			},
			{
				id: 2,
				settings: {
					featureInternalGroupChatEnabled: false,
					featureSelfHelpGroupsEnabled: true
				}
			}
		];
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, agencies, 1)
		).toEqual({ internal: true, circle: false });
		expect(
			getConversationFormatAvailability(tenantAllowsBoth, agencies, 2)
		).toEqual({ internal: false, circle: true });
	});

	it('offers nothing when the target agency is missing from a non-empty source', () => {
		expect(
			getConversationFormatAvailability(
				tenantAllowsBoth,
				[
					{
						id: 1,
						settings: {
							featureInternalGroupChatEnabled: true,
							featureSelfHelpGroupsEnabled: true
						}
					}
				],
				99
			)
		).toEqual({ internal: false, circle: false });
	});
});

describe('getAgenciesOfferingFormat', () => {
	const agencies = [
		{
			id: 1,
			settings: {
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: false
			}
		},
		{ id: 2, settings: { featureSelfHelpGroupsEnabled: true } },
		{ id: 3 }
	];

	it('lists the agencies that allow a format, keeping unknown ones', () => {
		const tenant = { settings: { featureGroupChatV2Enabled: true } as any };
		expect(getAgenciesOfferingFormat(tenant, agencies, 'circle')).toEqual([
			2, 3
		]);
		expect(getAgenciesOfferingFormat(tenant, agencies, 'internal')).toEqual(
			[1, 2, 3]
		);
	});

	it('lists none when the Träger switched the format off', () => {
		expect(
			getAgenciesOfferingFormat(
				{
					settings: {
						featureGroupChatV2Enabled: true,
						featureSelfHelpGroupsEnabled: false
					} as any
				},
				agencies,
				'circle'
			)
		).toEqual([]);
	});
});
