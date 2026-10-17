import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { MicLevelMeter } from './MicLevelMeter';
import { DeviceToggle } from './DeviceToggle';
import { callEntryCopy as copy } from './callEntryCopy';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import type { Avatar } from '../../../utils/pseudonymGenerator';

export interface VideoCheckProps {
	name: string;
	/** The person's animal: the picture whenever the camera is off. */
	avatar: Avatar;
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
 * test stand under it in `CallEntryRoom`.
 */
export const VideoCheck = ({
	name,
	avatar,
	stream,
	cameraOn,
	micOn,
	micLevel,
	onToggleCamera,
	onToggleMic
}: VideoCheckProps) => {
	const phone = useMediaQuery('(max-width: 599.95px)');
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
					...(cameraOn
						? {
								bgcolor: '#1f1f22',
								/* Stand-in light when there is no stream: reads as
								   "a camera picture goes here" without faking a person. */
								backgroundImage:
									'radial-gradient(120% 90% at 30% 20%, #4a4a52 0%, #26262b 55%, #1a1a1d 100%)'
							}
						: {
								/* Camera off: the whole tile becomes the animal's
								   colour, as Element Call fills a tile without video. */
								bgcolor: avatar.bg
							})
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
							/* Between the name chip (top) and the switches (bottom),
							   so the animal never slides behind either. */
							position: 'absolute',
							top: 48,
							bottom: 68,
							left: 0,
							right: 0,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 1
						}}
					>
						<Box aria-hidden data-testid="video-avatar">
							<AnimalAvatar
								avatar={avatar}
								size={phone ? 64 : 88}
								outline={false}
							/>
						</Box>
						<Typography
							sx={{
								display: { xs: 'none', sm: 'block' },
								fontSize: 14,
								fontWeight: 500,
								color: avatar.iconColor
							}}
						>
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
					<AnimalAvatar avatar={avatar} size={22} outline={false} />
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
							color: '#fff',
							maxWidth: 160,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						}}
					>
						{name || '…'}
					</Typography>
				</Box>
				{!cameraOn && (
					/* Keeps the white switches legible on a light colour. */
					<Box
						aria-hidden
						sx={{
							position: 'absolute',
							left: 0,
							right: 0,
							bottom: 0,
							height: 76,
							background:
								'linear-gradient(to top, rgba(0,0,0,.38), rgba(0,0,0,0))'
						}}
					/>
				)}
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
						name={copy.devices.microphone}
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
						name={copy.devices.camera}
						labelOn={copy.cameraOffToggle}
						labelOff={copy.cameraOn}
						testId="toggle-camera"
					/>
				</Box>
			</Box>
		</Box>
	);
};
