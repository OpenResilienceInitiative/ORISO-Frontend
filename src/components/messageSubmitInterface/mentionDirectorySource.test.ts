import { describe, expect, it } from 'vite-plus/test';
import { Modality } from '../session/getModality';
import { mentionDirectorySource } from './mentionDirectorySource';

describe('mentionDirectorySource', () => {
	it('names an internal colleague chat from its room, not from a centre (FE#1211)', () => {
		expect(
			mentionDirectorySource({
				isAskerOnly: false,
				modality: Modality.INTERNAL_GROUP,
				agencyId: ''
			})
		).toBe('room');
	});

	it('keeps the agency list for a counselling conversation', () => {
		expect(
			mentionDirectorySource({
				isAskerOnly: false,
				modality: Modality.AGENCY_COUNSELLING,
				agencyId: '12'
			})
		).toBe('agency');
	});

	it('still reports a counselling conversation without a centre as missing', () => {
		expect(
			mentionDirectorySource({
				isAskerOnly: false,
				modality: Modality.AGENCY_COUNSELLING,
				agencyId: ''
			})
		).toBe('missing');
	});

	it('offers no list to advice seekers or in anonymous live chats', () => {
		expect(
			mentionDirectorySource({
				isAskerOnly: true,
				modality: Modality.INTERNAL_GROUP,
				agencyId: ''
			})
		).toBe('none');
		expect(
			mentionDirectorySource({
				isAskerOnly: false,
				modality: Modality.LIVE_CHAT,
				agencyId: '12'
			})
		).toBe('none');
	});
});
