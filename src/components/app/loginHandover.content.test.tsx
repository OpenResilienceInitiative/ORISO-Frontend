// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
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
	finishLoginHandover,
	isLoginHandoverActive,
	LOGIN_HANDOVER_CONTENT_GRACE_MS,
	LOGIN_HANDOVER_FINISH_MAX_WAIT_MS,
	resetLoginHandoverForTests,
	useHoldLoginHandover
} from './loginHandover';

/*
 * #2272 follow-up (Frank, 17 Nov): the handover screen faded out as soon as
 * the app shell was ready, while the first list was still empty; the list
 * then popped in during the fade, a second picture right after the first.
 * The screen now also waits for the first content that registers a hold.
 */

const Holder = ({ holding }: { holding: boolean }) => {
	useHoldLoginHandover('sessionsList', holding);
	return null;
};

const wait = (ms: number) =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const frames = () => wait(LOGIN_HANDOVER_CONTENT_GRACE_MS + 20);

describe('login handover waits for the first content', () => {
	beforeEach(() => resetLoginHandoverForTests(false));
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		endLoginHandover();
	});

	it('stays while the first list loads, and ends once it has loaded', async () => {
		beginLoginHandover();
		const view = render(<Holder holding />);
		act(() => finishLoginHandover());
		await frames();
		expect(isLoginHandoverActive()).toBe(true);

		view.rerender(<Holder holding={false} />);
		await frames();
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('ends as soon as content that registered after ready has loaded', async () => {
		beginLoginHandover();
		act(() => finishLoginHandover());
		const view = render(<Holder holding />);
		view.rerender(<Holder holding={false} />);
		await wait(20);
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('also waits for content that mounts right after the app is ready', async () => {
		beginLoginHandover();
		act(() => finishLoginHandover());
		// On Dev the session list mounted 19 ms after "ready", behind a route change.
		await wait(30);
		render(<Holder holding />);
		await frames();
		expect(isLoginHandoverActive()).toBe(true);
	});

	it('ends after the grace when nothing holds it', async () => {
		beginLoginHandover();
		act(() => finishLoginHandover());
		await frames();
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('a list that unmounts releases its hold', async () => {
		beginLoginHandover();
		const view = render(<Holder holding />);
		act(() => finishLoginHandover());
		view.unmount();
		await frames();
		expect(isLoginHandoverActive()).toBe(false);
	});

	it('never waits for content longer than the cap', () => {
		vi.useFakeTimers();
		beginLoginHandover();
		render(<Holder holding />);
		act(() => finishLoginHandover());
		act(() => {
			vi.advanceTimersByTime(LOGIN_HANDOVER_FINISH_MAX_WAIT_MS);
		});
		expect(isLoginHandoverActive()).toBe(false);
	});
});

describe('the continued screen keeps its words', () => {
	afterEach(() => {
		cleanup();
		sessionStorage.clear();
		vi.resetModules();
	});

	it('shows the label the login page showed, not the profile language', async () => {
		sessionStorage.setItem(
			'oriso.loginHandover',
			JSON.stringify({ at: Date.now(), label: { text: 'Please wait' } })
		);
		vi.resetModules();
		vi.doMock('react-i18next', () => ({
			useTranslation: () => ({ t: () => 'Bitte warten' })
		}));
		vi.doMock('./Loading', () => ({
			Loading: ({ label }: { label: string }) => <span>{label}</span>
		}));
		const { LoginHandoverGate } = await import('./LoginHandoverScreen');
		render(<LoginHandoverGate />);
		const screen = document.querySelector('.loginHandoverScreen');
		expect(screen?.getAttribute('aria-label')).toBe('Please wait');
		expect(screen?.textContent).toBe('Please wait');
	});
});
