// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useDirectLinkKnock, phaseForKnockStatus } from './useDirectLinkKnock';
import { readPendingKnock, rememberPendingKnock } from './directLinkEntryFlow';

const knock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO' as const,
	status: 'PENDING' as const
};

const answer = (status: string) => ({
	id: 21,
	sessionId: 9,
	status,
	medium: 'VIDEO',
	requestedAt: '2026-10-28T10:00:00Z'
});

beforeEach(() => {
	sessionStorage.clear();
	rememberPendingKnock(knock);
});

describe('useDirectLinkKnock', () => {
	it('maps the server status onto the dialog phase', () => {
		expect(phaseForKnockStatus('PENDING')).toBe('waiting');
		expect(phaseForKnockStatus('ADMITTED')).toBe('admitted');
		expect(phaseForKnockStatus('DECLINED')).toBe('declined');
		expect(phaseForKnockStatus(undefined)).toBe('waiting');
	});

	it('waits until the counsellor lets the person in', async () => {
		const getKnock = vi
			.fn()
			.mockResolvedValueOnce(answer('PENDING'))
			.mockResolvedValue(answer('ADMITTED'));
		const { result } = renderHook(() =>
			useDirectLinkKnock(knock, { getKnock }, 10)
		);
		expect(result.current.phase).toBe('waiting');
		await waitFor(() => expect(result.current.phase).toBe('admitted'));
		expect(getKnock).toHaveBeenCalledWith(21);
	});

	it('shows the refusal and knocks again with a new knock', async () => {
		const getKnock = vi.fn().mockResolvedValue(answer('DECLINED'));
		const start = vi.fn().mockResolvedValue({
			sessionId: 9,
			medium: 'VIDEO',
			admission: 'KNOCK',
			created: false,
			knockId: 22,
			knockStatus: 'PENDING'
		});
		const { result } = renderHook(() =>
			useDirectLinkKnock(knock, { getKnock, start }, 10)
		);
		await waitFor(() => expect(result.current.phase).toBe('declined'));
		getKnock.mockResolvedValue({ ...answer('PENDING'), id: 22 });
		act(() => result.current.knockAgain());
		await waitFor(() => expect(result.current.phase).toBe('waiting'));
		expect(start).toHaveBeenCalledWith('tok');
		expect(readPendingKnock()?.knockId).toBe(22);
		await waitFor(() => expect(getKnock).toHaveBeenCalledWith(22));
	});

	it('closes the refusal when it cannot knock again', async () => {
		const getKnock = vi.fn().mockResolvedValue(answer('DECLINED'));
		const declined = { ...knock, status: 'DECLINED' as const };
		// Adopted from another device: no link token to knock with.
		const { result: noToken } = renderHook(() =>
			useDirectLinkKnock({ ...declined, token: '' }, { getKnock }, 10)
		);
		act(() => noToken.current.knockAgain());
		expect(noToken.current.gone).toBe(true);

		const start = vi.fn().mockRejectedValue(new Error('403'));
		const { result } = renderHook(() =>
			useDirectLinkKnock(declined, { getKnock, start }, 10)
		);
		act(() => result.current.knockAgain());
		await waitFor(() => expect(result.current.gone).toBe(true));
		expect(readPendingKnock()).toBeNull();
	});

	it('lets the person in when the link no longer asks for a knock', async () => {
		const getKnock = vi.fn().mockResolvedValue(answer('DECLINED'));
		const start = vi.fn().mockResolvedValue({
			sessionId: 9,
			medium: 'VIDEO',
			admission: 'DIRECT'
		});
		const { result } = renderHook(() =>
			useDirectLinkKnock(
				{ ...knock, status: 'DECLINED' as const },
				{ getKnock, start },
				10
			)
		);
		act(() => result.current.knockAgain());
		await waitFor(() => expect(result.current.phase).toBe('admitted'));
	});

	it('withdraws the knock on "Nicht mehr warten"', async () => {
		const cancelKnock = vi.fn().mockResolvedValue(undefined);
		const getKnock = vi.fn().mockResolvedValue(answer('PENDING'));
		const { result } = renderHook(() =>
			useDirectLinkKnock(knock, { getKnock, cancelKnock }, 10)
		);
		act(() => result.current.cancel());
		expect(result.current.gone).toBe(true);
		expect(cancelKnock).toHaveBeenCalledWith(21);
		expect(readPendingKnock()).toBeNull();
	});

	it('goes when the knock was withdrawn elsewhere', async () => {
		const getKnock = vi.fn().mockResolvedValue(answer('CANCELLED'));
		const { result } = renderHook(() =>
			useDirectLinkKnock(knock, { getKnock }, 10)
		);
		await waitFor(() => expect(result.current.gone).toBe(true));
		expect(readPendingKnock()).toBeNull();
	});

	it('keeps waiting through a failed poll', async () => {
		const getKnock = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue(answer('ADMITTED'));
		const { result } = renderHook(() =>
			useDirectLinkKnock(knock, { getKnock }, 10)
		);
		await waitFor(() => expect(result.current.phase).toBe('admitted'));
	});
});
