// @vitest-environment oriso-jsdom

import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';

/* The room owns the entry screen; here only what "Beitreten" does matters. */
const roomProps = vi.hoisted(() => ({ current: null as any }));
vi.mock('../waitingRoom/callEntry/CallEntryRoom', () => ({
	CallEntryRoom: (props: any) => {
		roomProps.current = props;
		return <div data-testid="call-entry-room" />;
	}
}));
vi.mock('../waitingRoom/callEntry/useLiveCallDevices', () => ({
	useLiveCallDevices: () => ({
		devices: [],
		stream: null,
		micLevel: 0,
		blocker: null,
		cameraMissing: false,
		retry: vi.fn()
	})
}));

const i18nMock = vi.hoisted(() => {
	const catalogue: Record<string, string> = {
		'directLink.entry.inactive': 'Dieser Link ist nicht mehr aktiv.',
		'directLink.entry.callsDisabled': 'Anrufe sind nicht möglich.',
		'directLink.entry.joinFailed':
			'Das hat nicht geklappt. Bitte versuchen Sie es erneut.'
	};
	return { t: (key: string) => catalogue[key] ?? key };
});
vi.mock('react-i18next', () => ({ useTranslation: () => i18nMock }));

const { DirectLinkCallEntry } = await import('./DirectLinkCallEntry');

const context = {
	tenantId: 1,
	agencyId: 7,
	topicId: 11,
	chatType: 'VIDEO'
} as unknown as InviteLinkContext;

const account = { username: 'u', password: 'p', identity: {} } as never;

const join = async (register: () => Promise<void>) => {
	const addNotification = vi.fn();
	render(
		<NotificationsContext.Provider
			value={{ addNotification } as unknown as never}
		>
			<DirectLinkCallEntry
				token="tok"
				context={context}
				modality="video"
				deps={{ register, open: vi.fn() }}
			/>
		</NotificationsContext.Provider>
	);
	await waitFor(() => expect(roomProps.current).not.toBeNull());
	await roomProps.current.onJoin(account);
	return addNotification;
};

describe('DirectLinkCallEntry join failure', () => {
	it('says a switched-off link is no longer active (#2012)', async () => {
		const addNotification = await join(() =>
			Promise.reject(new Response('', { status: 410 }))
		);
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Dieser Link ist nicht mehr aktiv.'
			})
		);
	});

	it('says calls are not possible on 403 FEATURE_DISABLED (#2012)', async () => {
		const addNotification = await join(() =>
			Promise.reject(
				new Response('', {
					status: 403,
					headers: { 'X-Reason': 'FEATURE_DISABLED' }
				})
			)
		);
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Anrufe sind nicht möglich.' })
		);
	});

	it('keeps the retry text for any other failure', async () => {
		const addNotification = await join(() =>
			Promise.reject(new Response('', { status: 500 }))
		);
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.'
			})
		);
	});
});
