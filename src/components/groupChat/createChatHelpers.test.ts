import { describe, expect, it } from 'vitest';
import {
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
			groupChatRulesTranslations: { de: ['', '  ', 'Respect'] },
			consultantIds: []
		});

		expect(request.groupChatRulesTranslations).toEqual({
			de: ['Respect']
		});
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
