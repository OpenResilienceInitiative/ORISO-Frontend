import * as React from 'react';
import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { PracticeCallLayer } from '../../practice/PracticeCallStage';
import {
	getPracticeCallState,
	openPracticeCallStage
} from '../../practice/practiceCallStore';
import { PRACTICE_CALL_TARGETS } from '../../practice/practiceCallTargets';
import { pickLocalVoice } from '../../practice/practiceCallVoice';
import { PRACTICE_GROUP_CIRCLE_TOUR_ID } from '../../practice/practiceTourIds';
import { InPracticeMode } from './practiceStoryHelpers';

/*
 * The practice call of the Gesprächskreis tour (FE#2545 D3, revised), live:
 * the real store, the real layer, the browser's own speech synthesis (local
 * voices only) and WebAudio. Two things are stood in for, so a story never
 * prompts and never needs a device: the camera is a canvas stream, or a
 * refusal; the murmur story hides the voice list.
 */

type Camera = 'granted' | 'denied';

/** A moving gradient as the "camera": no device, no prompt. */
const canvasStream = (): MediaStream => {
	const canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 180;
	const context = canvas.getContext('2d')!;
	const draw = () => {
		const t = Date.now() / 1000;
		const gradient = context.createLinearGradient(0, 0, 320, 180);
		gradient.addColorStop(0, `hsl(${(t * 20) % 360} 40% 45%)`);
		gradient.addColorStop(1, `hsl(${(t * 20 + 120) % 360} 40% 30%)`);
		context.fillStyle = gradient;
		context.fillRect(0, 0, 320, 180);
	};
	draw();
	const timer = window.setInterval(draw, 66);
	const stream = canvas.captureStream(15);
	// A real stop() ends the canvas track; the timer goes with it.
	const stop = MediaStreamTrack.prototype.stop;
	stream.getTracks().forEach((track) => {
		track.stop = function () {
			window.clearInterval(timer);
			stop.call(this);
		};
	});
	// getAudioTracks() is empty: the canvas has no microphone.
	return stream;
};

/**
 * Stands in for the camera (and, for the murmur, hides the voice list)
 * while the story is mounted, and puts the real ones back afterwards.
 */
const useStandIns = (camera: Camera, hideVoices: boolean) => {
	useLayoutEffect(() => {
		const devices = navigator.mediaDevices;
		const realGetUserMedia = devices?.getUserMedia;
		if (devices) {
			devices.getUserMedia = async () => {
				if (camera === 'denied') {
					throw new DOMException(
						'Permission denied',
						'NotAllowedError'
					);
				}
				return canvasStream();
			};
		}
		const synth = window.speechSynthesis;
		if (hideVoices && synth) {
			Object.defineProperty(synth, 'getVoices', {
				configurable: true,
				value: () => []
			});
		}
		return () => {
			if (devices && realGetUserMedia) {
				devices.getUserMedia = realGetUserMedia;
			}
			if (hideVoices && synth) {
				delete (synth as unknown as { getVoices?: unknown }).getVoices;
			}
		};
	}, [camera, hideVoices]);
};

interface LiveCallProps {
	camera: Camera;
	/** Hide the voice list: Carimat murmurs (no local voice for the language). */
	murmur: boolean;
}

const LiveCall = ({ camera, murmur }: LiveCallProps) => {
	useStandIns(camera, murmur);
	return (
		<InPracticeMode tourId={PRACTICE_GROUP_CIRCLE_TOUR_ID}>
			<main style={{ minHeight: '100vh', padding: 24 }}>
				{/* The click is the gesture the AudioContext needs. */}
				<button type="button" onClick={openPracticeCallStage}>
					Video-Call starten (Übung)
				</button>
				<PracticeCallLayer />
			</main>
		</InPracticeMode>
	);
};

const meta = {
	title: 'Organisms/PracticeCallStage',
	component: LiveCall,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					"The practice video call of the Gesprächskreis tour (FE#2545 D3, revised), live, in the look of the Element Call group stage (Call/Views → GroupStage). The own tile shows the local camera preview (a canvas here), or the initials when permission is refused. Carimat, the robot that signs the chat's system messages, greets with the browser's speech synthesis, only with a voice of the page language that runs on this device (`localService`); network voices such as Chrome's \"Google …\" are never used. Without a local voice it murmurs (WebAudio). Captions show what it says; the ring follows the speech. Mute silences it; leaving, restart and the end of practice cancel the speech, stop every track and close the audio. Minimised, the real `DockedCall` stands in. Press the button to start."
			}
		}
	},
	args: { camera: 'granted', murmur: false }
} satisfies Meta<typeof LiveCall>;
export default meta;

type Story = StoryObj<typeof meta>;

const anchor = (name: string) =>
	document.querySelector<HTMLElement>(`[data-tour-target="${name}"]`);
const robotTile = () => screen.getByTestId('practice-call-robot-tile');

/** Whether a loaded stylesheet styles `selector` on hover. */
const hasHoverRule = (selector: string) =>
	Array.from(document.styleSheets).some((sheet) => {
		try {
			return Array.from(sheet.cssRules).some(
				(rule) =>
					rule instanceof CSSStyleRule &&
					rule.selectorText.includes(`${selector}:hover`)
			);
		} catch {
			return false;
		}
	});
const SLOW = { timeout: 8000 };

/** Starts the call with a real click and waits for Carimat's first line. */
const startCall = async () => {
	await userEvent.click(
		screen.getByRole('button', { name: 'Video-Call starten (Übung)' })
	);
	await waitFor(
		() => expect(anchor(PRACTICE_CALL_TARGETS.stage)).not.toBeNull(),
		SLOW
	);
	await waitFor(
		() =>
			expect(
				screen.getByTestId('practice-call-caption').textContent
			).not.toBe(''),
		SLOW
	);
};

/** Which voices this browser offers, and which one the call would take. */
const reportVoices = () => {
	const synth = window.speechSynthesis;
	const voices = synth?.getVoices() ?? [];
	console.info(
		'practice-call-voices',
		JSON.stringify({
			userAgent: navigator.userAgent,
			voices: voices.map((v) => [v.name, v.lang, v.localService]),
			de: pickLocalVoice(voices, 'de')?.name ?? null,
			en: pickLocalVoice(voices, 'en')?.name ?? null
		})
	);
};

/** Carimat speaks: caption, ring, and a local voice or the murmur. */
export const Speaking: Story = {
	play: async () => {
		await startCall();
		// After the start: Chrome fills the list late.
		reportVoices();
		await waitFor(
			() => expect(robotTile().dataset.speaking).toBe('true'),
			SLOW
		);
		await waitFor(
			() =>
				expect(
					Number(
						robotTile().style.getPropertyValue(
							'--practice-call-level'
						)
					)
				).toBeGreaterThan(0),
			SLOW
		);
		// A local voice, or the murmur (no local voice, or one that never
		// starts, as in a headless browser).
		const voice = anchor(PRACTICE_CALL_TARGETS.stage)!.dataset.voice;
		expect(['speech', 'murmur']).toContain(voice);
		console.info('practice-call-voice-mode', voice);
	}
};

/** Muted: the control is pressed and Carimat falls silent. */
export const Muted: Story = {
	play: async () => {
		await startCall();
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.mute)!);
		expect(
			anchor(PRACTICE_CALL_TARGETS.mute)!.getAttribute('aria-pressed')
		).toBe('true');
		expect(getPracticeCallState().muted).toBe(true);
		await waitFor(() =>
			expect(window.speechSynthesis?.speaking ?? false).toBe(false)
		);
		expect(robotTile().hasAttribute('data-speaking')).toBe(false);

		// The stage's controls are the shared call atoms, with their hover
		// and focus ring, not a practice-only copy (PR #2556 review).
		const mute = anchor(PRACTICE_CALL_TARGETS.mute)!;
		const camera = anchor(PRACTICE_CALL_TARGETS.camera)!;
		for (const control of [
			mute,
			camera,
			anchor(PRACTICE_CALL_TARGETS.minimise)!
		]) {
			expect(control.classList).toContain('call-icon-button');
			expect(control.classList).toContain('call-icon-button--stage');
		}
		expect(mute.classList).toContain('call-icon-button--off');
		expect(anchor(PRACTICE_CALL_TARGETS.leave)!.classList).toContain(
			'call-fab'
		);
		expect(hasHoverRule('.call-icon-button--stage')).toBe(true);
		expect(hasHoverRule('.call-icon-button--off')).toBe(true);
		expect(hasHoverRule('.call-fab')).toBe(true);
		await userEvent.tab();
		expect(document.activeElement).toBe(camera);
		expect(camera.matches(':focus-visible')).toBe(true);
		expect(getComputedStyle(camera).outlineStyle).toBe('solid');
		expect(getComputedStyle(camera).outlineWidth).toBe('3px');
	}
};

/** Camera off: the initials replace the preview. */
export const CameraOff: Story = {
	play: async () => {
		await startCall();
		await waitFor(
			() =>
				expect(
					screen.getByTestId('practice-call-own-video')
				).toBeTruthy(),
			SLOW
		);
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.camera)!);
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
		expect(
			screen
				.getByTestId('practice-call-own-tile')
				.querySelector('[data-testid="user-avatar"]')
		).not.toBeNull();
	}
};

/** Minimised: the app's real dock, with Carimat, and its way back. */
export const Minimised: Story = {
	play: async () => {
		await startCall();
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.minimise)!);
		const dock = await waitFor(() => {
			const element = anchor(PRACTICE_CALL_TARGETS.dock);
			expect(element).not.toBeNull();
			return element!;
		});
		expect(dock.classList.contains('minimized-call-dock')).toBe(true);
		expect(anchor(PRACTICE_CALL_TARGETS.stage)).toBeNull();
		expect(anchor(PRACTICE_CALL_TARGETS.expand)).not.toBeNull();
	}
};

/** Refused: initials, a system notice, Carimat still speaks. */
export const PermissionDenied: Story = {
	args: { camera: 'denied' },
	play: async () => {
		await startCall();
		await waitFor(
			() =>
				expect(
					screen.getByTestId('practice-call-no-media')
				).toBeTruthy(),
			SLOW
		);
		expect(screen.queryByTestId('practice-call-own-video')).toBeNull();
	}
};

/** No local voice for the language: the generated murmur, its analyser drives the ring. */
export const MurmurFallback: Story = {
	args: { murmur: true },
	play: async () => {
		await startCall();
		expect(anchor(PRACTICE_CALL_TARGETS.stage)!.dataset.voice).toBe(
			'murmur'
		);
		await waitFor(
			() => expect(robotTile().dataset.speaking).toBe('true'),
			SLOW
		);
		await waitFor(
			() =>
				expect(
					Number(
						robotTile().style.getPropertyValue(
							'--practice-call-level'
						)
					)
				).toBeGreaterThan(0),
			SLOW
		);
		// Leaving cancels everything: no speech, the stage gone.
		await userEvent.click(anchor(PRACTICE_CALL_TARGETS.leave)!);
		expect(anchor(PRACTICE_CALL_TARGETS.stage)).toBeNull();
		await waitFor(() =>
			expect(window.speechSynthesis?.speaking ?? false).toBe(false)
		);
	}
};
