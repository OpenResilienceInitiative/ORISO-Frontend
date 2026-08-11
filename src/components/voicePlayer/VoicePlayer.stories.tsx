import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { VoicePlayer } from './VoicePlayer';

/**
 * Storybook needs audio that really plays and really seeks, so each story
 * builds a silent 8 kHz WAV of the requested length in memory. Nothing is
 * fetched and nothing ships — this helper lives in the story file only.
 */
const createSilentWavUrl = (seconds: number): string => {
	const sampleRate = 8000;
	const sampleCount = Math.max(1, Math.round(seconds * sampleRate));
	const buffer = new ArrayBuffer(44 + sampleCount);
	const view = new DataView(buffer);
	const writeAscii = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) {
			view.setUint8(offset + i, text.charCodeAt(i));
		}
	};

	writeAscii(0, 'RIFF');
	view.setUint32(4, 36 + sampleCount, true);
	writeAscii(8, 'WAVE');
	writeAscii(12, 'fmt ');
	view.setUint32(16, 16, true); // PCM chunk size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate, true); // byte rate
	view.setUint16(32, 1, true); // block align
	view.setUint16(34, 8, true); // bits per sample
	writeAscii(36, 'data');
	view.setUint32(40, sampleCount, true);
	// 128 is silence for unsigned 8-bit PCM.
	new Uint8Array(buffer, 44).fill(128);

	return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const useSilentAudio = (seconds: number) => {
	const url = useMemo(() => createSilentWavUrl(seconds), [seconds]);
	useEffect(() => () => URL.revokeObjectURL(url), [url]);
	return url;
};

const Player = ({
	seconds,
	...rest
}: { seconds: number } & Omit<
	React.ComponentProps<typeof VoicePlayer>,
	'src' | 'durationSec'
>) => (
	<VoicePlayer
		src={useSilentAudio(seconds)}
		durationSec={seconds}
		{...rest}
	/>
);

const Stack = ({
	children,
	label
}: {
	children: React.ReactNode;
	label?: string;
}) => (
	<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
		{label && (
			<span
				style={{
					font: '500 11.5px/16px var(--font-family-sans-serif)',
					letterSpacing: '0.3px',
					color: 'var(--m3-on-surface-variant, #444748)'
				}}
			>
				{label}
			</span>
		)}
		{children}
	</div>
);

const Avatar = () => (
	<span
		aria-hidden="true"
		style={{
			flex: 'none',
			width: '40px',
			height: '40px',
			borderRadius: '50%',
			background: 'var(--m3-surface-container-highest, #e4e2e2)'
		}}
	/>
);

const meta = {
	title: 'Components/Chat/VoicePlayer',
	component: VoicePlayer,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded'
	},
	argTypes: {
		variant: { control: 'inline-radio', options: ['tiles', 'ring'] },
		bubble: {
			control: 'inline-radio',
			options: ['incoming', 'outgoing', 'none']
		},
		size: { control: 'inline-radio', options: ['md', 'sm'] }
	}
} satisfies Meta<typeof VoicePlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const PlaygroundStory = (args: React.ComponentProps<typeof VoicePlayer>) => (
	<div style={{ maxWidth: '420px' }}>
		<VoicePlayer {...args} src={useSilentAudio(args.durationSec ?? 12)} />
	</div>
);

/** Playground — every prop on the controls panel. */
export const Playground: Story = {
	name: 'Playground',
	args: {
		variant: 'tiles',
		bubble: 'incoming',
		size: 'md',
		showMeta: true,
		durationSec: 12,
		sender: 'sanftes Alpaka Kim',
		sentAt: '14:32'
	},
	render: (args) => <PlaygroundStory {...args} />
};

/** 6b — the raw player, both variants, no surroundings. */
export const Variants: Story = {
	name: 'Beide Varianten',
	args: { durationSec: 12 },
	render: () => (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '20px',
				maxWidth: '400px'
			}}
		>
			<Stack label={'variant="tiles" · bubble="none"'}>
				<div style={{ width: '330px', display: 'flex' }}>
					<Player seconds={12} variant="tiles" bubble="none" />
				</div>
			</Stack>
			<Stack label={'variant="ring" · bubble="none" · hover für Details'}>
				<div style={{ width: '220px' }}>
					<Player
						seconds={12}
						variant="ring"
						bubble="none"
						sender="sanftes Alpaka Kim"
						sentAt="14:32"
					/>
				</div>
			</Stack>
			<Stack
				label={'size="sm" — höchstens 10 Abschnitte, für enge Spalten'}
			>
				<div style={{ width: '240px', display: 'flex' }}>
					<Player
						seconds={12}
						variant="tiles"
						bubble="none"
						size="sm"
						showMeta={false}
					/>
				</div>
			</Stack>
		</div>
	)
};

/** 6c — incoming, own, long, unheard. */
export const InConversation: Story = {
	name: 'Im Verlauf',
	args: { durationSec: 12 },
	render: () => (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '20px',
				maxWidth: '680px'
			}}
		>
			<div
				style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'flex-start'
				}}
			>
				<Avatar />
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '5px',
						width: '420px',
						minWidth: 0
					}}
				>
					<Player
						seconds={12}
						variant="tiles"
						bubble="incoming"
						initialProgress={0.33}
					/>
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-end',
					gap: '5px'
				}}
			>
				<div style={{ width: '330px', display: 'flex' }}>
					<Player seconds={9} variant="tiles" bubble="outgoing" />
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'flex-start'
				}}
			>
				<Avatar />
				<div style={{ width: '420px', minWidth: 0, display: 'flex' }}>
					{/* Above 16 s the tiles become sections and the meta line
					    names the seconds per tile. */}
					<Player seconds={165} variant="tiles" bubble="incoming" />
				</div>
			</div>

			<div
				style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'flex-start'
				}}
			>
				<Avatar />
				<div style={{ width: '420px', minWidth: 0, display: 'flex' }}>
					<Player
						seconds={14}
						variant="tiles"
						bubble="incoming"
						note="noch nicht angehört"
					/>
				</div>
			</div>
		</div>
	)
};

/** 6d — as a row: conversation list, timeline, reply quote. */
export const AsRow: Story = {
	name: 'Als Zeile',
	args: { durationSec: 12 },
	render: () => (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '12px',
				maxWidth: '420px'
			}}
		>
			<div
				style={{
					background: 'var(--m3-surface-container-lowest, #ffffff)',
					border: '1px solid rgba(0, 0, 0, 0.08)',
					borderRadius: '20px',
					padding: '13px 15px',
					display: 'flex',
					alignItems: 'center',
					gap: '12px'
				}}
			>
				<Avatar />
				<div style={{ flex: 1, minWidth: 0 }}>
					<div
						style={{
							font: '500 14px/20px var(--font-family-sans-serif)',
							color: 'var(--m3-on-surface, #1a1c1e)'
						}}
					>
						sanftes Alpaka Kim
					</div>
					<div style={{ width: '180px' }}>
						<Player
							seconds={12}
							variant="ring"
							bubble="none"
							size="sm"
							sender="sanftes Alpaka Kim"
							sentAt="14:32"
						/>
					</div>
				</div>
			</div>

			<div
				style={{
					borderLeft: '3px solid var(--m3-primary, #a5000a)',
					padding: '2px 0 2px 12px',
					display: 'flex',
					flexDirection: 'column',
					gap: '4px'
				}}
			>
				<span
					style={{
						font: '500 11.5px/16px var(--font-family-sans-serif)',
						color: 'var(--m3-primary, #a5000a)'
					}}
				>
					Antwort auf sanftes Alpaka Kim
				</span>
				<div style={{ width: '34px' }}>
					<Player
						seconds={12}
						variant="ring"
						bubble="none"
						size="sm"
						showMeta={false}
						note="Zitat · 0:12"
					/>
				</div>
			</div>
		</div>
	)
};

/** 6e — 328 px phone content width and the 200 px case-file side column. */
export const NarrowColumns: Story = {
	name: 'Enge Spalten',
	args: { durationSec: 12 },
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<Stack label="328px Inhaltsbreite — Kacheln, 10 Abschnitte">
				<div
					style={{
						width: '328px',
						display: 'flex',
						gap: '8px',
						alignItems: 'flex-start'
					}}
				>
					<Avatar />
					<div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
						<Player
							seconds={12}
							variant="tiles"
							bubble="incoming"
							size="sm"
							showMeta={false}
						/>
					</div>
				</div>
			</Stack>
			<Stack label="200px Randspalte — Ring">
				<div style={{ width: '190px' }}>
					<Player
						seconds={12}
						variant="ring"
						bubble="incoming"
						sender="sanftes Alpaka Kim"
						sentAt="14:32"
					/>
				</div>
			</Stack>
		</div>
	)
};

const ResponsiveStory = () => {
	const [width, setWidth] = useState(420);
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<label
				style={{
					font: '400 12px/17px var(--font-family-sans-serif)',
					display: 'flex',
					alignItems: 'center',
					gap: '10px'
				}}
			>
				Breite: {width}px
				<input
					type="range"
					min={140}
					max={420}
					value={width}
					onChange={(event) => setWidth(Number(event.target.value))}
				/>
			</label>
			<Stack label='size="md" — gedacht für rund 300px, läuft unter etwa 170px über'>
				<div style={{ width: `${width}px`, display: 'flex' }}>
					<Player seconds={12} variant="tiles" bubble="incoming" />
				</div>
			</Stack>
			<Stack label='size="sm" — höchstens 10 Abschnitte, hält bis etwa 150px'>
				<div style={{ width: `${width}px`, display: 'flex' }}>
					<Player
						seconds={12}
						variant="tiles"
						bubble="incoming"
						size="sm"
						showMeta={false}
					/>
				</div>
			</Stack>
			<Stack label='variant="ring" — überlebt jede Spaltenbreite'>
				<div style={{ width: `${width}px`, display: 'flex' }}>
					<Player seconds={12} variant="ring" bubble="incoming" />
				</div>
			</Stack>
		</div>
	);
};

/**
 * Where the rule from 6a bites. The tiles shrink with the column — down to a
 * 4 px floor per tile, below which the row can no longer give way. For a
 * 12-second recording that floor lands around 170 px for `md` and 150 px for
 * `sm`; a longer recording (16 tiles instead of 12) gives out roughly 30 px
 * earlier. That is exactly why the rule sends narrow columns to `sm` and very
 * narrow ones to `ring`, which never runs out of room. Drag the slider to see
 * all three at the same width.
 */
export const Responsive: Story = {
	name: 'Mitschrumpfen',
	args: { durationSec: 12 },
	render: () => <ResponsiveStory />
};
