// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'anonymousChat.leaveQueue.headline': 'Chat verlassen?',
			'anonymousChat.leaveQueue.body':
				'Sie sind noch im Wartebereich. Sie können weiter warten oder Ihren Zugang löschen — dann wird dieser Chat beendet.',
			'anonymousChat.leaveQueue.bodyAccepted':
				'Eine beratende Person wartet bereits auf Sie. Sie können den Chat jetzt starten, im Wartebereich bleiben oder Ihren Zugang löschen.',
			'anonymousChat.leaveQueue.deleteWarning':
				'Ihr Zugang wird deaktiviert und dieser Chat beendet.',
			'anonymousChat.leaveQueue.cancelDelete': 'Abbrechen',
			'anonymousChat.leaveQueue.confirmDelete': 'Ja, endgültig löschen',
			'anonymousChat.leaveQueue.stay': 'Im Wartebereich bleiben',
			'anonymousChat.leaveQueue.startChat': 'Chat jetzt starten',
			'anonymousChat.leaveQueue.startChatUnavailable':
				'Sobald eine beratende Person den Chat annimmt, können Sie hier starten.',
			'anonymousChat.leaveQueue.delete': 'Chat beenden & Zugang löschen'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock call
   above, otherwise the real i18next module is pulled in first. */
import { LeaveQueueDialog } from './LeaveQueueDialog';

// `globals` is off in this project, so RTL never registers its own teardown.
afterEach(() => cleanup());

const renderDialog = (
	props: Partial<React.ComponentProps<typeof LeaveQueueDialog>> = {}
) => {
	const onStay = vi.fn();
	const onStartChat = vi.fn();
	const onDeleteAccess = vi.fn();
	const utils = render(
		<LeaveQueueDialog
			open
			canStartChat={false}
			onStay={onStay}
			onStartChat={onStartChat}
			onDeleteAccess={onDeleteAccess}
			{...props}
		/>
	);
	return { ...utils, onStay, onStartChat, onDeleteAccess };
};

const button = (utils: ReturnType<typeof renderDialog>, pattern: RegExp) =>
	utils.getByRole('button', { name: pattern });

describe('LeaveQueueDialog', () => {
	it('renders nothing while closed', () => {
		const { container } = renderDialog({ open: false });
		expect(container.firstChild).toBeNull();
	});

	it('offers a way back into the queue', () => {
		const utils = renderDialog();
		fireEvent.click(button(utils, /Wartebereich bleiben/i));
		expect(utils.onStay).toHaveBeenCalledTimes(1);
	});

	/**
	 * House rule: disable, never hide. Nobody has accepted the conversation
	 * yet, so there is no chat to start — but removing the option would leave
	 * the asker wondering whether it exists at all.
	 */
	it('disables "start chat" until a counsellor has accepted', () => {
		const utils = renderDialog({ canStartChat: false });
		const start = button(utils, /Chat jetzt starten/i);
		expect((start as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(start);
		expect(utils.onStartChat).not.toHaveBeenCalled();
	});

	it('enables "start chat" once somebody has accepted', () => {
		const utils = renderDialog({ canStartChat: true });
		const start = button(utils, /Chat jetzt starten/i);
		expect((start as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(start);
		expect(utils.onStartChat).toHaveBeenCalledTimes(1);
	});

	/**
	 * Deleting is irreversible for an anonymous account: the access is
	 * deactivated and there is no password recovery, so a single stray tap
	 * must not be able to do it.
	 */
	it('does not delete on the first click', () => {
		const utils = renderDialog();
		fireEvent.click(button(utils, /Zugang löschen/i));
		expect(utils.onDeleteAccess).not.toHaveBeenCalled();
	});

	it('deletes only after the confirmation step', () => {
		const utils = renderDialog();
		fireEvent.click(button(utils, /Zugang löschen/i));
		fireEvent.click(button(utils, /Ja, endgültig löschen/i));
		expect(utils.onDeleteAccess).toHaveBeenCalledTimes(1);
	});

	it('lets the asker back out of the confirmation', () => {
		const utils = renderDialog();
		fireEvent.click(button(utils, /Zugang löschen/i));
		fireEvent.click(button(utils, /Abbrechen/i));
		expect(utils.onDeleteAccess).not.toHaveBeenCalled();
		expect(button(utils, /Wartebereich bleiben/i)).toBeTruthy();
	});

	it('blocks every action while a request is in flight', () => {
		const utils = renderDialog({ busy: true });
		[/Wartebereich bleiben/i, /Zugang löschen/i].forEach((pattern) => {
			const control = button(utils, pattern) as HTMLButtonElement;
			expect(control.disabled).toBe(true);
		});
	});

	/**
	 * If ending the conversation fails, the asker must be able to try again —
	 * silently swallowing the error would leave them believing they had left
	 * while the account is still live.
	 */
	it('surfaces a failure and keeps the confirmation reachable', () => {
		const utils = renderDialog({ errorMessage: 'Hat nicht geklappt.' });
		fireEvent.click(button(utils, /Zugang löschen/i));
		expect(utils.getByRole('alert').textContent).toContain(
			'Hat nicht geklappt.'
		);
		fireEvent.click(button(utils, /Ja, endgültig löschen/i));
		expect(utils.onDeleteAccess).toHaveBeenCalledTimes(1);
	});

	it('shows no error region when nothing failed', () => {
		const utils = renderDialog();
		expect(utils.queryByRole('alert')).toBeNull();
	});

	it('is announced as a modal dialog', () => {
		const utils = renderDialog();
		const dialog = utils.getByRole('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});

	it('closes on Escape the same way as cancel', () => {
		const utils = renderDialog();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(utils.onStay).toHaveBeenCalledTimes(1);
	});
});
