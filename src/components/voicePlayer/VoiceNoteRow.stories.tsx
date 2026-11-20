import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import MicIcon from '@mui/icons-material/Mic';
import { VoiceNoteRow } from './VoiceNoteRow';
import {
	createSilentWavUrl,
	useSilentAudio
} from './__storybook__/silentAudio';

const meta = {
	title: 'Components/Chat/VoiceNoteRow',
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'A voice note before it is sent. Recording and review are one row: Stop turns into Play in place, and the round button next to it cancels or discards.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const Recording: Story = {
	name: 'Aufnahme läuft',
	render: () => (
		<VoiceNoteRow
			mode="recording"
			durationSec={5}
			onStop={noop}
			onDiscard={noop}
		/>
	)
};

const Review = ({ seconds }: { seconds: number }) => (
	<VoiceNoteRow
		mode="review"
		src={useSilentAudio(seconds)}
		durationSec={seconds}
		onDiscard={noop}
	/>
);

export const ReviewShort: Story = {
	name: 'Prüfen — 7 Sekunden',
	render: () => <Review seconds={7} />
};

export const ReviewLong: Story = {
	name: 'Prüfen — 2:40 Minuten',
	render: () => <Review seconds={160} />
};

export const NarrowColumn: Story = {
	name: 'Enge Spalte — 280 px',
	render: () => (
		<div style={{ width: 280 }}>
			<Review seconds={160} />
		</div>
	)
};

/**
 * The whole flow to click through: record, stop, listen, discard. Nothing is
 * captured; the seconds tick by themselves and the take is silent audio.
 */
const ExperienceStage = () => {
	const [mode, setMode] = useState<'idle' | 'recording' | 'review'>('idle');
	const [seconds, setSeconds] = useState(0);
	const [src, setSrc] = useState<string | null>(null);

	useEffect(() => {
		if (mode !== 'recording') {
			return undefined;
		}
		const timer = window.setInterval(
			() => setSeconds((value) => value + 1),
			1000
		);
		return () => window.clearInterval(timer);
	}, [mode]);

	useEffect(
		() => () => {
			if (src) {
				URL.revokeObjectURL(src);
			}
		},
		[src]
	);

	const reset = () => {
		setMode('idle');
		setSeconds(0);
		setSrc(null);
	};

	if (mode === 'recording') {
		return (
			<VoiceNoteRow
				mode="recording"
				durationSec={seconds}
				onStop={() => {
					setSrc(createSilentWavUrl(Math.max(1, seconds)));
					setMode('review');
				}}
				onDiscard={reset}
			/>
		);
	}
	if (mode === 'review' && src) {
		return (
			<VoiceNoteRow
				mode="review"
				src={src}
				durationSec={Math.max(1, seconds)}
				onDiscard={reset}
			/>
		);
	}
	return (
		<button
			type="button"
			aria-label="Sprachaufnahme starten"
			onClick={() => setMode('recording')}
			style={{
				display: 'inline-flex',
				padding: 10,
				border: 'none',
				borderRadius: '50%',
				fontSize: 24,
				cursor: 'pointer',
				background: 'var(--m3-surface-container-high, #eae7e8)',
				color: 'var(--m3-primary, #a5000a)'
			}}
		>
			<MicIcon fontSize="inherit" />
		</button>
	);
};

export const Experience: Story = {
	name: 'Erlebnis — zum Durchklicken',
	render: () => <ExperienceStage />
};

export const ExperienceRecordThenDiscard: Story = {
	name: 'Erlebnis — Stopp wird zu Abspielen, X verwirft',
	render: () => <ExperienceStage />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Sprachaufnahme starten' })
		);
		const stop = await canvas.findByRole('button', {
			name: /^(Stopp|Stop)$/
		});
		const stopLeft = stop.getBoundingClientRect().left;
		await userEvent.click(stop);
		const play = await canvas.findByRole('button', {
			name: /Sprachnachricht abspielen|Play voice message/
		});
		// Nothing jumps: Play takes the exact spot Stop had.
		await expect(play.getBoundingClientRect().left).toBe(stopLeft);
		await userEvent.click(
			canvas.getByRole('button', {
				name: /Sprachnachricht verwerfen|Discard voice message/
			})
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Sprachaufnahme starten' })
			).toBeTruthy()
		);
	}
};
