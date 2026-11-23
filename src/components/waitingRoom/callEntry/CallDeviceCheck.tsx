import * as React from 'react';
import './callDeviceCheck.styles.scss';
import { useTranslation } from 'react-i18next';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import { VideoCheck } from './VideoCheck';
import { DeviceToggle } from './DeviceToggle';
import { DevicePicker } from './DevicePicker';
import { MicLevelMeter } from './MicLevelMeter';
import { CallNotice } from './CallNotice';
import { Button, BUTTON_TYPES } from '../../button/Button';
import {
	CallDeviceKind,
	CallDevices,
	CallDeviceSelection,
	CallEntryBlocker,
	CallModality
} from './callEntryTypes';
import type { Avatar } from '../../../utils/pseudonymGenerator';

/** Mic and camera before a call; the caller owns the real stream. */
export interface CallDeviceCheckProps {
	modality: CallModality;
	/** The person's User-ID on the preview tile. */
	name: string;
	/** The person's animal: the picture while the camera is off. */
	avatar: Avatar;
	devices: CallDevices;
	selection: CallDeviceSelection;
	stream?: MediaStream | null;
	/** 0–1. */
	micLevel: number;
	micOn: boolean;
	cameraOn: boolean;
	/** `false` when there is no usable webcam. */
	cameraAvailable?: boolean;
	/**
	 * The check cannot run (microphone blocked, missing or busy): the waiting
	 * room's notice stands in its place. The caller offers the retry.
	 */
	blocker?: CallEntryBlocker;
	onToggleMic: () => void;
	onToggleCamera: () => void;
	/**
	 * Ask the browser for the camera again. Without it, a camera that was
	 * missing, blocked or busy leaves the camera switch disabled.
	 */
	onCameraRetry?: () => void;
	/**
	 * Why the camera is unavailable. Blocked or busy is said out loud with
	 * a retry, instead of a silent check with the microphone alone.
	 */
	cameraBlocker?: CallEntryBlocker;
	onSelectDevice: (kind: CallDeviceKind, id: string) => void;
}

/**
 * The guest waiting room's device check, small enough for a dialog: the
 * call entry's preview tile (or, for a phone call, one mic switch and its
 * meter) and a device choice only where there is one to make. No speaker
 * test, no identity, no tips.
 *
 * Shared by the knock wait dialog (#1834) and the pre-join check of
 * signed-in people (#2016); `CallEntryRoom` lays out the same parts on its
 * own page.
 */
export const CallDeviceCheck = ({
	modality,
	name,
	avatar,
	devices,
	selection,
	stream,
	micLevel,
	micOn,
	cameraOn,
	cameraAvailable = true,
	blocker,
	onToggleMic,
	onToggleCamera,
	onCameraRetry,
	cameraBlocker,
	onSelectDevice
}: CallDeviceCheckProps) => {
	const { t } = useTranslation();
	if (blocker) {
		return (
			<div className="callDeviceCheck">
				<CallNotice blocker={blocker} compact />
			</div>
		);
	}
	const video = modality === 'video';
	const kinds: CallDeviceKind[] = video
		? ['microphone', 'camera']
		: ['microphone'];
	const pickers = kinds.filter((kind) => devices[kind].length > 1);

	return (
		<div className="callDeviceCheck">
			{video ? (
				<VideoCheck
					name={name}
					avatar={avatar}
					stream={stream}
					cameraOn={cameraOn && cameraAvailable}
					cameraAvailable={cameraAvailable}
					micOn={micOn}
					micLevel={micLevel}
					onToggleCamera={onToggleCamera}
					onCameraRetry={onCameraRetry}
					onToggleMic={onToggleMic}
				/>
			) : null}
			{video &&
			!cameraAvailable &&
			(cameraBlocker === 'permissionDenied' ||
				cameraBlocker === 'deviceBusy') ? (
				<div
					className="callDeviceCheck__cameraNotice"
					role="status"
					data-testid="camera-notice"
					data-blocker={cameraBlocker}
				>
					<p className="callDeviceCheck__cameraNoticeText">
						{t(`knockWait.devices.cameraNotice.${cameraBlocker}`)}
					</p>
					{onCameraRetry && (
						<Button
							item={{
								type: BUTTON_TYPES.SECONDARY,
								label: t('knockWait.devices.cameraNotice.retry')
							}}
							buttonHandle={onCameraRetry}
							testingAttribute="camera-retry"
						/>
					)}
				</div>
			) : null}
			{video ? null : (
				<div className="callDeviceCheck__voice">
					<DeviceToggle
						tone="onSurface"
						on={micOn}
						onToggle={onToggleMic}
						iconOn={<MicRoundedIcon />}
						iconOff={<MicOffRoundedIcon />}
						name={t('knockWait.devices.microphone')}
						labelOn={t('knockWait.devices.micOff')}
						labelOff={t('knockWait.devices.micOn')}
						testId="toggle-mic"
					/>
					{micOn && (
						<MicLevelMeter
							level={micLevel}
							label={t('knockWait.devices.micMeter')}
						/>
					)}
				</div>
			)}
			{pickers.length > 0 && (
				<div className="callDeviceCheck__pickers">
					{pickers.map((kind) => (
						<DevicePicker
							key={kind}
							kind={kind}
							kindLabel={t(`knockWait.devices.${kind}`)}
							devices={devices[kind]}
							selectedId={selection[kind]}
							onSelect={(id) => onSelectDevice(kind, id)}
						/>
					))}
				</div>
			)}
		</div>
	);
};
