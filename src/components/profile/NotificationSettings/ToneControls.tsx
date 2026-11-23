import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { InputAdornment } from '@mui/material';
import { OrisoSelect } from '../../form/OrisoSelect';
import { ReactComponent as NotificationAudioOffIcon } from '../../../resources/img/icons/notification_audio_off.svg';
import { ReactComponent as PlayCircleIcon } from '../../../resources/img/icons/play-circle.svg';
import { ReactComponent as ArrowUpIcon } from '../../../resources/img/icons/keyboard_arrow_up.svg';
import { ReactComponent as ArrowDownIcon } from '../../../resources/img/icons/keyboard_arrow_down.svg';
import {
	NOTIFICATION_TONE_IDS,
	SoundId
} from '../../../utils/notificationSettings/model';
import { soundAssetFor } from '../../../utils/notificationSettings/soundPlayback';
import {
	clampVolume,
	VOLUME_STEP
} from '../../../utils/notificationSettings/notificationConfig';
import './notificationConfigDialog.styles.scss';

/**
 * Volume arrows + tone dropdown (with play / muted icon): the sound controls
 * of one notification row, shared by the config dialog rows and the system
 * notice picker so both behave alike.
 */
/** The tones the picker offers as choices. */
const OFFERED_SOUNDS: ReadonlyArray<string> = [
	'none',
	'ring',
	...NOTIFICATION_TONE_IDS
];

export const ToneControls = ({
	sound,
	volume,
	label,
	disabled,
	describedBy,
	cySuffix,
	onSoundChange,
	onVolumeChange,
	onPreview
}: {
	sound: SoundId;
	volume: number;
	/** Accessible name of the dropdown. */
	label: string;
	disabled: boolean;
	/** Id of the element that says why the controls are disabled. */
	describedBy?: string;
	/** Ends the data-cy hooks: notif-volume-up-<suffix>, notif-play-<suffix>… */
	cySuffix: string;
	onSoundChange: (sound: SoundId) => void;
	onVolumeChange: (volume: number) => void;
	onPreview: (sound: SoundId, volume: number) => void;
}) => {
	const { t } = useTranslation();
	const hasSound = sound !== 'none' && !!soundAssetFor(sound);
	return (
		<div className="notifConfig__rowControls">
			{/* Volume up/down — the react-sounds volume, per kind. */}
			<div
				className="notifConfig__volume"
				data-cy={`notif-volume-${cySuffix}`}
			>
				<button
					type="button"
					className="notifConfig__volumeBtn"
					aria-label={t('profile.notifications.config.volumeUp')}
					disabled={disabled || volume >= 1}
					onClick={() =>
						onVolumeChange(clampVolume(volume + VOLUME_STEP))
					}
					data-cy={`notif-volume-up-${cySuffix}`}
				>
					<ArrowUpIcon aria-hidden="true" />
				</button>
				<button
					type="button"
					className="notifConfig__volumeBtn"
					aria-label={t('profile.notifications.config.volumeDown')}
					disabled={disabled || volume <= 0}
					onClick={() =>
						onVolumeChange(clampVolume(volume - VOLUME_STEP))
					}
					data-cy={`notif-volume-down-${cySuffix}`}
				>
					<ArrowDownIcon aria-hidden="true" />
				</button>
			</div>

			<OrisoSelect
				className="notifConfig__select"
				label={label}
				value={sound}
				disabled={disabled}
				inputProps={{
					'aria-describedby': disabled ? describedBy : undefined
				}}
				onChange={(e) => onSoundChange(e.target.value as SoundId)}
				options={[
					// A stored value the picker does not offer (the legacy
					// 'default', an older or unknown tone) stays selected and
					// named until the person picks a current tone.
					...(OFFERED_SOUNDS.includes(sound)
						? []
						: [
								{
									value: sound,
									label: t(
										sound === 'default'
											? 'profile.notifications.config.defaultSound'
											: 'profile.notifications.config.legacySound'
									)
								}
							]),
					{
						value: 'none',
						label: t('profile.notifications.config.noSound')
					},
					{
						value: 'ring',
						label: t('profile.notifications.config.ringTone')
					},
					...NOTIFICATION_TONE_IDS.map((id, index) => ({
						value: id,
						label: t('profile.notifications.config.tone', {
							number: index + 1
						})
					}))
				]}
				startAdornment={
					<InputAdornment position="start">
						{/* Icon lives INSIDE the field (left), per the Figma: a
				    chosen tone → a play button to hear it; no sound →
				    the crossed-out (muted) icon, not clickable. */}
						{hasSound ? (
							<button
								type="button"
								className="notifConfig__fieldIcon notifConfig__fieldIcon--play"
								aria-label={t(
									'profile.notifications.config.play'
								)}
								disabled={disabled}
								onClick={() => onPreview(sound, volume)}
								data-cy={`notif-play-${cySuffix}`}
							>
								<PlayCircleIcon aria-hidden="true" />
							</button>
						) : (
							<span
								className="notifConfig__fieldIcon notifConfig__fieldIcon--mute"
								aria-hidden="true"
								data-cy={`notif-muted-${cySuffix}`}
							>
								<NotificationAudioOffIcon />
							</span>
						)}
					</InputAdornment>
				}
			/>
		</div>
	);
};
