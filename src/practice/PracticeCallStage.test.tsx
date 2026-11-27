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
	getPracticeCallLevel,
	getPracticeCallState,
	leavePracticeCall,
	openPracticeCallStage
} from './practiceCallStore';
import { PRACTICE_CALL_TARGETS } from './practiceCallTargets';
import {
	CHROME_LIKE_VOICES,
	FakeAudioContext,
	fakeVoice,
	installFakeMedia,
	installFakeSpeech,
	removeSpeech,
	type FakeMedia,
	type FakeUtterance
} from './practiceCallMedia.testkit';
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
	// jsdom has no speech synthesis: the murmur speaks unless a test adds it.
	removeSpeech();
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

	it('starts the audio inside the click, asks for camera and microphone once, and shows the own preview and Carimat', async () => {
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
			screen.getByTestId('practice-call-robot-tile').textContent
		).toContain('practice.callStage.robotName');
		// A second open (e.g. the header call button) keeps the one stage.
		act(() => openPracticeCallStage());
		await macrotask();
		expect(media.contexts).toHaveLength(1);
		expect(media.getUserMedia).toHaveBeenCalledTimes(1);
		expectNoRealCall();
	});

	it('without a speech voice Carimat murmurs: captions, the speaking state and a murmur scheduled on the audio', async () => {
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
			screen.getByTestId('practice-call-robot-tile').dataset.speaking
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

	it('minimises into the real dock with Carimat, and expands back to the stage', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();

		fireEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
		expect(stage()).toBeNull();
		const dock = anchor(PRACTICE_CALL_TARGETS.dock)!;
		expect(dock.classList.contains('minimized-call-dock')).toBe(true);
		expect(dock.textContent).toContain('practice.callStage.robotName');
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

	it('still pulses the ring when the browser keeps the audio suspended', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallLayer />);
		await openStage();
		const context = FakeAudioContext.instances.at(-1)!;
		context.state = 'suspended';
		await waitFor(
			() => expect(getPracticeCallState().speaking).toBe(true),
			{ timeout: 3000 }
		);
		expect(getPracticeCallState().voice).toBe('murmur');
		expect(getPracticeCallLevel()).toBeGreaterThan(0);
	});

	describe('with speech synthesis', () => {
		const until = (check: () => void) => waitFor(check, { timeout: 3000 });

		it('falls back to the murmur when the local voice never starts', async () => {
			const speech = installFakeSpeech({ stalls: true });
			enterPracticeMode({ tourId: TOUR });
			render(<PracticeCallLayer />);
			await openStage();

			await until(() => expect(speech.speak).toHaveBeenCalled());
			await waitFor(() => expect(stage()!.dataset.voice).toBe('murmur'), {
				timeout: 5000
			});
			expect(speech.cancel).toHaveBeenCalled();
			expect(
				screen.getByTestId('practice-call-caption').textContent
			).toContain('practice.callStage.line1');
		}, 10000);

		it('speaks the caption with a local voice of the page language, robotically', async () => {
			const speech = installFakeSpeech();
			enterPracticeMode({ tourId: TOUR });
			render(<PracticeCallLayer />);
			await openStage();

			await until(() => expect(speech.speak).toHaveBeenCalled());
			const utterance = speech.spoken[0] as FakeUtterance;
			expect(utterance.voice?.name).toBe('Anna');
			expect(utterance.voice?.localService).toBe(true);
			expect(utterance.text).toBe('practice.callStage.line1');
			expect([utterance.pitch, utterance.rate]).toEqual([0.6, 0.9]);
			expect(stage()!.dataset.voice).toBe('speech');
			expect(
				screen.getByTestId('practice-call-caption').textContent
			).toContain('practice.callStage.line1');
			// The ring follows the utterance's start.
			await until(() =>
				expect(
					screen.getByTestId('practice-call-robot-tile').dataset
						.speaking
				).toBe('true')
			);
			// The murmur stays silent while the voice speaks.
			expect(
				speech.spoken.every((u) => u.voice?.localService === true)
			).toBe(true);
		});

		it('never hands text to a network voice: only network voices means the murmur', async () => {
			const speech = installFakeSpeech({
				voices: [
					fakeVoice('Google Deutsch', 'de-DE', false, true),
					fakeVoice('Microsoft Katja Online', 'de-DE', false)
				]
			});
			enterPracticeMode({ tourId: TOUR });
			render(<PracticeCallLayer />);
			await openStage();

			await until(() =>
				expect(
					screen.getByTestId('practice-call-caption').textContent
				).toContain('practice.callStage.line1')
			);
			expect(stage()!.dataset.voice).toBe('murmur');
			expect(speech.speak).not.toHaveBeenCalled();
		});

		it('waits for a late voice list (voiceschanged)', async () => {
			const speech = installFakeSpeech({ late: true });
			enterPracticeMode({ tourId: TOUR });
			render(<PracticeCallLayer />);
			await openStage();
			act(() => speech.announceVoices(CHROME_LIKE_VOICES));

			await until(() => expect(speech.speak).toHaveBeenCalled());
			expect(
				(speech.spoken[0] as FakeUtterance).voice?.localService
			).toBe(true);
		});

		const speaking = async () => {
			const speech = installFakeSpeech({ speakMs: 10_000 });
			enterPracticeMode({ tourId: TOUR });
			const view = render(<PracticeCallLayer />);
			await openStage();
			await until(() => expect(speech.speak).toHaveBeenCalled());
			speech.cancel.mockClear();
			return { speech, view };
		};

		it.each([
			[
				'leave',
				() => fireEvent.click(anchor(PRACTICE_CALL_TARGETS.leave)!)
			],
			[
				'the dock hang-up',
				() => {
					fireEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
					fireEvent.click(
						anchor(
							PRACTICE_CALL_TARGETS.dock
						)!.querySelector<HTMLElement>(
							'[aria-label="calls.endCall"]'
						)!
					);
				}
			],
			['a restart', () => act(() => restartPracticeMode())],
			['the end of practice', () => act(() => exitPracticeMode())]
		])('%s cancels the speech', async (_name, exit) => {
			const { speech } = await speaking();
			exit();
			await until(() => expect(stage()).toBeNull());
			expect(speech.cancel).toHaveBeenCalled();
			expect(media.allAudioClosed()).toBe(true);
			// Nothing speaks again afterwards.
			const said = speech.speak.mock.calls.length;
			await act(
				() => new Promise<void>((resolve) => setTimeout(resolve, 2500))
			);
			expect(speech.speak.mock.calls.length).toBe(said);
		});

		it('unmounting the layer cancels the speech', async () => {
			const { speech, view } = await speaking();
			view.unmount();
			expect(speech.cancel).toHaveBeenCalled();
		});

		it('mute silences Carimat at once and keeps the captions silent', async () => {
			const { speech } = await speaking();
			fireEvent.click(anchor(PRACTICE_CALL_TARGETS.mute)!);
			expect(speech.cancel).toHaveBeenCalled();
			expect(
				screen
					.getByTestId('practice-call-robot-tile')
					.hasAttribute('data-speaking')
			).toBe(false);
			const said = speech.speak.mock.calls.length;
			// The next line comes as a caption only.
			await until(() =>
				expect(
					screen.getByTestId('practice-call-caption').textContent
				).toContain('practice.callStage.line2')
			);
			expect(speech.speak.mock.calls.length).toBe(said);
		});
	});
});
