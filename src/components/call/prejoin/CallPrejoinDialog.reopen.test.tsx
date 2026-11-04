// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { CallDeviceCheckProps } from '../../waitingRoom/callEntry/CallDeviceCheck';

/*
 * The device check reopened for the same room (CodeRabbit on #2028, #2037):
 * it opens on the headset and camera picked last time, the person's own pick
 * in the reopened check wins, and a device that is gone falls back to the
 * default. Driven through the dialog itself: pick, "Fertig", open again.
 */

vi.mock('../../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: ({
		media,
		onJoin
	}: {
		media: CallDeviceCheckProps;
		onJoin: () => void;
	}) => (
		<div>
			<output data-testid="microphone">
				{media.selection.microphone ?? ''}
			</output>
			<output data-testid="camera">{media.selection.camera ?? ''}</output>
			<output data-testid="listed">
				{String(media.devices.microphone.length)}
			</output>
			{(['mic-1', 'mic-2'] as const).map((id) => (
				<button
					key={id}
					onClick={() => media.onSelectDevice('microphone', id)}
				>
					{`pick ${id}`}
				</button>
			))}
			<button onClick={() => media.onSelectDevice('camera', 'cam-2')}>
				pick cam-2
			</button>
			<button onClick={onJoin}>done</button>
		</div>
	)
}));

const { CallPrejoinDialog } = await import('./CallPrejoinDialog');
const { forgetAllJoinMedia, peekJoinMedia } = await import('./callPrejoin');

const ROOM = '!circle:oriso';

const LISTED: [MediaDeviceKind, string, string][] = [
	['videoinput', 'cam-1', 'FaceTime HD-Kamera'],
	['videoinput', 'cam-2', 'Logitech C920'],
	['audioinput', 'mic-1', 'MacBook Pro-Mikrofon'],
	['audioinput', 'mic-2', 'Jabra Evolve2 Headset']
];

const fakeStream = () =>
	({
		getTracks: () => [],
		getAudioTracks: () => [],
		getVideoTracks: () => []
	}) as unknown as MediaStream;

/** @param unplugged Device ids the browser no longer lists. */
const mediaDevices = (unplugged: string[] = []) =>
	({
		getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
		enumerateDevices: vi.fn(() =>
			Promise.resolve(
				LISTED.filter(
					([, deviceId]) => !unplugged.includes(deviceId)
				).map(([kind, deviceId, label]) => ({
					kind,
					deviceId,
					label,
					groupId: deviceId
				}))
			)
		),
		addEventListener: () => undefined,
		removeEventListener: () => undefined
	}) as unknown as MediaDevices & { getUserMedia: ReturnType<typeof vi.fn> };

const open = (devices: MediaDevices = mediaDevices()) =>
	render(
		<CallPrejoinDialog
			modality="video"
			roomRef={ROOM}
			purpose="check"
			onClose={vi.fn()}
			mediaDevices={devices}
		/>
	);

const listed = (count: number) =>
	waitFor(() =>
		expect(screen.getByTestId('listed').textContent).toBe(String(count))
	);

/** First check: headset and second camera, "Fertig", closed. */
const pickHeadsetThenDone = async () => {
	const first = open();
	await listed(2);
	fireEvent.click(screen.getByText('pick mic-2'));
	fireEvent.click(screen.getByText('pick cam-2'));
	await listed(2);
	fireEvent.click(screen.getByText('done'));
	first.unmount();
};

beforeEach(() => {
	vi.stubGlobal(
		'AudioContext',
		class {
			createAnalyser() {
				return { fftSize: 0, getByteTimeDomainData: () => undefined };
			}
			createMediaStreamSource() {
				return { connect: () => undefined };
			}
			close() {
				return Promise.resolve();
			}
		}
	);
	vi.stubGlobal('requestAnimationFrame', () => 0);
	vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
	cleanup();
	forgetAllJoinMedia();
	vi.unstubAllGlobals();
});

describe('CallPrejoinDialog reopened for the same room', () => {
	it('opens on the headset and camera picked last time', async () => {
		await pickHeadsetThenDone();
		const devices = mediaDevices();
		open(devices);

		expect(screen.getByTestId('microphone').textContent).toBe('mic-2');
		expect(screen.getByTestId('camera').textContent).toBe('cam-2');
		// The preview runs on them, not on the browser's default.
		await waitFor(() =>
			expect(devices.getUserMedia).toHaveBeenLastCalledWith({
				audio: { deviceId: { exact: 'mic-2' } },
				video: { deviceId: { exact: 'cam-2' } }
			})
		);
		await listed(2);
		fireEvent.click(screen.getByText('done'));
		expect(peekJoinMedia(ROOM)).toMatchObject({
			microphoneLabel: 'Jabra Evolve2 Headset',
			cameraLabel: 'Logitech C920'
		});
	});

	it("keeps the person's own pick in the reopened check", async () => {
		await pickHeadsetThenDone();
		open();
		await listed(2);

		fireEvent.click(screen.getByText('pick mic-1'));
		// The picked microphone restarts the preview and the list is read
		// again; the saved headset does not come back.
		await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
		expect(screen.getByTestId('microphone').textContent).toBe('mic-1');
		fireEvent.click(screen.getByText('done'));
		expect(peekJoinMedia(ROOM)?.microphoneLabel).toBe(
			'MacBook Pro-Mikrofon'
		);
	});

	it('falls back to the default when the saved headset is gone', async () => {
		await pickHeadsetThenDone();
		open(mediaDevices(['mic-2']));
		await listed(1);
		fireEvent.click(screen.getByText('done'));
		expect(peekJoinMedia(ROOM)).toMatchObject({
			microphoneLabel: 'MacBook Pro-Mikrofon',
			cameraLabel: 'Logitech C920'
		});
	});
});
