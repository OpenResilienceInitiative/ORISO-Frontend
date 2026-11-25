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
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import { callManager } from '../services/CallManager';
import {
	enterPracticeMode,
	exitPracticeMode,
	restartPracticeMode
} from './practiceMode';
import { PracticeCallLayer } from './PracticeCallStage';
import {
	getPracticeCallState,
	leavePracticeCall,
	openPracticeCallStage
} from './practiceCallStore';
import { PRACTICE_CALL_TARGETS } from './practiceCallTargets';
import { installFakeMedia, type FakeMedia } from './practiceCallMedia.testkit';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));

const TOUR = 'consultant-group-circle';
const anchor = (name: string) =>
	document.querySelector<HTMLElement>(`[data-tour-target="${name}"]`);
const stage = () => anchor(PRACTICE_CALL_TARGETS.stage);
const macrotask = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** Opens the stage the way the start button does: inside the click. */
const openStage = async () => {
	act(() => openPracticeCallStage());
	await macrotask();
	await waitFor(() => expect(stage()).not.toBeNull());
};

let media: FakeMedia;
let opened = 0;
let stopListening = () => undefined as void;
const startCall = vi.spyOn(callManager, 'startCall');

beforeEach(() => {
	media = installFakeMedia();
	startCall.mockClear();
	opened = 0;
	stopListening = subscribeToTourEvent(
		PRACTICE_TOUR_EVENTS.circleCallStarted,
		() => {
			opened += 1;
		}
	);
});

afterEach(() => {
	stopListening();
	cleanup();
	exitPracticeMode();
	leavePracticeCall();
});

/** The call path stays untouched: no call manager, no Element Call. */
const expectNoRealCall = () => {
	expect(startCall).not.toHaveBeenCalled();
	expect(callManager.hasActiveCall()).toBe(false);
	expect(document.querySelector('.element-call-iframe')).toBeNull();
};

describe('the practice call stage (FE#2545 D3, revised)', () => {
	it('does nothing outside practice: no stage, no audio, no camera', async () => {
		render(<PracticeCallLayer />);
		act(() => openPracticeCallStage());
		await macrotask();
		expect(stage()).toBeNull();
		expect(media.contexts).toHaveLength(0);
		expect(media.getUserMedia).not.toHaveBeenCalled();
		expect(opened).toBe(0);
	});

	it('starts the audio inside the click, asks for camera and microphone once, and shows the own preview and Mia', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);

		act(() => openPracticeCallStage());
		// The AudioContext exists before anything else ran: the gesture.
		expect(media.contexts).toHaveLength(1);
		await macrotask();

		expect(stage()).not.toBeNull();
		expect(opened).toBe(1);
		await waitFor(() =>
			expect(screen.getByTestId('practice-call-own-video')).toBeTruthy()
		);
		expect(media.getUserMedia).toHaveBeenCalledTimes(1);
		expect(media.getUserMedia).toHaveBeenCalledWith({
			audio: true,
			video: true
		});
		expect(screen.getByText('practice.callStage.notice')).toBeTruthy();
		expect(
			screen.getByTestId('practice-call-mia-tile').textContent
		).toContain('practice.callStage.miaName');
		// A second open (e.g. the header call button) keeps the one stage.
		act(() => openPracticeCallStage());
		await macrotask();
		expect(media.contexts).toHaveLength(1);
		expect(media.getUserMedia).toHaveBeenCalledTimes(1);
		expectNoRealCall();
	});

	it('lets Mia speak: captions, the speaking state and a murmur scheduled on the audio', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();

		await waitFor(
			() =>
				expect(
					screen.getByTestId('practice-call-caption').textContent
				).toContain('practice.callStage.line1'),
			{ timeout: 3000 }
		);
		expect(
			screen.getByTestId('practice-call-mia-tile').dataset.speaking
		).toBe('true');
		// The murmur's oscillator and noise were started on the context.
		const [context] = media.contexts;
		expect(context.sources.length).toBeGreaterThanOrEqual(2);
		context.sources.forEach((s) =>
			expect((s as any).start).toHaveBeenCalled()
		);
	});

	it('mutes the microphone and turns the camera off on the real tracks', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() => expect(media.tracks).toHaveLength(2));
		const [mic, camera] = media.tracks;

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.mute)!);
		expect(mic.enabled).toBe(false);
		expect(
			anchor(PRACTICE_CALL_TARGETS.mute)!.getAttribute('aria-pressed')
		).toBe('true');

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.camera)!);
		expect(camera.enabled).toBe(false);
		// The initials stand in for the picture.
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
		expect(
			screen
				.getByTestId('practice-call-own-tile')
				.querySelector('[data-testid="user-avatar"]')
		).not.toBeNull();
	});

	it('minimises into the real dock with Mia, and expands back to the stage', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
		expect(stage()).toBeNull();
		const dock = anchor(PRACTICE_CALL_TARGETS.dock)!;
		expect(dock.classList.contains('minimized-call-dock')).toBe(true);
		expect(dock.textContent).toContain('practice.callStage.miaName');
		// The dock's mute is the same practice state.
		fireEvent.click(
			dock.querySelector<HTMLElement>('[aria-label="calls.mute"]')!
		);
		expect(getPracticeCallState().muted).toBe(true);

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.expand)!);
		expect(stage()).not.toBeNull();
		expect(anchor(PRACTICE_CALL_TARGETS.dock)).toBeNull();
		expectNoRealCall();
	});

	it('leave stops every track and closes the audio', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() => expect(media.tracks).toHaveLength(2));

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.leave)!);

		expect(stage()).toBeNull();
		expect(media.allTracksEnded()).toBe(true);
		expect(media.allAudioClosed()).toBe(true);
		expect(media.contexts[0].sources.length).toBeGreaterThan(0);
		media.contexts[0].sources.forEach((s) =>
			expect(s.stop).toHaveBeenCalled()
		);
		expectNoRealCall();
	});

	it('hanging up in the dock leaves the same way', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() => expect(media.tracks).toHaveLength(2));
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);

		fireEvent.click(
			anchor(PRACTICE_CALL_TARGETS.dock)!.querySelector<HTMLElement>(
				'[aria-label="calls.endCall"]'
			)!
		);

		expect(anchor(PRACTICE_CALL_TARGETS.dock)).toBeNull();
		expect(media.allTracksEnded()).toBe(true);
		expect(media.allAudioClosed()).toBe(true);
	});

	it.each([
		['the end of practice', () => exitPracticeMode()],
		['a restart', () => restartPracticeMode()]
	])('%s stops every track and closes the audio', async (_name, end) => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() => expect(media.tracks).toHaveLength(2));

		act(() => end());

		await waitFor(() => expect(stage()).toBeNull());
		expect(media.allTracksEnded()).toBe(true);
		expect(media.allAudioClosed()).toBe(true);
	});

	it('unmounting the layer (the sandbox goes) stops every track too', async () => {
		enterPracticeMode({ tourId: TOUR });
		const view = render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() => expect(media.tracks).toHaveLength(2));

		view.unmount();

		expect(media.allTracksEnded()).toBe(true);
		expect(media.allAudioClosed()).toBe(true);
	});

	it('stops a camera that answers after the stage was left', async () => {
		let answer: (stream: unknown) => void = () => undefined;
		media.getUserMedia.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					answer = resolve;
				})
		);
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		act(() => leavePracticeCall());

		const late = { readyState: 'live', stop: vi.fn() };
		await act(async () =>
			answer({
				getTracks: () => [late],
				getAudioTracks: () => [],
				getVideoTracks: () => []
			})
		);

		expect(late.stop).toHaveBeenCalled();
		expect(getPracticeCallState().status).toBe('closed');
	});

	it('without permission it shows the initials and a notice, and goes on', async () => {
		media = installFakeMedia({ granted: false });
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();

		await waitFor(() =>
			expect(screen.getByTestId('practice-call-no-media')).toBeTruthy()
		);
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
		// Every control still works.
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.mute)!);
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.camera)!);
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.expand)!);
		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.leave)!);
		expect(stage()).toBeNull();
		expect(media.tracks).toHaveLength(0);
		expect(media.allAudioClosed()).toBe(true);
	});

	it('without WebAudio or media devices the stage still opens', async () => {
		Object.defineProperty(window, 'AudioContext', {
			configurable: true,
			writable: true,
			value: undefined
		});
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: undefined
		});
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		await waitFor(() =>
			expect(screen.getByTestId('practice-call-no-media')).toBeTruthy()
		);
		await waitFor(
			() =>
				expect(
					screen.getByTestId('practice-call-caption').textContent
				).toContain('practice.callStage.line1'),
			{ timeout: 3000 }
		);
	});
});
