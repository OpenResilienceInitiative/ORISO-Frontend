// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CallJoinHooks } from '../../directLinkEntry/callMessageKnock';

const device = vi.hoisted(() => ({
	controls: { micOn: true, cameraOn: true, selection: {} },
	cameraAvailable: true,
	initial: undefined as { selection: object } | undefined
}));

vi.mock('../../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: ({ joining, onJoin }: any) => (
		<div>
			<output data-testid="joining">{String(joining)}</output>
			<button onClick={onJoin}>join</button>
		</div>
	)
}));
vi.mock('../../waitingRoom/callEntry/useCallDeviceCheck', () => ({
	useCallDeviceCheck: (
		_modality: string,
		options?: { initial?: { selection: object } }
	) => {
		device.initial = options?.initial;
		return {
			check: { devices: { microphone: [], camera: [] } },
			controls: device.controls,
			cameraAvailable: device.cameraAvailable,
			retry: vi.fn()
		};
	}
}));

const { CallPrejoinDialog } = await import('./CallPrejoinDialog');
const {
	forgetAllJoinMedia,
	keepDeviceChoice,
	peekJoinMedia,
	rememberJoinMedia
} = await import('./callPrejoin');

const ROOM = '!room:oriso';

/** A join whose lookup the test finishes by hand. */
const lookup = () => {
	let finish: (result: 'joined' | 'ended' | 'cancelled') => void = () =>
		undefined;
	let hooks: CallJoinHooks = {};
	const onJoin = vi.fn((given: CallJoinHooks) => {
		hooks = given;
		return new Promise((resolve) => {
			finish = resolve;
		});
	});
	return {
		onJoin,
		before: () => hooks.beforeJoin?.(),
		finish: (result: 'joined' | 'ended' | 'cancelled') =>
			act(async () => finish(result))
	};
};

const dialog = (onJoin: (hooks: CallJoinHooks) => unknown) => (
	<CallPrejoinDialog
		modality="video"
		roomRef={ROOM}
		onClose={vi.fn()}
		onJoin={onJoin}
	/>
);

describe('CallPrejoinDialog and the choice it keeps', () => {
	it('opens on the devices an earlier check picked for this room', () => {
		const selection = { microphone: 'headset' };
		keepDeviceChoice(ROOM, 'video', {
			controls: { micOn: true, cameraOn: true, selection },
			cameraAvailable: true
		});
		render(dialog(vi.fn()));
		expect(device.initial?.selection).toEqual(selection);
	});

	afterEach(() => {
		cleanup();
		forgetAllJoinMedia();
		device.controls = { micOn: true, cameraOn: true, selection: {} };
	});

	it('keeps the switches as they are when the join goes out', async () => {
		const join = lookup();
		const { rerender } = render(dialog(join.onJoin));
		fireEvent.click(screen.getByText('join'));

		// Switched off while the lookup runs.
		device.controls = { ...device.controls, cameraOn: false };
		rerender(dialog(join.onJoin));
		join.before();
		await join.finish('joined');

		expect(peekJoinMedia(ROOM)).toEqual({
			audio_enabled: true,
			video_enabled: false
		});
	});

	it('keeps nothing for a join that never went out', async () => {
		const join = lookup();
		render(dialog(join.onJoin));
		fireEvent.click(screen.getByText('join'));
		await join.finish('cancelled');
		expect(peekJoinMedia(ROOM)).toBeNull();
	});

	it('forgets the choice when the join failed', async () => {
		const join = lookup();
		render(dialog(join.onJoin));
		fireEvent.click(screen.getByText('join'));
		join.before();
		expect(peekJoinMedia(ROOM)).not.toBeNull();
		await join.finish('ended');
		expect(peekJoinMedia(ROOM)).toBeNull();
	});

	it("leaves an earlier check's choice alone when refused before the join", async () => {
		const kept = { audio_enabled: false, video_enabled: true };
		rememberJoinMedia(ROOM, kept);
		const join = lookup();
		render(dialog(join.onJoin));
		fireEvent.click(screen.getByText('join'));
		await join.finish('ended');
		expect(peekJoinMedia(ROOM)).toEqual(kept);
	});

	it('shows the main button waiting during the lookup', async () => {
		const join = lookup();
		render(dialog(join.onJoin));
		expect(screen.getByTestId('joining').textContent).toBe('false');
		fireEvent.click(screen.getByText('join'));
		expect(screen.getByTestId('joining').textContent).toBe('true');
		await join.finish('joined');
		expect(screen.getByTestId('joining').textContent).toBe('false');
	});
});
