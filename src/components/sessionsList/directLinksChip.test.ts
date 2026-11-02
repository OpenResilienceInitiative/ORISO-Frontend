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
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

/**
 * FE#1952 (Frank, 2026-10-30): conversations that came in through a
 * counsellor direct link get their own "Direktlinks" chip and leave "Mail".
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

describe('the "Direktlinks" chip (FE#1952)', () => {
	const video = row({ directLinkMedium: 'VIDEO' });
	const chat = row({ directLinkMedium: 'CHAT' });
	const mail = row();

	it('knows which conversations came in through a direct link', () => {
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

	it('shows only direct-link conversations', () => {
		expect(matches(video, 'directLinks')).toBe(true);
		expect(matches(chat, 'directLinks')).toBe(true);
		expect(matches(mail, 'directLinks')).toBe(false);
	});

	it('takes them out of "Mail"', () => {
		expect(matches(video, 'nearby')).toBe(false);
		expect(matches(chat, 'nearby')).toBe(false);
		expect(matches(mail, 'nearby')).toBe(true);
	});

	it('keeps the open conversation visible whatever chip is on', () => {
		expect(
			sessionMatchesToolbar(
				mail.raw,
				mail.extended,
				'',
				'directLinks',
				[],
				[],
				ME,
				true
			)
		).toBe(true);
	});

	it('survives the URL as ?chip=directLinks', () => {
		expect(normalizeSessionToolbarChip('directLinks')).toBe('directLinks');
	});

	it('is its own display-filter kind, right after Mail-Beratung', () => {
		expect(classifySession(video.raw, video.extended, ME, true)).toBe(
			'directLinks'
		);
		expect(classifySession(mail.raw, mail.extended, ME, true)).toBe(
			'oneToOne'
		);
		expect(SESSION_KIND_CHIP.directLinks).toBe('directLinks');
		expect(
			SESSION_KIND_ORDER.indexOf('directLinks' as never) -
				SESSION_KIND_ORDER.indexOf('oneToOne')
		).toBe(1);
		expect(SESSION_KIND_ICONS.directLinks).toBeDefined();
	});

	it.each([
		['de', de, 'Direktlinks'],
		['en', en, 'Direct links'],
		['fr', fr, 'Liens directs'],
		['ru', ru, 'Прямые ссылки'],
		['ti', ti, undefined],
		['tr', tr, 'Doğrudan bağlantılar']
	])('is named in %s', (_lng, catalogue, expected) => {
		const label = (catalogue as any).sessionList.toolbar.chips.directLinks;
		expect(typeof label).toBe('string');
		expect(label.trim()).not.toBe('');
		if (expected) expect(label).toBe(expected);
	});
});
