import { describe, expect, it } from 'vitest';
import {
	assertNoPracticeWrites,
	findPracticeWrites,
	RecordedNetworkRequest
} from './assertNoPracticeWrites';

const USER_SERVICE = 'https://dev.oriso.test';
const TUTORIAL_PROGRESS_URL = `${USER_SERVICE}/service/users/tutorials/progress`;
const TOKEN_URL =
	'https://auth.oriso.test/auth/realms/online-beratung/protocol/openid-connect/token';
const MATRIX = 'https://matrix.oriso.test/_matrix/client/v3';
const TOUR_ID = 'consultant-practice-accept';

const config = {
	allowedTourIds: [TOUR_ID],
	tutorialProgressUrl: TUTORIAL_PROGRESS_URL,
	tokenRefreshUrl: TOKEN_URL
};

const progress = (tourId = TOUR_ID): RecordedNetworkRequest => ({
	method: 'PUT',
	url: TUTORIAL_PROGRESS_URL,
	postData: JSON.stringify({
		surface: 'frontend',
		tourId,
		status: 'completed'
	})
});

describe('assertNoPracticeWrites (what the browser really sent)', () => {
	it('passes for no requests and for reads only', () => {
		expect(() => assertNoPracticeWrites([], config)).not.toThrow();
		expect(() =>
			assertNoPracticeWrites(
				[
					{
						method: 'GET',
						url: `${USER_SERVICE}/service/users/sessions`
					},
					{
						method: 'GET',
						url: `${MATRIX}/sync?since=s1&timeout=30000`
					},
					{ method: 'HEAD', url: `${USER_SERVICE}/x` },
					{
						method: 'OPTIONS',
						url: `${USER_SERVICE}/service/users/data`
					}
				],
				config
			)
		).not.toThrow();
	});

	it('passes for the two allowlisted writes and nothing else', () => {
		expect(() =>
			assertNoPracticeWrites(
				[
					progress(),
					{
						method: 'POST',
						url: TOKEN_URL,
						postData:
							'refresh_token=a.b.c&client_id=app&grant_type=refresh_token'
					}
				],
				config
			)
		).not.toThrow();
	});

	it.each([
		['an accept', 'POST', `${USER_SERVICE}/service/users/sessions/new/42`],
		['a heartbeat', 'PATCH', `${USER_SERVICE}/service/users/data`],
		[
			'an e-mail change (Erstantwort overlay)',
			'PUT',
			`${USER_SERVICE}/service/users/email`
		],
		['a delete', 'DELETE', `${USER_SERVICE}/service/users/sessions/42`],
		[
			'a Matrix message send',
			'PUT',
			`${MATRIX}/rooms/!r:matrix.oriso.test/send/m.room.message/m1`
		],
		[
			'a Matrix read receipt',
			'POST',
			`${MATRIX}/rooms/!r:matrix.oriso.test/receipt/m.read/$e`
		],
		[
			'a Matrix typing notice',
			'PUT',
			`${MATRIX}/rooms/!r:matrix.oriso.test/typing/@u:matrix.oriso.test`
		],
		[
			'a Matrix account_data write',
			'PUT',
			`${MATRIX}/user/@u:matrix.oriso.test/account_data/m.fully_read`
		],
		['a Matrix join', 'POST', `${MATRIX}/join/!r:matrix.oriso.test`],
		['a telemetry export', 'POST', 'https://otel.oriso.test/v1/metrics']
	])('fails for %s', (_label, method, url) => {
		expect(() =>
			assertNoPracticeWrites([{ method, url, postData: '{}' }], config)
		).toThrow(/1 write/);
		expect(findPracticeWrites([{ method, url }], config)).toEqual([
			{ method, url, reason: 'default-deny' }
		]);
	});

	it('fails for the progress of another tour, and for a body that was not captured', () => {
		expect(
			findPracticeWrites([progress('consultant-walkthrough')], config)
		).toEqual([
			{
				method: 'PUT',
				url: TUTORIAL_PROGRESS_URL,
				reason: 'body-rejected'
			}
		]);
		expect(
			findPracticeWrites(
				[{ method: 'PUT', url: TUTORIAL_PROGRESS_URL, postData: null }],
				config
			)
		).toHaveLength(1);
	});

	it('fails for the password grant on the token URL', () => {
		expect(
			findPracticeWrites(
				[
					{
						method: 'POST',
						url: TOKEN_URL,
						postData:
							'username=a&password=b&client_id=app&grant_type=password'
					}
				],
				config
			)
		).toHaveLength(1);
	});

	it('names every violation with method and URL, never the query or body', () => {
		let message = '';
		try {
			assertNoPracticeWrites(
				[
					{
						method: 'POST',
						url: `${USER_SERVICE}/service/users/a?token=secret`,
						postData: '{"password":"hunter2"}'
					},
					{
						method: 'DELETE',
						url: `${USER_SERVICE}/service/users/b`
					},
					progress()
				],
				config
			);
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toContain('2 write');
		expect(message).toContain(`POST ${USER_SERVICE}/service/users/a`);
		expect(message).toContain(`DELETE ${USER_SERVICE}/service/users/b`);
		expect(message).not.toMatch(/secret|hunter2|tutorials\/progress/);
	});

	it('treats a relative URL as unparseable, so it cannot hide a write', () => {
		expect(
			findPracticeWrites(
				[{ method: 'POST', url: '/service/users/x' }],
				config
			)
		).toEqual([
			{ method: 'POST', url: '[unparseable]', reason: 'unparseable-url' }
		]);
	});
});
