import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { MicLevelMeter } from './MicLevelMeter';
import { DeviceToggle } from './DeviceToggle';
import { callEntryCopy as copy } from './callEntryCopy';
import { initialsOf } from './initialsOf';

export interface VideoCheckProps {
	name: string;
	/** The live camera; without one the tile shows a neutral stand-in. */
	stream?: MediaStream | null;
	cameraOn: boolean;
	micOn: boolean;
	micLevel: number;
	onToggleCamera: () => void;
	onToggleMic: () => void;
}

/**
 * The picture of the video call entry: a mirrored preview, the person's own
 * level meter and name on it, mic and camera switches at its foot (Teams'
 * pre-join as reference; Frank, 2026-10-15). Device pills and the speaker
 * test stand beside it in `CallEntryRoom`.
 */
export const VideoCheck = ({
	name,
	stream,
	cameraOn,
	micOn,
	micLevel,
	onToggleCamera,
	onToggleMic
}: VideoCheckProps) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		if (videoRef.current) videoRef.current.srcObject = stream ?? null;
	}, [stream, cameraOn]);

	return (
		<Box data-testid="video-check">
			<Box
				sx={{
					position: 'relative',
					aspectRatio: '16 / 9',
					borderRadius: '20px',
					overflow: 'hidden',
					bgcolor: '#1f1f22',
					/* Stand-in light when there is no stream: reads as "a
					   camera picture goes here" without faking a person. */
					backgroundImage:
						'radial-gradient(120% 90% at 30% 20%, #4a4a52 0%, #26262b 55%, #1a1a1d 100%)'
				}}
			>
				{cameraOn && stream && (
					<Box
						component="video"
						ref={videoRef}
						autoPlay
						muted
						playsInline
						sx={{
							position: 'absolute',
							inset: 0,
							width: '100%',
							height: '100%',
							objectFit: 'cover',
							transform: 'scaleX(-1)'
						}}
					/>
				)}
				{cameraOn && !stream && (
					<PersonRoundedIcon
						aria-hidden
						sx={{
							position: 'absolute',
							left: '50%',
							bottom: 0,
							transform: 'translateX(-50%)',
							fontSize: { xs: 150, sm: 220 },
							color: 'rgba(255,255,255,.14)'
						}}
					/>
				)}
				{!cameraOn && (
					<Box
						sx={{
							position: 'absolute',
							inset: 0,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 1.5,
							color: '#fff'
						}}
					>
						<Box
							aria-hidden
							sx={{
								width: { xs: 72, sm: 96 },
								height: { xs: 72, sm: 96 },
								borderRadius: '50%',
								bgcolor: registrationMd3.primary,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: { xs: 26, sm: 34 },
								fontWeight: 600
							}}
						>
							{initialsOf(name)}
						</Box>
						<Typography sx={{ fontSize: 14, opacity: 0.85 }}>
							{copy.cameraOff}
						</Typography>
					</Box>
				)}
				{/* Name and level ride on the picture, where the eye already is. */}
				<Box
					sx={{
						position: 'absolute',
						left: 12,
						top: 12,
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						px: 1.25,
						py: 0.5,
						borderRadius: '12px',
						bgcolor: 'rgba(0,0,0,.45)',
						color: '#fff'
					}}
				>
					{micOn ? (
						<MicLevelMeter
							level={micLevel}
							onDark
							label={copy.micMeter}
						/>
					) : (
						<MicOffRoundedIcon sx={{ fontSize: 18 }} />
					)}
					<Typography
						sx={{
							fontSize: 13,
							fontWeight: 600,
							maxWidth: 160,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						}}
					>
						{name || '…'}
					</Typography>
				</Box>
				<Box
					sx={{
						position: 'absolute',
						left: 0,
						right: 0,
						bottom: 12,
						display: 'flex',
						justifyContent: 'center',
						gap: 1.5
					}}
				>
					<DeviceToggle
						tone="onDark"
						on={micOn}
						onToggle={onToggleMic}
						iconOn={<MicRoundedIcon />}
						iconOff={<MicOffRoundedIcon />}
						labelOn={copy.micOff}
						labelOff={copy.micOn}
						testId="toggle-mic"
					/>
					<DeviceToggle
						tone="onDark"
						on={cameraOn}
						onToggle={onToggleCamera}
						iconOn={<VideocamRoundedIcon />}
						iconOff={<VideocamOffRoundedIcon />}
						labelOn={copy.cameraOffToggle}
						labelOff={copy.cameraOn}
						testId="toggle-camera"
					/>
				</Box>
			</Box>
		</Box>
	);
};
