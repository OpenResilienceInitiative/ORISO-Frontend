import { describe, expect, it } from 'vitest';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE,
	parseErstantwortPayload
} from './erstantwortPayload';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';

const buildEvent = (payload: unknown) =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify(payload)}`;

const validPayload = {
	type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
	version: ERSTANTWORT_PAYLOAD_VERSION,
	bausteine: [
		{ id: 'greeting', body: 'Schön, dass Sie da sind.' },
		{
			id: 'responseDeadline',
			headline: 'Wann Sie eine Antwort erhalten',
			body: 'Sie erhalten innerhalb von 2 Werktagen eine Antwort.'
		},
		{
			id: 'emailNotification',
			body: 'Sie können eine E-Mail-Adresse hinterlegen.',
			action: { kind: 'ADD_EMAIL', label: 'E-Mail hinterlegen' }
		}
	]
};

describe('parseErstantwortPayload', () => {
	it('parses a valid v1 FIRST_RESPONSE event into its Bausteine', () => {
		const result = parseErstantwortPayload(buildEvent(validPayload));

		expect(result.status).toBe('ok');
		expect(result.bausteine).toHaveLength(3);
		expect(result.bausteine[0]).toMatchObject({
			id: 'greeting',
			body: 'Schön, dass Sie da sind.'
		});
		expect(result.bausteine[2].action).toEqual({
			kind: 'ADD_EMAIL',
			label: 'E-Mail hinterlegen'
		});
	});

	it('returns "none" for a message that is not a FIRST_RESPONSE event', () => {
		expect(
			parseErstantwortPayload(
				buildEvent({ type: 'USER_LEFT_CHAT', version: 1 })
			).status
		).toBe('none');
		expect(parseErstantwortPayload('gewöhnliche Nachricht').status).toBe(
			'none'
		);
		expect(parseErstantwortPayload(undefined).status).toBe('none');
	});

	it('degrades gracefully on a newer payload version instead of rendering it wrongly', () => {
		const result = parseErstantwortPayload(
			buildEvent({
				...validPayload,
				version: ERSTANTWORT_PAYLOAD_VERSION + 1
			})
		);

		expect(result.status).toBe('unsupported-version');
		expect(result.bausteine).toEqual([]);
		expect(result.version).toBe(ERSTANTWORT_PAYLOAD_VERSION + 1);
	});

	it('rejects every version that is not exactly the supported one', () => {
		/* `> VERSION` used to let 0, -1 and 0.5 through and render them as v1 —
		   an unknown wire format rendered as if it were understood. */
		[0, -1, 0.5, ERSTANTWORT_PAYLOAD_VERSION - 1].forEach((version) => {
			const result = parseErstantwortPayload(
				buildEvent({ ...validPayload, version })
			);
			expect(result.status, `version ${version}`).toBe(
				'unsupported-version'
			);
			expect(result.bausteine).toEqual([]);
		});
	});

	it('treats a missing or non-numeric version as unsupported rather than assuming v1', () => {
		expect(
			parseErstantwortPayload(
				buildEvent({
					type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
					bausteine: []
				})
			).status
		).toBe('unsupported-version');
	});

	it('drops Bausteine that carry no renderable body', () => {
		const result = parseErstantwortPayload(
			buildEvent({
				...validPayload,
				bausteine: [
					{ id: 'greeting', body: 'Hallo.' },
					{ id: 'broken' },
					{ id: '', body: 'ohne id' },
					{ id: 'empty', body: '   ' }
				]
			})
		);

		expect(result.status).toBe('ok');
		expect(result.bausteine.map((baustein) => baustein.id)).toEqual([
			'greeting'
		]);
	});

	it('ignores an action whose kind the frontend does not know', () => {
		const result = parseErstantwortPayload(
			buildEvent({
				...validPayload,
				bausteine: [
					{
						id: 'greeting',
						body: 'Hallo.',
						action: { kind: 'LAUNCH_ROCKET', label: 'Start' }
					}
				]
			})
		);

		expect(result.bausteine[0].action).toBeUndefined();
	});

	it('survives a payload that is not valid JSON', () => {
		expect(
			parseErstantwortPayload(`${SYSTEM_NOTIFICATION_PREFIX}{nope`).status
		).toBe('none');
	});

	it('keeps derived link targets, dropping non-http targets', () => {
		const result = parseErstantwortPayload(
			buildEvent({
				...validPayload,
				bausteine: [
					{
						id: 'dataProtection',
						body: 'Details finden Sie hier.',
						links: [
							{ label: 'Datenschutz', url: 'https://x.test/dpp' },
							{
								label: 'Böse',
								// eslint-disable-next-line no-script-url -- the hostile input under test
								url: 'javascript:alert(1)'
							},
							{ label: 'Ohne URL' }
						]
					}
				]
			})
		);

		expect(result.bausteine[0].links).toEqual([
			{ label: 'Datenschutz', url: 'https://x.test/dpp' }
		]);
	});
});
