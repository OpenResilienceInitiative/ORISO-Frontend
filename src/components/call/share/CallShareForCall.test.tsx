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

vi.mock('../../../api/apiCallShareLink', () => ({
	apiCreateCallShareLink: vi.fn(),
	apiUpdateCallShareLink: vi.fn()
}));

/* This project has no jest-dom matchers, so read the DOM directly. */

const link = {
	id: 7,
	url: 'https://app.example/invite/abc',
	settings: { knock: true, temporaryAccount: true },
	temporaryAccountAllowed: true
};

const openPanel = async () => {
	await userEvent.click(
		await screen.findByRole('button', { name: 'calls.share.open' })
	);
	return screen.findByRole('switch', { name: 'calls.share.knock.label' });
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiCreateCallShareLink).mockResolvedValue(link);
});
afterEach(cleanup);

it('shows the link of this call with its server settings', async () => {
	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		settings: { knock: false, temporaryAccount: true }
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
		temporaryAccount: true
	});
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	await userEvent.click(knock);

	expect(apiUpdateCallShareLink).toHaveBeenCalledWith(7, {
		knock: false,
		temporaryAccount: true
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
	const temporary = screen.getByRole('switch', {
		name: 'calls.share.temporaryAccount.label'
	}) as HTMLInputElement;
	await userEvent.click(knock);
	await userEvent.click(temporary);
	failures[0](new Error('CATCH_ALL'));
	await vi.waitFor(() => expect(failures).toHaveLength(2));
	failures[1](new Error('CATCH_ALL'));

	await vi.waitFor(() => {
		expect(knock.checked).toBe(true);
		expect(temporary.checked).toBe(true);
	});
});

/* Two PATCHes in flight could land out of order and leave the older one on the server. */
it('sends one change at a time and skips changes a newer one replaced', async () => {
	const answers: Array<
		(saved: { knock: boolean; temporaryAccount: boolean }) => void
	> = [];
	vi.mocked(apiUpdateCallShareLink).mockImplementation(
		() => new Promise((resolve) => answers.push(resolve))
	);
	render(<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />);

	const knock = (await openPanel()) as HTMLInputElement;
	const temporary = screen.getByRole('switch', {
		name: 'calls.share.temporaryAccount.label'
	}) as HTMLInputElement;
	await userEvent.click(knock);
	await userEvent.click(temporary);
	await userEvent.click(knock);
	expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(1);

	answers[0]({ knock: false, temporaryAccount: true });
	await vi.waitFor(() =>
		expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(2)
	);
	expect(apiUpdateCallShareLink).toHaveBeenLastCalledWith(7, {
		knock: true,
		temporaryAccount: false
	});
	answers[1]({ knock: true, temporaryAccount: false });
	await vi.waitFor(() => {
		expect(knock.checked).toBe(true);
		expect(temporary.checked).toBe(false);
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
	const answers: Array<
		(saved: { knock: boolean; temporaryAccount: boolean }) => void
	> = [];
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
		settings: { knock: true, temporaryAccount: false }
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
	answers[0]({ knock: false, temporaryAccount: true });

	const knock = (await openPanel()) as HTMLInputElement;
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(knock.checked).toBe(true);
});

it('does not hold the next call’s changes behind one still out for the previous call', async () => {
	vi.mocked(apiUpdateCallShareLink).mockImplementation((id) =>
		id === 7
			? new Promise(() => {})
			: Promise.resolve({ knock: false, temporaryAccount: false })
	);
	const { rerender } = render(
		<CallShareForCall sourceRoomId="!r:x" callId="c1" layout="phone" />
	);
	await userEvent.click(await openPanel());
	expect(apiUpdateCallShareLink).toHaveBeenCalledTimes(1);

	vi.mocked(apiCreateCallShareLink).mockResolvedValue({
		...link,
		id: 8,
		settings: { knock: true, temporaryAccount: false }
	});
	rerender(
		<CallShareForCall sourceRoomId="!r:x" callId="c2" layout="phone" />
	);
	await userEvent.click(await openPanel());
	await vi.waitFor(() =>
		expect(apiUpdateCallShareLink).toHaveBeenLastCalledWith(8, {
			knock: false,
			temporaryAccount: false
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
