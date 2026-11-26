import { describe, expect, it } from 'vite-plus/test';
import {
	isDirectLinkSession,
	normalizeSessionToolbarChip,
	sessionMatchesToolbar
} from './sessionToolbarFilters';
import {
	classifySession,
	SESSION_KIND_CHIP,
	SESSION_KIND_ORDER
} from '../../utils/displayFilter/sessions';
import { SESSION_KIND_ICONS } from '../displayFilter/kindOptions';
import { emailSettingForKind } from '../displayFilter/emailSettingForKind';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

/**
 * FE#2546 (Frank, 2026-11-25): a conversation that came in through a
 * Direkteinladung is a Mail-Beratung case. It has no chip or display-filter
 * kind of its own; the row only names the channel. This revokes the decision
 * of 2026-10-30 (FE#1952) that gave it its own chip.
 */
const ME = 'consultant-me';
const row = (overrides: Record<string, unknown> = {}) => {
	const raw = {
		consultant: { id: ME },
		user: { username: 'Ruhiges Yak' },
		session: {
			id: 1,
			matrixRoomId: '!room:hs',
			messagesRead: true,
			conversationType: 'AGENCY_COUNSELLING',
			...overrides
		}
	} as any;
	return { raw, extended: { isGroup: false, item: raw.session } as any };
};
const matches = (pair: ReturnType<typeof row>, chip: any) =>
	sessionMatchesToolbar(pair.raw, pair.extended, '', chip, [], [], ME);

describe('direct-invitation cases are Mail-Beratung (FE#2546)', () => {
	const video = row({ directLinkMedium: 'VIDEO' });
	const audio = row({ directLinkMedium: 'AUDIO' });
	const chat = row({ directLinkMedium: 'CHAT' });
	const mail = row();

	it('still knows which conversations came in through a direct link', () => {
		expect(isDirectLinkSession(video.raw)).toBe(true);
		expect(isDirectLinkSession(chat.raw)).toBe(true);
		expect(isDirectLinkSession(mail.raw)).toBe(false);
		// A live chat never carries a direct-link origin, whatever a field says.
		expect(
			isDirectLinkSession(
				row({
					conversationType: 'LIVE_CHAT',
					directLinkMedium: 'VIDEO'
				}).raw
			)
		).toBe(false);
	});

	it('shows them under the Mail chip', () => {
		expect(matches(video, 'nearby')).toBe(true);
		expect(matches(audio, 'nearby')).toBe(true);
		expect(matches(chat, 'nearby')).toBe(true);
		expect(matches(mail, 'nearby')).toBe(true);
	});

	it('classifies them as one-to-one, the Mail-Beratung kind', () => {
		for (const pair of [video, audio, chat, mail]) {
			expect(classifySession(pair.raw, pair.extended, ME, true)).toBe(
				'oneToOne'
			);
		}
	});

	it('has no chip or display-filter kind of its own any more', () => {
		expect(SESSION_KIND_ORDER).not.toContain('directLinks');
		expect(SESSION_KIND_CHIP).not.toHaveProperty('directLinks');
		expect(SESSION_KIND_ICONS).not.toHaveProperty('directLinks');
		expect(
			emailSettingForKind('sessions', 'directLinks', 'consultant')
		).toBeNull();
	});

	it('opens a saved or linked ?chip=directLinks on the Mail chip', () => {
		expect(normalizeSessionToolbarChip('directLinks')).toBe('nearby');
	});

	it.each([
		['de', de, ['Video', 'Audio', 'Chat'], 'Direkteinladung · {{medium}}'],
		[
			'en',
			en,
			['Video', 'Audio', 'Chat'],
			'Direct invitation · {{medium}}'
		],
		['fr', fr, ['Vidéo', 'Audio', 'Chat'], undefined],
		['ru', ru, ['Видео', 'Аудио', 'Чат'], undefined],
		['ti', ti, [undefined, undefined, undefined], undefined],
		['tr', tr, ['Görüntülü', 'Sesli', 'Sohbet'], undefined]
	])(
		'names the channel with one pattern in %s',
		(_lng, catalogue, media, via) => {
			const types = (catalogue as any).sessionList.item.sessionType;
			const values = [
				types.directLinkVideo,
				types.directLinkAudio,
				types.directLinkChat
			];
			values.forEach((value, index) => {
				expect(typeof value).toBe('string');
				expect(value.trim()).not.toBe('');
				if (media[index]) expect(value).toBe(media[index]);
			});
			expect(types.directInvitationVia).toContain('{{medium}}');
			if (via) expect(types.directInvitationVia).toBe(via);
			expect(
				(catalogue as any).sessionList.toolbar.chips.directLinks
			).toBeUndefined();
		}
	);
});
