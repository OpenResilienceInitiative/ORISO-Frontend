// @vitest-environment oriso-jsdom
/**
 * FE#2542: a guest of a link with knocking waits on the link page until the
 * counsellor lets them in; the app (and its knock dialog) opens only then.
 */
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import {
	DirectLinkNotAdmittedError,
	type OpenDirectLinkDeps,
	type PendingKnock
} from './directLinkEntryFlow';

const roomProps = vi.hoisted(() => ({ current: null as any }));
vi.mock('../waitingRoom/callEntry/CallEntryRoom', () => ({
	CallEntryRoom: (props: any) => {
		roomProps.current = props;
		return <div data-testid="call-entry-room" />;
	}
}));
vi.mock('../waitingRoom/callEntry/useLiveCallDevices', () => ({
	useLiveCallDevices: () => ({
		devices: {
			microphone: [{ id: 'mic-1', label: 'Headset' }],
			camera: [{ id: 'cam-1', label: 'FaceTime' }],
			speaker: []
		},
		stream: null,
		micLevel: 0,
		blocker: undefined,
		cameraMissing: false,
		retry: vi.fn()
	})
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const { DirectLinkCallEntry } = await import('./DirectLinkCallEntry');

const context = (over: object = {}) =>
	({
		tenantId: 1,
		agencyId: 7,
		topicId: 11,
		chatType: 'VIDEO',
		admission: 'KNOCK',
		...over
	}) as unknown as InviteLinkContext;

const knock: PendingKnock = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO',
	status: 'PENDING'
};
const account = { username: 'u', password: 'p', identity: {} } as never;

/* Stands in for `openDirectLinkConversation`: waits as the flow does. */
const openThatKnocks =
	(seen: { media?: unknown } = {}) =>
	async (
		_token: string,
		wait?: Pick<OpenDirectLinkDeps, 'waitForAdmission' | 'entryMedia'>
	) => {
		const outcome = await wait!.waitForAdmission!(knock);
		if (outcome !== 'admitted')
			throw new DirectLinkNotAdmittedError(outcome);
		seen.media = wait!.entryMedia!();
	};

const mount = (deps: object, linkContext = context()) => {
	const addNotification = vi.fn();
	render(
		<NotificationsContext.Provider
			value={{ addNotification } as unknown as never}
		>
			<DirectLinkCallEntry
				token="tok"
				context={linkContext}
				modality="video"
				deps={{
					register: () => Promise.resolve(),
					saveAvatar: () => Promise.resolve(),
					knockPollMs: 1,
					...deps
				}}
			/>
		</NotificationsContext.Provider>
	);
	return addNotification;
};

describe('DirectLinkCallEntry waiting to be let in', () => {
	afterEach(() => {
		cleanup();
		roomProps.current = null;
	});

	it('plays no curtain over a link that knocks', () => {
		mount({ open: vi.fn() });
		expect(roomProps.current.closing).toBeNull();
	});

	it('keeps the curtain for a link that lets in directly', () => {
		mount({ open: vi.fn() }, context({ admission: 'DIRECT' }));
		expect(roomProps.current.closing).toBe('call');
	});

	it('waits on the page and enters once let in, with the switches of then', async () => {
		let answer = 'PENDING';
		const getKnock = vi.fn(() => Promise.resolve({ status: answer }));
		const seen: { media?: unknown } = {};
		mount({ open: openThatKnocks(seen), getKnock });
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await waitFor(() => expect(roomProps.current.waiting).toBe(true));
		// The camera goes off while the person waits.
		act(() =>
			roomProps.current.onDeviceStateChange({
				micOn: true,
				cameraOn: false,
				selection: {}
			})
		);
		answer = 'ADMITTED';
		await expect(joined!).resolves.toBe(true);
		expect(seen.media).toEqual({
			media: {
				audio_enabled: true,
				video_enabled: false,
				microphoneLabel: 'Headset',
				cameraLabel: 'FaceTime'
			},
			cameraSwitch: false,
			selection: {}
		});
	});

	it('says so when the counsellor turned the person down, without an error', async () => {
		const getKnock = vi.fn().mockResolvedValue({ status: 'DECLINED' });
		const addNotification = mount({ open: openThatKnocks(), getKnock });
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await expect(joined!).resolves.toBe(false);
		await waitFor(() => expect(roomProps.current.turnedDown).toBe(true));
		expect(roomProps.current.waiting).toBe(false);
		expect(roomProps.current.joining).toBe(false);
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('ends the wait when the session is over (401), withdraws the knock and says so', async () => {
		const getKnock = vi.fn().mockRejectedValue({ status: 401 });
		const cancelKnock = vi.fn().mockResolvedValue(undefined);
		const addNotification = mount({
			open: openThatKnocks(),
			getKnock,
			cancelKnock
		});
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await expect(joined!).resolves.toBe(false);
		await waitFor(() => expect(roomProps.current.waitEnded).toBe(true));
		expect(roomProps.current.waiting).toBe(false);
		expect(roomProps.current.turnedDown).toBe(false);
		expect(cancelKnock).toHaveBeenCalledWith(21);
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('gives the page back when the knock is gone (404), without an error', async () => {
		const getKnock = vi.fn().mockRejectedValue({ status: 404 });
		const addNotification = mount({ open: openThatKnocks(), getKnock });
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await expect(joined!).resolves.toBe(false);
		await waitFor(() => expect(roomProps.current.waiting).toBe(false));
		expect(roomProps.current.turnedDown).toBe(false);
		expect(roomProps.current.waitEnded).toBe(false);
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('registers once: knocking again after a refusal keeps the account', async () => {
		const answer = { status: 'DECLINED' };
		const getKnock = vi.fn(() => Promise.resolve(answer));
		const register = vi.fn().mockResolvedValue(undefined);
		mount({ open: openThatKnocks(), getKnock, register });
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await expect(joined!).resolves.toBe(false);
		// The account exists: its fields go, and so does a second registration.
		await waitFor(() => expect(roomProps.current.signedIn).toBe(true));
		answer.status = 'ADMITTED';
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await expect(joined!).resolves.toBe(true);
		expect(register).toHaveBeenCalledOnce();
	});

	it('"Nicht mehr warten" withdraws the knock and gives the page back', async () => {
		const getKnock = vi.fn().mockResolvedValue({ status: 'PENDING' });
		const cancelKnock = vi.fn().mockResolvedValue(undefined);
		const addNotification = mount({
			open: openThatKnocks(),
			getKnock,
			cancelKnock
		});
		let joined: Promise<boolean>;
		await act(async () => {
			joined = roomProps.current.onJoin(account);
		});
		await waitFor(() => expect(roomProps.current.waiting).toBe(true));
		act(() => roomProps.current.onStopWaiting());
		await expect(joined!).resolves.toBe(false);
		expect(cancelKnock).toHaveBeenCalledWith(21);
		await waitFor(() => expect(roomProps.current.waiting).toBe(false));
		expect(roomProps.current.turnedDown).toBe(false);
		expect(addNotification).not.toHaveBeenCalled();
	});
});
