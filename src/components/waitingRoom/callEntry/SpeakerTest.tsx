import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { callEntryCopy as copy } from './callEntryCopy';

export type SpeakerTestState =
	| 'idle'
	| 'playing'
	| 'asking'
	| 'heard'
	| 'notHeard';

const TONE_MS = 1200;

/**
 * A short two-note chime through the default output. The app will route it
 * to the chosen speaker with `setSinkId`; Safari has no speaker choice at
 * all (#1383), which is why the question afterwards matters more than the
 * picker.
 */
export const playTestTone = (): Promise<void> =>
	new Promise((resolve) => {
		const Ctx =
			globalThis.AudioContext ??
			(
				globalThis as unknown as {
					webkitAudioContext?: typeof AudioContext;
				}
			).webkitAudioContext;
		if (!Ctx) {
			setTimeout(resolve, TONE_MS);
			return;
		}
		const ctx = new Ctx();
		const gain = ctx.createGain();
		gain.connect(ctx.destination);
		[659.25, 880].forEach((frequency, index) => {
			const start = ctx.currentTime + index * 0.5;
			const osc = ctx.createOscillator();
			osc.frequency.value = frequency;
			osc.connect(gain);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.2, start + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
			osc.start(start);
			osc.stop(start + 0.5);
		});
		setTimeout(() => {
			void ctx.close();
			resolve();
		}, TONE_MS);
	});

export interface SpeakerTestProps {
	state: SpeakerTestState;
	onChange: (next: SpeakerTestState) => void;
	/** One line under the video picture; a full card in the voice check. */
	compact?: boolean;
	playTone?: () => Promise<void>;
}

/**
 * Play a tone, then ask. The browser cannot know whether the person heard
 * it, so the person says so — Element Call has no speaker test (#1383).
 */
export const SpeakerTest = ({
	state,
	onChange,
	compact = false,
	playTone = playTestTone
}: SpeakerTestProps) => {
	const play = () => {
		onChange('playing');
		void playTone().then(() => onChange('asking'));
	};
	const textSx = {
		fontSize: 14,
		lineHeight: '20px',
		color: registrationMd3.onSurfaceVariant
	};

	let body: React.ReactNode;
	if (state === 'asking') {
		body = (
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					flexWrap: 'wrap'
				}}
			>
				<Typography
					sx={{
						...textSx,
						color: registrationMd3.onSurface,
						fontWeight: 600
					}}
				>
					{copy.speakerQuestion}
				</Typography>
				<Button
					size="small"
					variant="contained"
					onClick={() => onChange('heard')}
				>
					{copy.speakerYes}
				</Button>
				<Button
					size="small"
					variant="outlined"
					onClick={() => onChange('notHeard')}
				>
					{copy.speakerNo}
				</Button>
			</Box>
		);
	} else if (state === 'heard') {
		body = (
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				{/* In the voice check the step's own badge already says it. */}
				{compact && (
					<CheckCircleRoundedIcon
						sx={{ fontSize: 20, color: registrationMd3.primary }}
					/>
				)}
				<Typography
					sx={{ ...textSx, color: registrationMd3.onSurface }}
				>
					{copy.speakerHeard}
				</Typography>
			</Box>
		);
	} else {
		body = (
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-start',
					gap: 1.5,
					flexWrap: 'wrap'
				}}
			>
				<Button
					size="small"
					variant="outlined"
					startIcon={<PlayArrowRoundedIcon />}
					disabled={state === 'playing'}
					onClick={play}
					data-testid="speaker-test"
				>
					{state === 'playing'
						? copy.speakerPlaying
						: copy.speakerTest}
				</Button>
				{state === 'notHeard' && (
					<Box
						sx={{
							display: 'flex',
							gap: 1,
							flex: '1 1 220px',
							minWidth: 0
						}}
					>
						<VolumeOffRoundedIcon
							sx={{ fontSize: 20, color: registrationMd3.error }}
						/>
						<Typography sx={textSx}>
							{copy.speakerNotHeard}
						</Typography>
					</Box>
				)}
			</Box>
		);
	}

	return (
		<Box
			data-testid="speaker-test-row"
			data-state={state}
			aria-live="polite"
			sx={{ mt: compact ? 1.5 : 0 }}
		>
			{body}
		</Box>
	);
};
