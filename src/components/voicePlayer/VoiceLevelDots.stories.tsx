import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';

import { VoiceLevelDots, VOICE_LEVEL_DOT_COUNT } from './VoiceLevelDots';
import { VoiceNoteRow } from './VoiceNoteRow';
import { pushLevel } from './useVoiceLevels';

const meta = {
	title: 'Components/Chat/VoiceLevelDots',
	component: VoiceLevelDots,
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'The level visual in the middle of the voice recorder. A row of small dots on a baseline is always visible while recording, so a quiet moment still reads as "recording" and never as "broken". With the voice the dots grow into red bars, newest on the right. Pass the live `stream`; the component owns the audio analysis and closes it again. `levels` replaces the microphone for stories and tests. Used by `VoiceRecordingBar` → `VoiceNoteRow` in the chat composer (also Supervision, team chat, threads) and the selection reply.'
			}
		}
	},
	args: { state: 'recording' }
} satisfies Meta<typeof VoiceLevelDots>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/** Every dot must stay visible: at least the 4 px resting dot. */
const expectRestingRow = async (canvasElement: HTMLElement) => {
	const row = within(canvasElement).getByTestId('voice-level-dots');
	const dots = Array.from(
		row.querySelectorAll<HTMLElement>('.voiceLevelDots__dot')
	);
	await expect(dots).toHaveLength(VOICE_LEVEL_DOT_COUNT);
	for (const dot of dots) {
		const box = dot.getBoundingClientRect();
		await expect(box.height).toBeGreaterThanOrEqual(4);
		await expect(box.width).toBeGreaterThanOrEqual(4);
		await expect(getComputedStyle(dot).visibility).toBe('visible');
		await expect(Number(getComputedStyle(dot).opacity)).toBeGreaterThan(0);
	}
	return { row, dots };
};

/** A real but silent microphone stand-in: the analyser reads pure silence. */
const useSilentStream = () => {
	const [stream, setStream] = useState<MediaStream | null>(null);
	useEffect(() => {
		if (typeof AudioContext === 'undefined') {
			return undefined;
		}
		const context = new AudioContext();
		const destination = context.createMediaStreamDestination();
		setStream(destination.stream);
		return () => {
			destination.stream.getTracks().forEach((track) => track.stop());
			context.close().catch(() => undefined);
		};
	}, []);
	return stream;
};

/** Synthetic speech: syllables rise and fall. Nothing is captured. */
const useSpeakingLevels = () => {
	const [levels, setLevels] = useState<number[]>(() =>
		Array.from(
			{ length: VOICE_LEVEL_DOT_COUNT },
			(_, index) => Math.abs(Math.sin(index / 1.7)) * 0.85
		)
	);
	useEffect(() => {
		let tick = 0;
		const timer = window.setInterval(() => {
			tick += 1;
			const syllable = Math.abs(Math.sin(tick / 2.3));
			setLevels((current) =>
				pushLevel(current, tick % 9 < 2 ? 0 : 0.2 + syllable * 0.75)
			);
		}, 90);
		return () => window.clearInterval(timer);
	}, []);
	return levels;
};

const SilentRecording = () => (
	<VoiceLevelDots state="recording" stream={useSilentStream()} />
);

const SpeakingRecording = () => (
	<VoiceLevelDots state="recording" levels={useSpeakingLevels()} />
);

export const Idle: Story = {
	name: 'Bereit (idle)',
	args: { state: 'idle' },
	play: async ({ canvasElement }) => {
		const { row } = await expectRestingRow(canvasElement);
		await expect(row.dataset.state).toBe('idle');
	}
};

export const RecordingSilent: Story = {
	name: 'Aufnahme — Stille',
	render: () => <SilentRecording />,
	play: async ({ canvasElement }) => {
		const { row, dots } = await expectRestingRow(canvasElement);
		await expect(row.dataset.state).toBe('recording');
		// Silence never empties the row: every dot stays a red dot.
		await new Promise((resolve) => window.setTimeout(resolve, 400));
		await expectRestingRow(canvasElement);
		const red = getComputedStyle(dots[0]).backgroundColor;
		await expect(red).not.toBe('rgba(0, 0, 0, 0)');
		for (const dot of dots) {
			await expect(dot.dataset.level).toBe('0.00');
		}
	}
};

export const RecordingSpeaking: Story = {
	name: 'Aufnahme — Sprechen',
	render: () => <SpeakingRecording />,
	play: async ({ canvasElement }) => {
		const { dots } = await expectRestingRow(canvasElement);
		await waitFor(() =>
			expect(
				Math.max(
					...dots.map((dot) => dot.getBoundingClientRect().height)
				)
			).toBeGreaterThan(12)
		);
	}
};

export const Paused: Story = {
	name: 'Pausiert',
	args: { state: 'paused', levels: [0.4, 0.9, 0.6] },
	play: async ({ canvasElement }) => {
		const { dots } = await expectRestingRow(canvasElement);
		for (const dot of dots) {
			await expect(dot.dataset.level).toBe('0.00');
		}
	}
};

export const Stopped: Story = {
	name: 'Beendet',
	args: { state: 'stopped' },
	play: async ({ canvasElement }) => {
		const { row } = await expectRestingRow(canvasElement);
		await expect(row.dataset.state).toBe('stopped');
	}
};

/** The dots in place: the composer's recording row, silent and speaking. */
const InRecorder = () => {
	const speaking = useSpeakingLevels();
	return (
		<div style={{ display: 'grid', gap: 16 }}>
			<VoiceNoteRow
				mode="recording"
				durationSec={4}
				levels={[]}
				onStop={noop}
				onDiscard={noop}
			/>
			<VoiceNoteRow
				mode="recording"
				durationSec={9}
				levels={speaking}
				onStop={noop}
				onDiscard={noop}
			/>
		</div>
	);
};

export const InTheRecorder: Story = {
	name: 'Im Recorder — still und sprechend',
	render: () => <InRecorder />,
	play: async ({ canvasElement }) => {
		const rows = within(canvasElement).getAllByTestId('voice-level-dots');
		await expect(rows).toHaveLength(2);
		const silentDots = rows[0].querySelectorAll<HTMLElement>(
			'.voiceLevelDots__dot'
		);
		await expect(silentDots).toHaveLength(VOICE_LEVEL_DOT_COUNT);
		await expect(
			silentDots[0].getBoundingClientRect().height
		).toBeGreaterThanOrEqual(4);
	}
};
