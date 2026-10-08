// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LAST_OPEN_SESSION_TTL_MS,
	clearLastOpenSession,
	isRestorableSessionPath,
	readLastOpenSession,
	rememberLastOpenSession
} from './lastOpenSession';
import { purgeAppWebStorage } from '../services/clientStorageHygiene';

describe('lastOpenSession (#1193 Job 3)', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('accepts only consultant session detail routes', () => {
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionView/session/3363'
			)
		).toBe(true);
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionView/!abc:matrix.org/3363/'
			)
		).toBe(true);
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionPreview/session/1'
			)
		).toBe(false);
		expect(
			isRestorableSessionPath('/sessions/consultant/sessionView/')
		).toBe(false);
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionView/session/3363/userProfile'
			)
		).toBe(false);
		expect(isRestorableSessionPath('https://evil.example/x')).toBe(false);
		expect(isRestorableSessionPath(null)).toBe(false);
	});

	it('remembers and restores per user', () => {
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/42'
		);
		rememberLastOpenSession(
			'u2',
			'/sessions/consultant/sessionView/session/7'
		);
		expect(readLastOpenSession('u1')).toBe(
			'/sessions/consultant/sessionView/session/42'
		);
		expect(readLastOpenSession('u2')).toBe(
			'/sessions/consultant/sessionView/session/7'
		);
		expect(readLastOpenSession('unknown')).toBeNull();
		expect(readLastOpenSession(undefined)).toBeNull();
	});

	it('overwrites with the most recently opened session', () => {
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/1'
		);
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/2'
		);
		expect(readLastOpenSession('u1')).toBe(
			'/sessions/consultant/sessionView/session/2'
		);
	});

	it('ignores non-session paths and tampered storage', () => {
		rememberLastOpenSession('u1', '/sessions/consultant/sessionView/');
		expect(readLastOpenSession('u1')).toBeNull();
		window.localStorage.setItem(
			'oriso.lastOpenSession.u1',
			'//evil.example'
		);
		expect(readLastOpenSession('u1')).toBeNull();
		window.localStorage.setItem(
			'oriso.lastOpenSession.u1',
			JSON.stringify({ path: '//evil.example', ts: Date.now() })
		);
		expect(readLastOpenSession('u1')).toBeNull();
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionView/\\evil.com/1'
			)
		).toBe(false);
	});

	it('forgets entries older than the TTL', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-05T10:00:00Z'));
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/1'
		);
		vi.setSystemTime(
			new Date('2026-09-05T10:00:00Z').getTime() +
				LAST_OPEN_SESSION_TTL_MS -
				1
		);
		expect(readLastOpenSession('u1')).toBe(
			'/sessions/consultant/sessionView/session/1'
		);
		vi.setSystemTime(
			new Date('2026-09-05T10:00:00Z').getTime() +
				LAST_OPEN_SESSION_TTL_MS +
				1
		);
		expect(readLastOpenSession('u1')).toBeNull();
		expect(
			window.localStorage.getItem('oriso.lastOpenSession.u1')
		).toBeNull();
	});

	it('survives the sign-out storage purge (#1071) so the next login can resume', () => {
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/42'
		);
		window.localStorage.setItem('oriso.somethingElse', 'x');
		purgeAppWebStorage();
		expect(window.localStorage.getItem('oriso.somethingElse')).toBeNull();
		expect(readLastOpenSession('u1')).toBe(
			'/sessions/consultant/sessionView/session/42'
		);
	});

	it('rejects future or non-finite timestamps instead of extending the TTL', () => {
		const path = '/sessions/consultant/sessionView/session/1';
		const rawPayloads = [
			// future timestamps (finite)
			JSON.stringify({ path, ts: Date.now() + LAST_OPEN_SESSION_TTL_MS }),
			JSON.stringify({ path, ts: Date.now() + 60_000 }),
			// genuinely non-finite numbers: JSON.stringify would turn NaN/Infinity
			// into null, so use raw payloads whose exponent overflows to ±Infinity
			`{"path":"${path}","ts":1e999}`,
			`{"path":"${path}","ts":-1e999}`
		];
		for (const raw of rawPayloads) {
			window.localStorage.setItem('oriso.lastOpenSession.u1', raw);
			expect(readLastOpenSession('u1')).toBeNull();
			expect(
				window.localStorage.getItem('oriso.lastOpenSession.u1')
			).toBeNull();
		}
	});

	it('clears', () => {
		rememberLastOpenSession(
			'u1',
			'/sessions/consultant/sessionView/session/1'
		);
		clearLastOpenSession('u1');
		expect(readLastOpenSession('u1')).toBeNull();
	});
});
