import { describe, expect, it } from 'vite-plus/test';
import { agencyForTopic, getDirectLinkMedia } from './directLinkAvailability';

describe('getDirectLinkMedia', () => {
	it('allows every medium while nothing is set (TenantService default)', () => {
		expect(getDirectLinkMedia({ settings: {} })).toEqual([
			'CHAT',
			'AUDIO',
			'VIDEO'
		]);
		expect(getDirectLinkMedia(null)).toEqual(['CHAT', 'AUDIO', 'VIDEO']);
	});

	it('drops a medium the Träger switched off', () => {
		expect(
			getDirectLinkMedia({
				settings: { featureDirectInviteVideoEnabled: false }
			})
		).toEqual(['CHAT', 'AUDIO']);
	});

	it('offers nothing when every medium is off, so the card hides', () => {
		expect(
			getDirectLinkMedia({
				settings: {
					featureDirectInviteChatEnabled: false,
					featureDirectInviteAudioEnabled: false,
					featureDirectInviteVideoEnabled: false
				}
			})
		).toEqual([]);
	});

	it('keeps a medium one of several Beratungsstellen still allows', () => {
		expect(
			getDirectLinkMedia({ settings: {} }, [
				{ id: 1, settings: { featureDirectInviteChatEnabled: false } },
				{ id: 2, settings: { featureDirectInviteChatEnabled: null } }
			] as never)
		).toEqual(['CHAT', 'AUDIO', 'VIDEO']);
		expect(
			getDirectLinkMedia({ settings: {} }, [
				{ id: 1, settings: { featureDirectInviteAudioEnabled: false } }
			] as never)
		).toEqual(['CHAT', 'VIDEO']);
	});

	it('never lets a Beratungsstelle reopen what the Träger closed', () => {
		expect(
			getDirectLinkMedia(
				{ settings: { featureDirectInviteChatEnabled: false } },
				[
					{
						id: 1,
						settings: { featureDirectInviteChatEnabled: true }
					}
				] as never
			)
		).toEqual(['AUDIO', 'VIDEO']);
	});
});

describe('agencyForTopic', () => {
	it('sends no agency for a counsellor of one Beratungsstelle', () => {
		expect(agencyForTopic([{ id: 4, topicIds: [1] }], 1)).toBeUndefined();
	});

	it('names the Beratungsstelle that offers the topic', () => {
		expect(
			agencyForTopic(
				[
					{ id: 4, topicIds: [1] },
					{ id: 9, topicIds: [2, 3] }
				],
				3
			)
		).toBe(9);
	});
});
