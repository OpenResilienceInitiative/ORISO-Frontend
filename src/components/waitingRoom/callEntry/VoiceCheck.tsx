import * as React from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import {
	registrationMd3,
	registrationMotion
} from '../../registration/registrationDesign/registrationDesign';
import { DeviceToggle } from './DeviceToggle';
import { SpeakerTest, SpeakerTestState } from './SpeakerTest';
import { callEntryCopy as copy } from './callEntryCopy';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import type { Avatar } from '../../../utils/pseudonymGenerator';

export interface VoiceCheckProps {
	name: string;
	avatar: Avatar;
	micOn: boolean;
	micLevel: number;
	/** The meter has moved at least once since the page opened. */
	micHeard: boolean;
	onToggleMic: () => void;
	speakerTest: SpeakerTestState;
	onSpeakerTest: (next: SpeakerTestState) => void;
	playTone?: () => Promise<void>;
}

const RINGS = [0, 1, 2];

/**
 * The audio-only entry is its own design, not the video one with the picture
 * taken out (Frank, 2026-10-15: "nicht diese Designs, wo dann das Video
 * einfach ausgeblendet ist aus Faulheit").
 *
 * Without a picture, the voice is the person's presence, so the voice gets
 * the space: their animal avatar in the middle, rings that breathe with what the
 * microphone hears, and the two checks that matter on a phone call — "do
 * they hear me?" and "do I hear them?" — as two steps with their own result.
 */
export const VoiceCheck = ({
	name,
	avatar,
	micOn,
	micLevel,
	micHeard,
	onToggleMic,
	speakerTest,
	onSpeakerTest,
	playTone
}: VoiceCheckProps) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
	const level = micOn ? Math.min(1, Math.max(0, micLevel)) : 0;
	const micLine = !micOn
		? copy.micMuted
		: micHeard
			? copy.micHeard
			: copy.micWaiting;
	return (
		<Box
			data-testid="voice-check"
			sx={{
				borderRadius: '28px',
				bgcolor: registrationMd3.surfaceContainerLow,
				px: { xs: 2.5, sm: 4 },
				pt: { xs: 3, sm: 4 },
				pb: { xs: 2.5, sm: 3 }
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center'
				}}
			>
				<Box
					role="meter"
					aria-label={copy.micMeter}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(level * 100)}
					sx={{
						position: 'relative',
						width: { xs: 152, sm: 184 },
						height: { xs: 152, sm: 184 },
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center'
					}}
				>
					{RINGS.map((ring) => (
						<Box
							key={ring}
							aria-hidden
							sx={{
								'position': 'absolute',
								'inset': `${18 - ring * 9}%`,
								'borderRadius': '50%',
								'border': `2px solid ${registrationMd3.primary}`,
								'opacity': micOn
									? 0.12 + level * (0.6 - ring * 0.16)
									: 0,
								'transform': `scale(${1 + level * (0.04 + ring * 0.03)})`,
								'transition': `transform 90ms linear, opacity 90ms linear`,
								'@media (prefers-reduced-motion: reduce)': {
									transform: 'none',
									transition: `opacity ${registrationMotion.quick} linear`
								}
							}}
						/>
					))}
					{/* Muted reads as a faded animal, not only a colour change. */}
					<Box
						aria-hidden
						data-testid="voice-avatar"
						sx={{
							opacity: micOn ? 1 : 0.55,
							filter: micOn ? 'none' : 'grayscale(1)',
							transition: `opacity ${registrationMotion.standard} ${registrationMotion.easeOut}, filter ${registrationMotion.standard} ${registrationMotion.easeOut}`
						}}
					>
						<AnimalAvatar avatar={avatar} size={phone ? 84 : 104} />
					</Box>
				</Box>
				<Typography
					sx={{
						mt: 1,
						fontSize: 16,
						fontWeight: 600,
						color: registrationMd3.onSurface
					}}
				>
					{name || '…'}
				</Typography>
				<Box sx={{ mt: 2 }}>
					<DeviceToggle
						tone="onSurface"
						size={56}
						on={micOn}
						onToggle={onToggleMic}
						iconOn={<MicRoundedIcon />}
						iconOff={<MicOffRoundedIcon />}
						labelOn={copy.micOff}
						labelOff={copy.micOn}
						testId="toggle-mic"
					/>
				</Box>
			</Box>

			<Box
				component="ol"
				sx={{
					listStyle: 'none',
					p: 0,
					m: 0,
					mt: 3,
					display: 'grid',
					gap: 1
				}}
			>
				<VoiceStep
					icon={<GraphicEqRoundedIcon />}
					title={copy.devices.microphone}
					done={micOn && micHeard}
				>
					<Typography
						aria-live="polite"
						sx={{
							fontSize: 14,
							lineHeight: '20px',
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{micLine}
					</Typography>
				</VoiceStep>
				<VoiceStep
					icon={<VolumeUpRoundedIcon />}
					title={copy.devices.speaker}
					done={speakerTest === 'heard'}
				>
					<SpeakerTest
						state={speakerTest}
						onChange={onSpeakerTest}
						playTone={playTone}
					/>
				</VoiceStep>
			</Box>
		</Box>
	);
};

const VoiceStep = ({
	icon,
	title,
	done,
	children
}: {
	icon: React.ReactNode;
	title: string;
	done: boolean;
	children: React.ReactNode;
}) => (
	<Box
		component="li"
		data-done={done || undefined}
		sx={{
			display: 'grid',
			gridTemplateColumns: '40px minmax(0, 1fr)',
			columnGap: 1.5,
			alignItems: 'start',
			p: 1.5,
			borderRadius: '16px',
			bgcolor: registrationMd3.surfaceContainerLowest
		}}
	>
		<Box
			aria-hidden
			sx={{
				'width': 40,
				'height': 40,
				'borderRadius': '50%',
				'display': 'flex',
				'alignItems': 'center',
				'justifyContent': 'center',
				'bgcolor': done
					? registrationMd3.primary
					: registrationMd3.surfaceContainer,
				'color': done
					? registrationMd3.onPrimary
					: registrationMd3.onSurfaceVariant,
				'transition': `background-color ${registrationMotion.standard} ${registrationMotion.easeOut}`,
				'& svg': { fontSize: 22 }
			}}
		>
			{done ? <CheckCircleRoundedIcon /> : icon}
		</Box>
		<Box sx={{ minWidth: 0 }}>
			<Typography
				sx={{
					fontSize: 14,
					fontWeight: 600,
					lineHeight: '20px',
					color: registrationMd3.onSurface,
					mb: 0.5
				}}
			>
				{title}
			</Typography>
			{children}
		</Box>
	</Box>
);
