// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportHandshakePrompt } from './SupportHandshakePrompt';
import {
	apiConfirmSupportHandshake,
	apiDeclineSupportHandshake,
	apiGetActiveSupportSessions,
	apiGetPendingSupportHandshakes,
	apiTerminateSupportSession
} from '../../api/apiSupportHandshake';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('./SupportRoomConversation', () => ({
	SupportRoomConversation: () => <div data-testid="support-conversation" />
}));
vi.mock('../../api/apiSupportHandshake', () => ({
	apiConfirmSupportHandshake: vi.fn(),
	apiDeclineSupportHandshake: vi.fn(),
	apiGetActiveSupportSessions: vi.fn(),
	apiGetPendingSupportHandshakes: vi.fn(),
	apiTerminateSupportSession: vi.fn()
}));

const pendingHandshake = (expiryDate: string) => ({
	id: 'hs-1',
	purpose: 'SUPPORT_ACCESS' as const,
	initiatorId: 'gsa-1',
	counterpartId: 'consultant-1',
	agencyId: 7,
	status: 'PENDING' as const,
	expiryDate
});

const activeSession = () => ({
	id: 'sess-1',
	handshakeId: 'hs-1',
	matrixRoomId: '!room:oriso',
	callMatrixRoomId: null,
	supportAdminId: 'gsa-1',
	supportAdminMatrixId: '@support-x:oriso',
	consultantId: 'consultant-1',
	agencyId: 7,
	status: 'ACTIVE' as const,
	expiryDate: new Date(Date.now() + 4 * 3600_000).toISOString()
});

const inFiveMinutes = () => new Date(Date.now() + 300_000).toISOString();

describe('SupportHandshakePrompt', () => {
	afterEach(() => vi.clearAllMocks());

	it('requires the authenticated consultant to confirm with a fresh password and a fresh second factor', async () => {
		vi.mocked(apiGetPendingSupportHandshakes).mockResolvedValue([
			pendingHandshake(inFiveMinutes())
		]);
		vi.mocked(apiGetActiveSupportSessions).mockResolvedValue([]);
		vi.mocked(apiConfirmSupportHandshake).mockResolvedValue(
			pendingHandshake(inFiveMinutes())
		);

		const { unmount } = render(<SupportHandshakePrompt />);

		expect(
			await screen.findByText('supportAccess.request.title')
		).toBeTruthy();
		const approve = screen.getByRole('button', {
			name: 'supportAccess.approve'
		});
		expect((approve as HTMLButtonElement).disabled).toBe(true);

		fireEvent.change(screen.getByLabelText('supportAccess.password'), {
			target: { value: 'fresh-password' }
		});
		// The password alone must not be enough to arm the button: the server verifies both
		// credentials in one direct-grant call and cannot separate them.
		expect((approve as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(screen.getByLabelText('supportAccess.otp'), {
			target: { value: '123456' }
		});
		fireEvent.click(approve);

		await waitFor(() =>
			expect(apiConfirmSupportHandshake).toHaveBeenCalledWith(
				'hs-1',
				'fresh-password',
				'123456'
			)
		);
		unmount();
	});

	it('lets the consultant refuse explicitly without any password', async () => {
		vi.mocked(apiGetPendingSupportHandshakes).mockResolvedValue([
			pendingHandshake(inFiveMinutes())
		]);
		vi.mocked(apiGetActiveSupportSessions).mockResolvedValue([]);
		vi.mocked(apiDeclineSupportHandshake).mockResolvedValue(
			pendingHandshake(inFiveMinutes())
		);

		const { unmount } = render(<SupportHandshakePrompt />);

		fireEvent.click(
			await screen.findByRole('button', {
				name: 'supportAccess.decline'
			})
		);

		await waitFor(() =>
			expect(apiDeclineSupportHandshake).toHaveBeenCalledWith('hs-1')
		);
		expect(apiConfirmSupportHandshake).not.toHaveBeenCalled();
		unmount();
	});

	it('refuses to confirm once the five-minute window has closed', async () => {
		vi.mocked(apiGetPendingSupportHandshakes).mockResolvedValue([
			pendingHandshake(new Date(Date.now() - 1000).toISOString())
		]);
		vi.mocked(apiGetActiveSupportSessions).mockResolvedValue([]);

		const { unmount } = render(<SupportHandshakePrompt />);

		expect(
			await screen.findByText('supportAccess.request.lapsed')
		).toBeTruthy();
		const approve = screen.getByRole('button', {
			name: 'supportAccess.approve'
		});
		// Nothing may still be confirmable client-side after the window: the row is gone anyway.
		expect((approve as HTMLButtonElement).disabled).toBe(true);
		unmount();
	});

	it('tears the room down as soon as the server stops reporting the session', async () => {
		vi.mocked(apiGetPendingSupportHandshakes).mockResolvedValue([]);
		vi.mocked(apiGetActiveSupportSessions)
			.mockResolvedValueOnce([activeSession()])
			.mockResolvedValue([]);
		vi.mocked(apiTerminateSupportSession).mockResolvedValue(undefined);

		const { unmount } = render(<SupportHandshakePrompt />);

		expect(await screen.findByTestId('support-conversation')).toBeTruthy();

		fireEvent.click(
			screen.getByRole('button', { name: 'supportAccess.terminate' })
		);

		// The local view follows the server, not a local timer: once the session is no longer
		// reported, the conversation and any running call are gone.
		await waitFor(() =>
			expect(screen.queryByTestId('support-conversation')).toBeNull()
		);
		expect(await screen.findByText('supportAccess.ended')).toBeTruthy();
		unmount();
	});

	it("reads a zoneless server timestamp as UTC, not as the viewer's local time", async () => {
		// The backend serialises LocalDateTime in UTC without a zone suffix. Parsed as local time
		// east of Greenwich it is already in the past, and the consultant would be told the request
		// had lapsed the moment it arrived.
		const zoneless = new Date(Date.now() + 300_000)
			.toISOString()
			.replace('Z', '');
		vi.mocked(apiGetPendingSupportHandshakes).mockResolvedValue([
			pendingHandshake(zoneless)
		]);
		vi.mocked(apiGetActiveSupportSessions).mockResolvedValue([]);

		const { unmount } = render(<SupportHandshakePrompt />);

		expect(
			await screen.findByText('supportAccess.request.title')
		).toBeTruthy();
		const approve = screen.getByRole('button', {
			name: 'supportAccess.approve'
		});
		fireEvent.change(screen.getByLabelText('supportAccess.password'), {
			target: { value: 'fresh-password' }
		});
		fireEvent.change(screen.getByLabelText('supportAccess.otp'), {
			target: { value: '123456' }
		});
		// Not disabled means the window is still open, which is the whole point.
		expect((approve as HTMLButtonElement).disabled).toBe(false);
		unmount();
	});
});
