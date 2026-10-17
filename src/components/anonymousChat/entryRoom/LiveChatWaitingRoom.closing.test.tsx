// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The legal links open a dialog, which pulls in the lottie player; jsdom has
   no canvas for it. */
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));

const play = vi.fn();
vi.mock('../../transition/closing/useClosingAnimation', () => ({
	useClosingAnimation: () => ({ play })
}));

const { LiveChatWaitingRoom } = await import('./LiveChatWaitingRoom');

// `globals` is off in this project, so RTL never registers its own teardown.
afterEach(() => cleanup());

const CONSENT_HTML =
	'Ich habe die <a href="https://oriso.example/datenschutz">Datenschutzerklärung</a> zur Kenntnis genommen.';

const startButton = () =>
	screen.getByRole('button', { name: /Gespräch beginnen/i });
const consentBox = () => screen.getByRole('checkbox') as HTMLInputElement;

/**
 * ORISO-Frontend#1737. The consent is asked before the screen closes, and
 * again when it is covered: for the 340 ms the cover takes, the box is still
 * under the person's hand.
 */
describe('LiveChatWaitingRoom — consent while the screen closes', () => {
	let cover: () => unknown = () => undefined;
	let finish: () => void = () => undefined;

	beforeEach(() => {
		play.mockReset();
		play.mockImplementation(
			({ onCovered }: { onCovered: () => unknown }) => {
				cover = onCovered;
				return new Promise<{ played: boolean }>((resolve) => {
					finish = () => resolve({ played: true });
				});
			}
		);
	});

	const renderRoom = (start: () => unknown = () => undefined) => {
		const onAccept = vi.fn(start);
		render(
			<LiveChatWaitingRoom
				ahead={0}
				accepted
				consentHtml={CONSENT_HTML}
				onAccept={onAccept}
				onLeave={vi.fn()}
				onMailCounselling={() => undefined}
			/>
		);
		return onAccept;
	};

	it('starts the chat once the screen is covered when the consent still stands', async () => {
		const onAccept = renderRoom();
		fireEvent.click(consentBox());
		fireEvent.click(startButton());

		expect(play).toHaveBeenCalledTimes(1);
		expect(
			onAccept,
			'not before the screen is covered'
		).not.toHaveBeenCalled();
		await act(async () => cover());
		expect(onAccept).toHaveBeenCalledTimes(1);
		await act(async () => finish());
	});

	it("hands the start's own wait to the animation, so the screen stays covered until the page is replaced", async () => {
		const waiting = new Promise<void>(() => undefined);
		renderRoom(() => waiting);
		fireEvent.click(consentBox());
		fireEvent.click(startButton());

		expect(cover()).toBe(waiting);
		await act(async () => finish());
	});

	it('does not start the chat when the box was unticked while the screen closed, and says why', async () => {
		const onAccept = renderRoom();
		fireEvent.click(consentBox());
		fireEvent.click(startButton());
		expect(play).toHaveBeenCalledTimes(1);

		fireEvent.click(consentBox());
		expect(consentBox().checked).toBe(false);
		await act(async () => cover());

		expect(onAccept).not.toHaveBeenCalled();
		await act(async () => finish());
		expect(screen.getByRole('alert')).toBeTruthy();
	});
});

/**
 * ORISO-Frontend#1737 (review). "Chat starten" inside the leave dialog is
 * still starting: it presses the very gate button, so the closing animation
 * plays and the consent is asked there too.
 */
describe('LiveChatWaitingRoom — "start chat" in the leave dialog', () => {
	beforeEach(() => {
		play.mockReset();
		play.mockImplementation(
			({ onCovered }: { onCovered: () => unknown }) =>
				new Promise<{ played: boolean }>((resolve) => {
					void Promise.resolve(onCovered()).then(() =>
						resolve({ played: true })
					);
				})
		);
	});

	const openDialog = () => {
		const onAccept = vi.fn();
		render(
			<LiveChatWaitingRoom
				ahead={0}
				accepted
				consentHtml={CONSENT_HTML}
				onAccept={onAccept}
				onLeave={vi.fn()}
				onMailCounselling={() => undefined}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: /Nicht zustimmen/i })
		);
		return onAccept;
	};
	const dialogStart = () =>
		screen.getByRole('button', { name: /leaveQueue\.startChat/ });

	it('plays the closing animation and starts the chat when the consent stands', async () => {
		const onAccept = openDialog();
		// The dialog stands in front; the box behind it is still reachable here.
		fireEvent.click(consentBox(), { target: { checked: true } });
		await act(async () => dialogStart().click());

		expect(play).toHaveBeenCalledTimes(1);
		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	it('neither plays nor starts without the consent, and says why', async () => {
		const onAccept = openDialog();
		await act(async () => dialogStart().click());

		expect(play).not.toHaveBeenCalled();
		expect(onAccept).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toBeTruthy();
	});
});
