// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	beginLoginHandover,
	endLoginHandover,
	isLoginHandoverActive,
	LOGIN_HANDOVER_HTML_CLASS,
	LOGIN_HANDOVER_MAX_AGE_MS,
	LOGIN_HANDOVER_STORAGE_KEY,
	persistLoginHandover,
	readPendingLoginHandover,
	resetLoginHandoverForTests
} from './loginHandover';
import {
	LOGIN_HANDOVER_FADE_MS,
	LOGIN_HANDOVER_MAX_VISIBLE_MS,
	LoginHandoverGate
} from './LoginHandoverScreen';

vi.mock('./Loading', () => ({
	Loading: () => <div role="status">loading</div>
}));

describe('login handover state', () => {
	beforeEach(() => {
		sessionStorage.clear();
		resetLoginHandoverForTests(false);
	});

	it('reads a fresh mark and ignores stale or broken ones', () => {
		const now = 1_000_000;
		const storage = (value: string | null) => ({ getItem: () => value });
		expect(
			readPendingLoginHandover(
				storage(JSON.stringify({ at: now - 10 })),
				now
			)
		).toEqual({ at: now - 10 });
		expect(
			readPendingLoginHandover(
				storage(
					JSON.stringify({ at: now - LOGIN_HANDOVER_MAX_AGE_MS })
				),
				now
			)
		).toBeNull();
		expect(
			readPendingLoginHandover(
				storage(JSON.stringify({ at: now + 5 })),
				now
			)
		).toBeNull();
		expect(readPendingLoginHandover(storage('{not json'), now)).toBeNull();
		expect(readPendingLoginHandover(storage(null), now)).toBeNull();
	});

	it('persists a mark with the background for the next document', () => {
		persistLoginHandover();
		const mark = JSON.parse(
			sessionStorage.getItem(LOGIN_HANDOVER_STORAGE_KEY) ?? 'null'
		);
		expect(typeof mark.at).toBe('number');
		expect(readPendingLoginHandover()).not.toBeNull();
	});

	it('ending clears the mark and what app.html painted', () => {
		persistLoginHandover();
		document.documentElement.classList.add(LOGIN_HANDOVER_HTML_CLASS);
		document.documentElement.style.background = 'rgb(1, 2, 3)';
		beginLoginHandover();

		endLoginHandover();

		expect(isLoginHandoverActive()).toBe(false);
		expect(sessionStorage.getItem(LOGIN_HANDOVER_STORAGE_KEY)).toBeNull();
		expect(
			document.documentElement.classList.contains(
				LOGIN_HANDOVER_HTML_CLASS
			)
		).toBe(false);
		expect(document.documentElement.style.background).toBe('');
	});
});

describe('LoginHandoverGate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		sessionStorage.clear();
		resetLoginHandoverForTests(false);
	});
	afterEach(() => {
		cleanup();
		document.querySelector('.app__container')?.remove();
		vi.useRealTimers();
	});

	it('shows nothing without a handover', () => {
		render(<LoginHandoverGate />);
		expect(document.querySelector('.loginHandoverScreen')).toBeNull();
	});

	it('fades in on the login page and out when the app is ready', () => {
		render(<LoginHandoverGate />);

		act(() => beginLoginHandover());
		const overlay = document.querySelector('.loginHandoverScreen');
		expect(overlay?.classList.contains('loginHandoverScreen--enter')).toBe(
			true
		);
		expect(screen.getByRole('status')).toBeTruthy();

		act(() => endLoginHandover());
		expect(
			overlay?.classList.contains('loginHandoverScreen--leaving')
		).toBe(true);

		act(() => {
			vi.advanceTimersByTime(LOGIN_HANDOVER_FADE_MS);
		});
		expect(document.querySelector('.loginHandoverScreen')).toBeNull();
	});

	it('continues without a second fade-in on the app document', () => {
		resetLoginHandoverForTests(true);
		render(<LoginHandoverGate />);
		const overlay = document.querySelector('.loginHandoverScreen');
		expect(overlay).not.toBeNull();
		expect(overlay?.classList.contains('loginHandoverScreen--enter')).toBe(
			false
		);
	});

	it('makes the covered app inert and restores focus after a same-document failure', async () => {
		const covered = document.createElement('div');
		covered.className = 'app__container';
		const loginButton = document.createElement('button');
		loginButton.textContent = 'Login';
		covered.appendChild(loginButton);
		document.body.appendChild(covered);
		loginButton.focus();
		render(<LoginHandoverGate />);

		act(() => beginLoginHandover());
		const overlay = screen.getByRole('status');
		expect(covered.hasAttribute('inert')).toBe(true);
		expect(covered.contains(overlay)).toBe(false);
		expect(document.activeElement).toBe(overlay);

		await act(async () => {
			endLoginHandover();
			await Promise.resolve();
		});
		expect(covered.hasAttribute('inert')).toBe(false);
		expect(document.activeElement).toBe(loginButton);
	});

	it('never keeps a person behind the screen for good', () => {
		render(<LoginHandoverGate />);
		act(() => beginLoginHandover());
		act(() => {
			vi.advanceTimersByTime(LOGIN_HANDOVER_MAX_VISIBLE_MS);
		});
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('ends when the login page comes back from the back/forward cache', () => {
		render(<LoginHandoverGate />);
		act(() => beginLoginHandover());
		act(() => {
			const event = new Event('pageshow') as PageTransitionEvent;
			Object.defineProperty(event, 'persisted', { value: true });
			window.dispatchEvent(event);
		});
		expect(isLoginHandoverActive()).toBe(false);
	});
});
