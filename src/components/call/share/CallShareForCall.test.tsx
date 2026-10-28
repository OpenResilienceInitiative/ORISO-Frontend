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
	failures.forEach((fail) => fail(new Error('CATCH_ALL')));

	await vi.waitFor(() => {
		expect(knock.checked).toBe(true);
		expect(temporary.checked).toBe(true);
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
