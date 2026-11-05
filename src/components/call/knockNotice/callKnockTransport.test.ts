// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FETCH_ERRORS } from '../../../api/fetchData';
import type { CallKnock } from './callKnockModel';
import {
	callKnockScopeOf,
	clampPage,
	knockerName,
	newKnockIds,
	scopeQuery
} from './callKnockModel';
import {
	CallKnockApi,
	createHttpCallKnockTransport
} from './callKnockTransport';

const knock = (
	id: number,
	status: CallKnock['status'] = 'PENDING'
): CallKnock => ({
	id,
	sessionId: 500 + id,
	status,
	medium: 'VIDEO',
	requestedAt: '2026-10-28T10:00:00Z'
});

const api = (overrides: Partial<CallKnockApi> = {}): CallKnockApi => ({
	listPending: vi.fn().mockResolvedValue([]),
	admit: vi.fn().mockResolvedValue(knock(1, 'ADMITTED')),
	decline: vi.fn().mockResolvedValue(knock(1, 'DECLINED')),
	admitAll: vi.fn().mockResolvedValue([]),
	...overrides
});

const SCOPE = { matrixRoomId: '!call:matrix.test' };

const flush = async () => {
	for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('createHttpCallKnockTransport (#1892)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('reports pending knocks at once and only when they change', async () => {
		const listPending = vi
			.fn()
			.mockResolvedValueOnce([knock(1), knock(2, 'ADMITTED')])
			.mockResolvedValueOnce([knock(1)])
			.mockResolvedValueOnce([knock(1), knock(3)]);
		const onChange = vi.fn();
		const stop = createHttpCallKnockTransport({
			api: api({ listPending }),
			intervalMs: 1000
		}).watchPending(SCOPE, onChange);

		await flush();
		expect(onChange).toHaveBeenLastCalledWith([knock(1)]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(onChange).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(onChange).toHaveBeenCalledTimes(2);
		expect(onChange).toHaveBeenLastCalledWith([knock(1), knock(3)]);
		stop();
		await vi.advanceTimersByTimeAsync(5000);
		expect(listPending).toHaveBeenCalledTimes(3);
		expect(listPending).toHaveBeenCalledWith(SCOPE);
	});

	it.each([FETCH_ERRORS.NO_MATCH, FETCH_ERRORS.FORBIDDEN])(
		'stops asking after %s',
		async (status) => {
			const listPending = vi.fn().mockRejectedValue(new Error(status));
			createHttpCallKnockTransport({
				api: api({ listPending }),
				intervalMs: 1000
			}).watchPending(SCOPE, vi.fn());
			await flush();
			await vi.advanceTimersByTimeAsync(5000);
			expect(listPending).toHaveBeenCalledTimes(1);
		}
	);

	it('keeps asking after a transient error', async () => {
		const listPending = vi
			.fn()
			.mockRejectedValueOnce(new Error(FETCH_ERRORS.CATCH_ALL))
			.mockResolvedValue([knock(1)]);
		const onChange = vi.fn();
		createHttpCallKnockTransport({
			api: api({ listPending }),
			intervalMs: 1000
		}).watchPending(SCOPE, onChange);
		await flush();
		await vi.advanceTimersByTimeAsync(1000);
		expect(onChange).toHaveBeenCalledWith([knock(1)]);
	});

	it('treats a knock somebody already settled as settled', async () => {
		const transport = createHttpCallKnockTransport({
			api: api({
				admit: vi
					.fn()
					.mockRejectedValue(new Error(FETCH_ERRORS.CONFLICT)),
				decline: vi
					.fn()
					.mockRejectedValue(new Error(FETCH_ERRORS.NO_MATCH)),
				admitAll: vi
					.fn()
					.mockRejectedValue(new Error(FETCH_ERRORS.CATCH_ALL))
			})
		});
		await expect(transport.admit(1)).resolves.toBeUndefined();
		await expect(transport.decline(1)).resolves.toBeUndefined();
		await expect(transport.admitAll(SCOPE)).rejects.toThrow(
			FETCH_ERRORS.CATCH_ALL
		);
	});
});

describe('callKnockModel', () => {
	it('scopes to the conversation room the call signals in', () => {
		expect(
			callKnockScopeOf({ roomId: '!ec:m', signalRoomId: '!session:m' })
		).toEqual({ matrixRoomId: '!session:m' });
		expect(callKnockScopeOf({ roomId: '!session:m' })).toEqual({
			matrixRoomId: '!session:m'
		});
		// A group call: the group's room is the conversation.
		expect(
			callKnockScopeOf({
				roomId: '!ec:m',
				elementCallRoomId: '!ec:m',
				signalRoomId: '!group:m'
			})
		).toEqual({ matrixRoomId: '!group:m' });
		// Only the media room known: ask nothing rather than the wrong room.
		expect(
			callKnockScopeOf({ roomId: '!ec:m', elementCallRoomId: '!ec:m' })
		).toBeNull();
		expect(callKnockScopeOf(null)).toBeNull();
	});

	it('writes the scope as the server reads it', () => {
		expect(scopeQuery({ sessionId: 7 })).toBe('sessionId=7');
		expect(scopeQuery({ matrixRoomId: '!a:b.c' })).toBe(
			'matrixRoomId=!a%3Ab.c'
		);
	});

	it('uses the server name, empty means unknown', () => {
		expect(knockerName({ ...knock(1), displayName: ' kim ' })).toBe('kim');
		expect(knockerName({ ...knock(1), displayName: '' })).toBeNull();
		expect(knockerName(knock(1))).toBeNull();
	});

	it('finds the knocks that are new', () => {
		expect(newKnockIds(new Set([1]), [knock(1), knock(2)])).toEqual([2]);
	});

	it('keeps the page inside the list', () => {
		expect(clampPage(2, 2)).toBe(1);
		expect(clampPage(-1, 3)).toBe(0);
		expect(clampPage(4, 0)).toBe(0);
	});
});

describe('knock notice texts', () => {
	// de@informal is a sparse overlay: these texts say nothing formal, so it
	// uses the de values (`fallbackLng`, guarded by src/i18n.test.ts).
	const LOCALES = ['de', 'en', 'fr', 'ru', 'ti', 'tr'];
	const KEYS = [
		'region',
		'someone',
		'wantsIn',
		'admit',
		'decline',
		'admitAll',
		'position',
		'previous',
		'next',
		'participants',
		'participantsWaiting'
	];
	it('de@informal adds nothing of its own, so it reads the de texts', () => {
		const informal = JSON.parse(
			readFileSync(
				resolve(
					process.cwd(),
					'src/resources/i18n/de@informal/common.json'
				),
				'utf8'
			)
		);
		expect(informal.calls?.knock).toBeUndefined();
		// Only the sentence that addresses the counsellor differs.
		expect(Object.keys(informal.calls?.admission ?? {})).toEqual(['on']);
	});

	it.each(LOCALES)('%s has every key', (locale) => {
		const json = JSON.parse(
			readFileSync(
				resolve(
					process.cwd(),
					`src/resources/i18n/${locale}/common.json`
				),
				'utf8'
			)
		);
		KEYS.forEach((key) => {
			expect(
				json.calls?.knock?.[key],
				`${locale} calls.knock.${key}`
			).toBeTruthy();
		});
		expect(json.calls.knock.position).toContain('{{current}}');
		expect(json.calls.knock.position).toContain('{{total}}');
		expect(json.calls.knock.participantsWaiting).toContain('{{count}}');
		['label', 'on', 'off'].forEach((key) =>
			expect(
				json.calls.admission?.[key],
				`${locale} calls.admission.${key}`
			).toBeTruthy()
		);
	});
});
