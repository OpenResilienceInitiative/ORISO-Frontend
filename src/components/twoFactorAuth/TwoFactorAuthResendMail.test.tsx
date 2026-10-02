// @vitest-environment jsdom

import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RESEND_ERROR_ALREADY_SHOWN,
	RESEND_FALLBACK_COOLDOWN_SECONDS,
	TwoFactorAuthResendMail
} from './TwoFactorAuthResendMail';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.countdown ? `${key}:${options.countdown}` : key
	})
}));

vi.mock('../../resources/img/icons', () => ({
	CheckmarkIcon: () => <span data-testid="checkmark" />
}));

vi.mock('../text/Text', () => ({
	Text: ({ text, className }: { text: string; className?: string }) => (
		<p className={className}>{text}</p>
	)
}));

vi.mock('./twoFactorAuthResendMail.styles', () => ({}));

const button = () => screen.getByRole('button') as HTMLButtonElement;

/** This project ships no jest-dom matchers, so presence is a plain truthiness check. */
const textOnScreen = (key: string) => screen.queryByText(key);

/**
 * ORISO-UserService#1338. Before this, the button reported "sent" the moment it
 * was clicked — a failed send and a successful one looked identical — and there
 * was no wait at all, so clicking twice silently replaced the code the user was
 * reading in their inbox.
 */
describe('TwoFactorAuthResendMail', () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		// vitest runs without globals here, so testing-library's automatic
		// cleanup never registers and a second render would find two buttons
		cleanup();
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it('says "sent" only once the request has answered', async () => {
		let resolveRequest: () => void = () => undefined;
		const resendHandler = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRequest = resolve;
				})
		);

		render(<TwoFactorAuthResendMail resendHandler={resendHandler} />);
		await act(async () => {
			button().click();
		});

		expect(resendHandler).toHaveBeenCalledTimes(1);
		expect(
			textOnScreen('twoFactorAuth.activate.email.resend.sent')
		).toBeNull();

		await act(async () => {
			resolveRequest();
		});

		await waitFor(() =>
			expect(
				textOnScreen('twoFactorAuth.activate.email.resend.sent')
			).toBeTruthy()
		);
	});

	it('shows an error instead of "sent" when the request fails', async () => {
		const resendHandler = vi.fn(() => Promise.reject(new Error('offline')));

		render(<TwoFactorAuthResendMail resendHandler={resendHandler} />);
		await act(async () => {
			button().click();
		});

		await waitFor(() =>
			expect(
				textOnScreen('twoFactorAuth.activate.email.resend.failed')
			).toBeTruthy()
		);
		expect(
			textOnScreen('twoFactorAuth.activate.email.resend.sent')
		).toBeNull();
	});

	it('stays quiet when the caller has already put the reason on screen', async () => {
		// the login form names the real problem ("too many codes, wait 12
		// minutes"); a second generic line underneath would only add noise
		const resendHandler = vi.fn(() =>
			Promise.reject(new Error(RESEND_ERROR_ALREADY_SHOWN))
		);

		render(<TwoFactorAuthResendMail resendHandler={resendHandler} />);
		await act(async () => {
			button().click();
		});

		await waitFor(() => expect(resendHandler).toHaveBeenCalled());
		expect(
			textOnScreen('twoFactorAuth.activate.email.resend.failed')
		).toBeNull();
	});

	it('counts down and refuses a second click while it waits', async () => {
		const resendHandler = vi.fn(() => Promise.resolve());

		render(
			<TwoFactorAuthResendMail
				resendHandler={resendHandler}
				cooldownSeconds={3}
			/>
		);

		// the server already said "wait 3 s", so the button is disabled before
		// the user even clicks
		expect(button().disabled).toBe(true);
		expect(button().textContent).toBe(
			'twoFactorAuth.activate.email.resend.newIn:0:03'
		);

		await act(async () => {
			button().click();
		});
		expect(resendHandler).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(3000);
		});

		await waitFor(() => expect(button().disabled).toBe(false));
		expect(button().textContent).toBe(
			'twoFactorAuth.activate.email.resend.new'
		);

		await act(async () => {
			button().click();
		});
		expect(resendHandler).toHaveBeenCalledTimes(1);
	});

	it('falls back to its own cooldown when the realm reports none', async () => {
		const resendHandler = vi.fn(() => Promise.resolve());

		render(<TwoFactorAuthResendMail resendHandler={resendHandler} />);
		await act(async () => {
			button().click();
		});
		// past the 2 s "sent" confirmation, the countdown is what is left
		await act(async () => {
			vi.advanceTimersByTime(2100);
		});

		await waitFor(() => expect(button().disabled).toBe(true));
		// the exact second depends on how the fake timers line up with the 2 s
		// "sent" confirmation, so assert the range the fallback must produce
		expect(button().textContent).toMatch(
			new RegExp(
				`resend\\.newIn:0:(${RESEND_FALLBACK_COOLDOWN_SECONDS - 3}|` +
					`${RESEND_FALLBACK_COOLDOWN_SECONDS - 2}|` +
					`${RESEND_FALLBACK_COOLDOWN_SECONDS - 1}|` +
					`${RESEND_FALLBACK_COOLDOWN_SECONDS})$`
			)
		);
	});

	it('always states that only the newest code works', () => {
		render(
			<TwoFactorAuthResendMail resendHandler={() => Promise.resolve()} />
		);

		expect(
			textOnScreen('twoFactorAuth.activate.email.resend.onlyNewest')
		).toBeTruthy();
	});

	it('still works with a caller that answers synchronously', async () => {
		// the old contract: a handler that just calls back
		const resendHandler = vi.fn((callback: Function) => callback());

		render(<TwoFactorAuthResendMail resendHandler={resendHandler} />);
		await act(async () => {
			button().click();
		});

		await waitFor(() =>
			expect(
				textOnScreen('twoFactorAuth.activate.email.resend.sent')
			).toBeTruthy()
		);
	});
});
