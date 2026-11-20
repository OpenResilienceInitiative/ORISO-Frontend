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
	captureLoginCurtain,
	endLoginHandover,
	finishLoginHandover,
	isLoginHandoverActive,
	LOGIN_HANDOVER_CONTENT_GRACE_MS,
	LOGIN_HANDOVER_FINISH_MAX_WAIT_MS,
	LOGIN_HANDOVER_HTML_CLASS,
	LOGIN_HANDOVER_MAX_AGE_MS,
	LOGIN_HANDOVER_STORAGE_KEY,
	persistLoginHandover,
	readPendingLoginHandover,
	resetLoginHandoverForTests,
	setLoginHandoverHold
} from './loginHandover';
import type { LoginHandoverCurtain } from './loginHandoverCurtain';
import {
	LOGIN_HANDOVER_FADE_MS,
	LOGIN_HANDOVER_MAX_VISIBLE_MS,
	LoginHandoverGate
} from './LoginHandoverScreen';

vi.mock('./Loading', () => ({
	Loading: () => <div role="status">loading</div>
}));

const curtain: LoginHandoverCurtain = {
	axis: 'horizontal',
	split: 40,
	radius: 0,
	stageColor: '#a5000a',
	stageTint: '#da2530',
	stageShade: '#7c0d15',
	panelColor: '#faf7f7',
	inkColor: '#231b1b',
	fields: []
};

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

	it('serializes only the public curtain appearance for the next document', () => {
		beginLoginHandover({
			curtain: {
				...curtain,
				password: 'example secret'
			} as LoginHandoverCurtain
		});
		persistLoginHandover();
		const mark = sessionStorage.getItem(LOGIN_HANDOVER_STORAGE_KEY);
		expect(mark).not.toContain('example secret');
		expect(readPendingLoginHandover()?.curtain).toEqual(curtain);
	});

	it('ignores a curtain with invalid geometry or CSS', () => {
		const now = Date.now();
		for (const appearance of [
			{ ...curtain, split: 1000 },
			{ ...curtain, panelColor: 'url(https://example.invalid/a)' }
		]) {
			sessionStorage.setItem(
				LOGIN_HANDOVER_STORAGE_KEY,
				JSON.stringify({ at: now, curtain: appearance })
			);
			expect(readPendingLoginHandover()).toEqual({ at: now });
		}
	});

	it('captures the visible field geometry and skips an inactive OTP', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<div class="loginForm__fields">
				<div class="MuiOutlinedInput-root"><input value="fixture-name"></div>
				<div class="MuiOutlinedInput-root"><input type="password" value="fixture-password"></div>
				<div class="loginForm__otp">
					<div class="MuiOutlinedInput-root"><input value="123456"></div>
				</div>
			</div>
		`;
		root.querySelectorAll('.MuiOutlinedInput-root').forEach((node) => {
			vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(
				new DOMRect(20, 30, 100, 38)
			);
		});
		const withoutOtp = captureLoginCurtain(root);
		expect(withoutOtp.fields).toHaveLength(2);
		root.querySelector('.loginForm__otp')?.classList.add(
			'loginForm__otp--active'
		);
		const withOtp = captureLoginCurtain(root);
		expect(withOtp.fields).toHaveLength(3);
		expect(JSON.stringify(withOtp)).not.toMatch(
			/fixture-name|fixture-password|123456/
		);
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

	it('leaves the source login curtain in control of the screen', () => {
		render(<LoginHandoverGate />);
		act(() => beginLoginHandover({ curtain }));
		expect(isLoginHandoverActive()).toBe(true);
		expect(document.querySelector('.loginHandoverScreen')).toBeNull();
	});

	it('opens the pre-script curtain when the destination is ready', () => {
		resetLoginHandoverForTests(true);
		const splash = document.createElement('div');
		splash.id = 'loginHandoverSplash';
		splash.dataset.loginCurtain = 'horizontal';
		document.body.appendChild(splash);
		render(<LoginHandoverGate />);

		act(() => finishLoginHandover());
		expect(splash.dataset.phase).toBeUndefined();
		act(() => vi.advanceTimersByTime(LOGIN_HANDOVER_CONTENT_GRACE_MS));
		expect(splash.dataset.phase).toBe('revealing');
		act(() => vi.advanceTimersByTime(480));
		expect(splash.isConnected).toBe(false);
	});

	it('opens the curtain at the readiness cap even if the first view is slow', () => {
		resetLoginHandoverForTests(true);
		const splash = document.createElement('div');
		splash.id = 'loginHandoverSplash';
		splash.dataset.loginCurtain = 'vertical';
		document.body.appendChild(splash);
		setLoginHandoverHold('sessions', true);
		render(<LoginHandoverGate />);

		act(() => finishLoginHandover());
		act(() => vi.advanceTimersByTime(LOGIN_HANDOVER_CONTENT_GRACE_MS));
		expect(splash.dataset.phase).toBeUndefined();
		act(() =>
			vi.advanceTimersByTime(
				LOGIN_HANDOVER_FINISH_MAX_WAIT_MS -
					LOGIN_HANDOVER_CONTENT_GRACE_MS
			)
		);
		expect(splash.dataset.phase).toBe('revealing');
		act(() => vi.advanceTimersByTime(480));
		expect(splash.isConnected).toBe(false);
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
