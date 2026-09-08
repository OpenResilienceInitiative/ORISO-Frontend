// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveChatWaitingRoom } from './LiveChatWaitingRoom';

// `globals` is off in this project, so RTL never registers its own teardown.
afterEach(() => cleanup());

const CONSENT_HTML =
	'Ich habe die <a href="https://oriso.example/datenschutz">Datenschutzerklärung</a> zur Kenntnis genommen.';

const renderAccepted = (
	props: Partial<React.ComponentProps<typeof LiveChatWaitingRoom>> = {}
) => {
	const onAccept = vi.fn();
	const onLeave = vi.fn();
	const utils = render(
		<LiveChatWaitingRoom
			ahead={0}
			accepted
			consentHtml={CONSENT_HTML}
			onAccept={onAccept}
			onLeave={onLeave}
			onMailCounselling={() => undefined}
			{...props}
		/>
	);
	return { ...utils, onAccept, onLeave };
};

const startButton = () =>
	screen.getByRole('button', { name: /Gespräch beginnen/i });

// This project has no jest-dom matchers, so read the DOM directly.
const consentBox = () => screen.getByRole('checkbox') as HTMLInputElement;

describe('LiveChatWaitingRoom — the consent gate (#1341)', () => {
	/**
	 * The whole point of item 2. The sentence used to be text above the
	 * button, so pressing the button *was* the consent; there was no state in
	 * which somebody could be told they had not agreed yet.
	 */
	it('does not start the chat while the box is unticked, and says why', () => {
		const { onAccept } = renderAccepted();

		expect(screen.queryByRole('alert')).toBeNull();
		fireEvent.click(startButton());

		expect(onAccept).not.toHaveBeenCalled();
		expect(screen.getByRole('alert').textContent).toMatch(/Zustimmung/i);
		expect(consentBox().checked).toBe(false);
	});

	it('clears the error as soon as the box is ticked', () => {
		renderAccepted();
		fireEvent.click(startButton());
		expect(screen.queryByRole('alert')).not.toBeNull();

		fireEvent.click(consentBox());

		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('starts the chat once the box is ticked', () => {
		const { onAccept } = renderAccepted();

		fireEvent.click(consentBox());
		fireEvent.click(startButton());

		expect(onAccept).toHaveBeenCalledTimes(1);
	});

	/**
	 * The binding is the wording, not a boolean: a sentence that changes under
	 * the reader — a language switch is the everyday case — has to untick, or
	 * agreement given for one text would carry onto another.
	 */
	it('unticks when the sentence itself changes', () => {
		const { rerender, onAccept } = renderAccepted();

		fireEvent.click(consentBox());
		rerender(
			<LiveChatWaitingRoom
				ahead={0}
				accepted
				consentHtml="Andere Träger-Formulierung."
				onAccept={onAccept}
				onLeave={() => undefined}
				onMailCounselling={() => undefined}
			/>
		);

		expect(consentBox().checked).toBe(false);
		fireEvent.click(startButton());
		expect(onAccept).not.toHaveBeenCalled();
	});
});

describe('LiveChatWaitingRoom — cancelling asks first (#1341)', () => {
	const pressTheCross = () =>
		fireEvent.click(
			screen.getByRole('button', { name: /Chat verlassen/i })
		);

	it('asks before anything leaves, rather than leaving on the first tap', () => {
		const { onLeave } = renderAccepted();

		pressTheCross();

		expect(onLeave).not.toHaveBeenCalled();
		// Throws if the question is not on screen.
		screen.getByText(
			/Sind Sie sicher, dass Sie abbrechen wollen und schließen\?/i
		);
	});

	/**
	 * The dialog's own "start chat now" is still starting the chat, so it goes
	 * through the same gate — otherwise the consent is one tap away from being
	 * walked around.
	 */
	it('routes the dialog start button through the consent gate too', () => {
		const { onAccept } = renderAccepted();

		pressTheCross();
		fireEvent.click(
			screen.getByRole('button', { name: /Chat jetzt starten/i })
		);

		expect(onAccept).not.toHaveBeenCalled();
		expect(screen.queryByRole('alert')).not.toBeNull();
	});
});
