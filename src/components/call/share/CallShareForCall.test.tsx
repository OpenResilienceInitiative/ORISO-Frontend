// @vitest-environment oriso-jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import {
	apiCreateCallShareLink,
	apiUpdateCallShareLink
} from '../../../api/apiCallShareLink';
import { CallShareForCall, SHARE_LINK_RETRY_MS } from './CallShareForCall';
import type { CallShareSettings } from './callShareSettings';

vi.mock('../../../api/apiCallShareLink', () => ({
	apiCreateCallShareLink: vi.fn(),
	apiUpdateCallShareLink: vi.fn()
}));

/* This project has no jest-dom matchers, so read the DOM directly. */

const link = {
	id: 7,
	url: 'https://app.example/invite/abc',
	settings: { knock: true, guestAccountMode: 'GUEST_CHOOSES' as const },
	temporaryAccountAllowed: true,
	allowedGuestAccountModes: [
		'TEMPORARY' as const,
		'GUEST_CHOOSES' as const,
		'PERMANENT' as const
	]
};

const openPanel = async () => {
	await userEvent.click(
		await screen.findByRole('button', { name: 'calls.share.open' })
	);
	return screen.findByRole('switch', { name: 'calls.share.knock.label' });
};

/* UserService#1662: the guest account select replaced the temporary switch. */
const modeButton = (mode: string) =>
	screen.getByRole('button', { name: `guestAccountMode.option.${mode}` });
const chooseMode = async (from: string, to: string) => {
	await userEvent.click(modeButton(from));
	await userEvent.click(
		await screen.findByRole('option', {
			name: `guestAccountMode.option.${to}`
		})
	);
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiCreateCallShareLink).mockResolvedValue(link);
});
afterEach(cleanup);

it('shows the link of this call with its server settings', async () => {
	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		settings: { knock: false, guestAccountMode: 'GUEST_CHOOSES' as const }
	});
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	expect(apiCreateCallShareLink).toHaveBeenCalledWith({
		sourceRoomId: '!r:x',
		callId: 'c1'
	});
	expect(knock.checked).toBe(false);
	expect(
		(
			screen.getByRole('textbox', {
				name: 'calls.share.linkLabel'
			}) as HTMLInputElement
		).value
	).toBe(link.url);
});

it('shows no share button when the call cannot be shared', async () => {
	vi.mocked(apiCreateCallShareLink).mockResolvedValue(null);
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	await vi.waitFor(() => expect(apiCreateCallShareLink).toHaveBeenCalled());
	expect(
		screen.queryByRole('button', { name: 'calls.share.open' })
	).toBeNull();
});

it('sends a changed setting to the same link', async () => {
	vi.mocked(apiUpdateCallShareLink).mockResolvedValue({
		knock: false,
		guestAccountMode: 'GUEST_CHOOSES' as const
	});
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	await userEvent.click(knock);

	expect(apiUpdateCallShareLink).toHaveBeenCalledWith(7, {
		knock: false,
		guestAccountMode: 'GUEST_CHOOSES' as const
	});
	await vi.waitFor(() => expect(knock.checked).toBe(false));
});

it('puts the switch back when the change did not reach the server', async () => {
	vi.mocked(apiUpdateCallShareLink).mockRejectedValue(new Error('CATCH_ALL'));
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	await userEvent.click(knock);

	await vi.waitFor(() => expect(knock.checked).toBe(true));
});

it('falls back to what the server has when overlapping changes both fail', async () => {
	const failures: Array<(error: Error) => void> = [];
	vi.mocked(apiUpdateCallShareLink).mockImplementation(
		() => new Promise((_, reject) => failures.push(reject))
	);
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	await userEvent.click(knock);
	await chooseMode('GUEST_CHOOSES', 'PERMANENT');
	failures[0](new Error('CATCH_ALL'));
	await vi.waitFor(() => expect(failures).toHaveLength(2));
	failures[1](new Error('CATCH_ALL'));

	await vi.waitFor(() => {
		expect(knock.checked).toBe(true);
		expect(modeButton('GUEST_CHOOSES')).toBeTruthy();
	});
});

/* Two PATCHes in flight could land out of order and leave the older one on the server. */
it('sends one change at a time and skips changes a newer one replaced', async () => {
	const answers: Array<(saved: CallShareSettings) => void> = [];
	vi.mocked(apiUpdateCallShareLink).mockImplementation(
		() => new Promise((resolve) => answers.push(resolve))
	);
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	await userEvent.click(knock);
	await chooseMode('GUEST_CHOOSES', 'PERMANENT');
	await userEvent.click(knock);
	expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(1);

	answers[0]({ knock: false, guestAccountMode: 'GUEST_CHOOSES' as const });
	await vi.waitFor(() =>
		expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(2)
	);
	expect(apiUpdateCallShareLink).toHaveBeenLastCalledWith(7, {
		knock: true,
		guestAccountMode: 'PERMANENT' as const
	});
	answers[1]({ knock: true, guestAccountMode: 'PERMANENT' as const });
	await vi.waitFor(() => {
		expect(knock.checked).toBe(true);
		expect(modeButton('PERMANENT')).toBeTruthy();
	});
});

it('asks again when the call could not be shared yet', async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	try {
		vi.mocked(apiCreateCallShareLink)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(link);
		render(
			<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />
		);
		await vi.advanceTimersByTimeAsync(SHARE_LINK_RETRY_MS);

		expect(
			await screen.findByRole('button', { name: 'calls.share.open' })
		).toBeTruthy();
		expect(apiCreateCallShareLink).toHaveBeenCalledTimes(2);
	} finally {
		vi.useRealTimers();
	}
});

/* GroupCallWidget sits at z-index 10000; MUI's default layers would open behind it. */
it.each(['phone', 'desktop'] as const)(
	'opens the %s surface above the call window',
	async (layout) => {
		render(
			<CallShareForCall sourceRoomId="!r:x" callId="c1" layout={layout} />
		);

		const knock = await openPanel();
		const root = knock.closest('.MuiModal-root') as HTMLElement;
		expect(Number(getComputedStyle(root).zIndex)).toBeGreaterThan(10000);
	}
);

it('keeps a late answer for the previous call off the next call', async () => {
	const answers: Array<(saved: CallShareSettings) => void> = [];
	vi.mocked(apiUpdateCallShareLink).mockImplementation(
		() => new Promise((resolve) => answers.push(resolve))
	);
	const { rerender } = render(
		<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />
	);
	await userEvent.click(await openPanel());
	expect(answers).toHaveLength(1);

	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		id: 8,
		settings: { knock: true, guestAccountMode: 'PERMANENT' as const }
	});
	rerender(
		<CallShareForCall sourceRoomId="!r:x" callId="c2" layout="phone" />
	);
	await vi.waitFor(() =>
		expect(apiCreateCallShareLink).toHaveBeenLastCalledWith({
			sourceRoomId: '!r:x',
			callId: 'c2'
		})
	);
	answers[0]({ knock: false, guestAccountMode: 'GUEST_CHOOSES' as const });

	const knock = (await openPanel()) as HTMLInputElement;
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(knock.checked).toBe(true);
});

it('does not hold the next call’s changes behind one still out for the previous call', async () => {
	vi.mocked(apiUpdateCallShareLink).mockImplementation((id) =>
		id === 7
			? new Promise(() => {})
			: Promise.resolve({
					knock: false,
					guestAccountMode: 'PERMANENT' as const
				})
	);
	const { rerender } = render(
		<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />
	);
	await userEvent.click(await openPanel());
	expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(1);

	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		id: 8,
		settings: { knock: true, guestAccountMode: 'PERMANENT' as const }
	});
	rerender(
		<CallShareForCall sourceRoomId="!r:x" callId="c2" layout="phone" />
	);
	await userEvent.click(await openPanel());
	await vi.waitFor(() =>
		expect(apiUpdateCallShareLink).toHaveBeenLastCalledWith(8, {
			knock: false,
			guestAccountMode: 'PERMANENT' as const
		})
	);
});

/* GroupCallWidget puts .element-call-container into fullscreen; body is hidden then. */
it('opens inside the fullscreen call and closes when fullscreen changes', async () => {
	const fullscreen = document.createElement('div');
	document.body.appendChild(fullscreen);
	Object.defineProperty(document, 'fullscreenElement', {
		configurable: true,
		get: () => fullscreen
	});
	try {
		render(
			<CallShareForCall
				sourceRoomId="!r:x"
				callId="c1"
				layout="desktop"
			/>
		);
		const knock = await openPanel();
		expect(fullscreen.contains(knock)).toBe(true);

		document.dispatchEvent(new Event('fullscreenchange'));
		await vi.waitFor(() =>
			expect(
				screen.queryByRole('switch', {
					name: 'calls.share.knock.label'
				})
			).toBeNull()
		);
	} finally {
		delete (document as { fullscreenElement?: Element }).fullscreenElement;
		fullscreen.remove();
	}
});

/*
 * #2215 review: with host chrome the call's header hands out the link, but
 * the temporary-account switch exists only here, so the panel stays where
 * the link may create one.
 */
it('stays reachable beside the header link when temporary accounts are allowed', async () => {
	render(
		<CallShareForCall
			sourceRoomId="!r:x"
			callId="c1"
			layout="phone"
			onlyForTemporaryAccounts
		/>
	);
	expect(
		await screen.findByRole('button', { name: 'calls.share.open' })
	).toBeTruthy();
});

/* UserService#1662: the select offers only what platform and Träger allow. */
it('offers only the guest account modes the server allows', async () => {
	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		settings: { knock: true, guestAccountMode: 'PERMANENT' },
		allowedGuestAccountModes: ['GUEST_CHOOSES', 'PERMANENT']
	});
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);
	await openPanel();
	expect(
		screen.queryByRole('switch', { name: /temporaryAccount/ })
	).toBeNull();

	await userEvent.click(modeButton('PERMANENT'));
	expect(
		screen.getAllByRole('option').map((option) => option.textContent)
	).toEqual([
		'guestAccountMode.option.GUEST_CHOOSES',
		'guestAccountMode.option.PERMANENT'
	]);
});

it('stays out of the way of the header link when no temporary account is possible', async () => {
	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		temporaryAccountAllowed: false
	});
	render(
		<CallShareForCall
			sourceRoomId="!r:x"
			callId="c1"
			layout="phone"
			onlyForTemporaryAccounts
		/>
	);
	await vi.waitFor(() => expect(apiCreateCallShareLink).toHaveBeenCalled());
	expect(
		screen.queryByRole('button', { name: 'calls.share.open' })
	).toBeNull();
});
