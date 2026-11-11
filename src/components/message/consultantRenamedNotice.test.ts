import { describe, expect, it } from 'vite-plus/test';
import {
	consultantRenamedNoticeText,
	parseConsultantRenamedNotice
} from './consultantRenamedNotice';
import {
	parseMessagePrefixes,
	SYSTEM_NOTIFICATION_PREFIX
} from './messageConstants';

const renamed = (extra: Record<string, unknown>) => ({
	type: 'CONSULTANT_RENAMED',
	oldName: 'Frau Alt.',
	newName: 'Frau Neu.',
	...extra
});

describe('CONSULTANT_RENAMED notice (OBP 2.1 #119, ORISO-UserService#1533)', () => {
	it('reads the old and the new name', () => {
		expect(parseConsultantRenamedNotice(renamed({}))).toEqual({
			oldName: 'Frau Alt.',
			newName: 'Frau Neu.'
		});
	});

	it('trims both names', () => {
		expect(
			parseConsultantRenamedNotice(
				renamed({ oldName: ' Frau Alt. ', newName: ' Frau Neu. ' })
			)
		).toEqual({ oldName: 'Frau Alt.', newName: 'Frau Neu.' });
	});

	it.each([
		['another type', { type: 'USER_LEFT_CHAT' }],
		['no old name', { oldName: undefined }],
		['a blank new name', { newName: '   ' }],
		['a non-string name', { newName: 42 }],
		['the same name after trimming', { newName: '  Frau Alt. ' }]
	])('ignores a payload with %s', (_label, extra) => {
		expect(parseConsultantRenamedNotice(renamed(extra))).toBeNull();
	});

	it.each([null, undefined, 'CONSULTANT_RENAMED', 7])(
		'ignores %j',
		(payload) => {
			expect(parseConsultantRenamedNotice(payload)).toBeNull();
		}
	);

	it('words the notice through i18n with both names', () => {
		const translate = (key: string, options?: Record<string, unknown>) =>
			options ? `${key}|${options.oldName}|${options.newName}` : key;

		expect(
			consultantRenamedNoticeText(
				{ oldName: 'Frau Alt.', newName: 'Frau Neu.' },
				translate
			)
		).toEqual({
			title: 'message.consultantRenamedTitle',
			description:
				'message.consultantRenamedDescription|Frau Alt.|Frau Neu.'
		});
	});

	it('is exposed by parseMessagePrefixes for the raw event body', () => {
		const parsed = parseMessagePrefixes(
			`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify(renamed({}))}`
		);
		expect(parsed.isSystemNotification).toBe(true);
		expect(parsed.systemNotificationConsultantRenamed).toEqual({
			oldName: 'Frau Alt.',
			newName: 'Frau Neu.'
		});
	});

	it('is null on every other system notification', () => {
		const parsed = parseMessagePrefixes(
			`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
				type: 'USER_LEFT_CHAT',
				username: 'x'
			})}`
		);
		expect(parsed.systemNotificationConsultantRenamed).toBeNull();
	});
});
