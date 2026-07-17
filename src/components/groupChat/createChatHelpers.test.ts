import { describe, expect, it } from 'vitest';
import {
	buildGroupChatEditDraft,
	buildGroupChatSeriesRequest,
	buildOneOffDuplicateFields,
	isGroupChatFeatureEnabled
} from './createChatHelpers';

describe('isGroupChatFeatureEnabled', () => {
	it('fails closed unless the tenant explicitly enables group chat v2', () => {
		expect(isGroupChatFeatureEnabled(undefined)).toBe(false);
		expect(isGroupChatFeatureEnabled({ settings: undefined })).toBe(false);
		expect(
			isGroupChatFeatureEnabled({
				settings: { featureGroupChatV2Enabled: false }
			})
		).toBe(false);
		expect(
			isGroupChatFeatureEnabled({
				settings: { featureGroupChatV2Enabled: true }
			})
		).toBe(true);
	});
});

describe('buildGroupChatSeriesRequest', () => {
	it('builds an explicit finite text-only one-off Series', () => {
		expect(
			buildGroupChatSeriesRequest({
				topic: 'Peer support',
				agencyId: 17,
				startDate: '2026-08-04',
				startTime: '18:30',
				duration: 90,
				repeatCount: 1,
				chatInterval: 'WEEKLY',
				modality: 'TEXT',
				timezone: 'Europe/Berlin',
				hintMessage: 'Welcome',
				consultantIds: []
			})
		).toEqual({
			topic: 'Peer support',
			agencyId: 17,
			startDate: '2026-08-04',
			startTime: '18:30',
			duration: 90,
			repetitive: false,
			repeatCount: 1,
			modality: 'TEXT',
			timezone: 'Europe/Berlin',
			hintMessage: 'Welcome',
			consultantIds: [],
			featureGroupChatV2Enabled: true
		});
	});

	it('builds a finite recurring Series with its explicit interval', () => {
		expect(
			buildGroupChatSeriesRequest({
				topic: 'Peer support',
				agencyId: 17,
				startDate: '2026-08-04',
				startTime: '18:30',
				duration: 90,
				repeatCount: 4,
				chatInterval: 'BIWEEKLY',
				modality: 'VIDEO',
				timezone: 'Europe/Berlin',
				hintMessage: 'Welcome',
				consultantIds: ['co-mod-1']
			})
		).toMatchObject({
			repetitive: true,
			repeatCount: 4,
			chatInterval: 'BIWEEKLY',
			modality: 'VIDEO'
		});
	});

	it('does not submit blank group rules that the API rejects', () => {
		const request = buildGroupChatSeriesRequest({
			topic: 'Peer support',
			agencyId: 17,
			startDate: '2026-08-04',
			startTime: '18:30',
			duration: 60,
			repeatCount: 1,
			chatInterval: 'WEEKLY',
			modality: 'AUDIO',
			timezone: 'Europe/Berlin',
			hintMessage: '',
			groupChatRulesTranslations: { de: ['', '  ', '  Respect  '] },
			consultantIds: []
		});

		expect(request.groupChatRulesTranslations).toEqual({
			de: ['Respect']
		});
	});

	it('omits group rules when every locale contains only blanks', () => {
		const request = buildGroupChatSeriesRequest({
			topic: 'Peer support',
			agencyId: 17,
			startDate: '2026-08-04',
			startTime: '18:30',
			duration: 60,
			repeatCount: 1,
			chatInterval: 'WEEKLY',
			modality: 'TEXT',
			timezone: 'Europe/Berlin',
			hintMessage: '',
			groupChatRulesTranslations: { de: ['', '  '] },
			consultantIds: []
		});

		expect(request.groupChatRulesTranslations).toBeUndefined();
	});
});

describe('buildOneOffDuplicateFields', () => {
	it('prefills a skipped virtual occurrence as a standalone one-off Series', () => {
		expect(
			buildOneOffDuplicateFields({
				topic: 'Peer support',
				start: '2026-09-21T18:30:00',
				duration: 90,
				modality: 'VIDEO'
			})
		).toEqual({
			topic: 'Peer support',
			startDate: '2026-09-21',
			startTime: '18:30',
			duration: 90,
			repeatCount: 1,
			interval: 'WEEKLY',
			modality: 'VIDEO'
		});
	});

	it('rejects an invalid occurrence start instead of producing NaN fields', () => {
		expect(() =>
			buildOneOffDuplicateFields({
				topic: 'Peer support',
				start: 'not-a-date',
				duration: 90,
				modality: 'TEXT'
			})
		).toThrow('A valid occurrence start is required for duplication');
	});
});

describe('buildGroupChatEditDraft', () => {
	// A fully-configured recurring series item, as it arrives on the session
	// list (GroupChatItemInterface). Editing must round-trip every field so a
	// schedule edit never silently wipes author content.
	const fullSeriesItem = {
		topic: 'Angehörige von Suchtkranken',
		duration: 90,
		startDate: '2026-09-21',
		startTime: '18:30',
		startDateWithTime: '2026-09-21T18:30:00',
		repetitive: true,
		repeatCount: 8,
		chatInterval: 'BIWEEKLY' as const,
		modality: 'VIDEO' as const,
		hintMessage: 'Willkommen',
		sourceLanguage: 'de',
		hintMessageTranslations: { de: 'Willkommen', en: 'Welcome' },
		groupChatRulesTranslations: {
			de: ['Sei freundlich', 'Bleib beim Thema'],
			en: ['Be kind']
		},
		participants: [
			{ consultantId: 'consultant-a' },
			{ consultantId: 'consultant-b' }
		],
		assignedAgencies: [{ id: 42 }]
	};

	it('maps every schedule field, agency and participants from the item', () => {
		const draft = buildGroupChatEditDraft(fullSeriesItem);
		expect(draft.topic).toBe('Angehörige von Suchtkranken');
		expect(draft.agencyId).toBe(42);
		expect(draft.seriesFields).toEqual({
			startDate: '2026-09-21',
			startTime: '18:30',
			duration: 90,
			repeatCount: 8,
			interval: 'BIWEEKLY',
			modality: 'VIDEO'
		});
		expect(draft.consultantIds).toEqual(['consultant-a', 'consultant-b']);
	});

	it('preserves existing hint + rule translations so a schedule edit cannot wipe them', () => {
		const draft = buildGroupChatEditDraft(fullSeriesItem);
		expect(draft.authorContent.sourceLanguage).toBe('de');
		expect(draft.authorContent.hintMessageTranslations).toEqual({
			de: 'Willkommen',
			en: 'Welcome'
		});
		expect(draft.authorContent.groupChatRulesTranslations).toEqual({
			de: ['Sei freundlich', 'Bleib beim Thema'],
			en: ['Be kind']
		});
	});

	it('derives date and time from startDateWithTime', () => {
		const draft = buildGroupChatEditDraft({
			...fullSeriesItem,
			startDateWithTime: '2027-01-05T09:05:00'
		});
		expect(draft.seriesFields.startDate).toBe('2027-01-05');
		expect(draft.seriesFields.startTime).toBe('09:05');
	});

	it('falls back to a single-language hint map when translations are absent', () => {
		const draft = buildGroupChatEditDraft({
			topic: 'One-off',
			duration: 60,
			startDate: '2026-09-21',
			startDateWithTime: '2026-09-21T18:30:00',
			hintMessage: 'Nur Deutsch',
			sourceLanguage: 'de'
		});
		expect(draft.authorContent.hintMessageTranslations).toEqual({
			de: 'Nur Deutsch'
		});
		expect(draft.authorContent.groupChatRulesTranslations).toEqual({
			de: ['']
		});
	});

	it('defaults repeatCount/interval/modality and empty participants for a bare item', () => {
		const draft = buildGroupChatEditDraft({
			topic: 'Bare',
			duration: 30,
			startDate: '2026-09-21',
			startDateWithTime: '2026-09-21T18:30:00'
		});
		expect(draft.seriesFields.repeatCount).toBe(1);
		expect(draft.seriesFields.interval).toBe('WEEKLY');
		expect(draft.seriesFields.modality).toBe('TEXT');
		expect(draft.agencyId).toBeNull();
		expect(draft.consultantIds).toEqual([]);
	});

	it('rejects an item without a valid start instead of producing NaN fields', () => {
		expect(() =>
			buildGroupChatEditDraft({
				topic: 'Broken',
				duration: 60,
				startDate: 'not-a-date'
			})
		).toThrow('A valid series start is required to edit the schedule');
	});
});
