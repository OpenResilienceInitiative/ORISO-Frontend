import * as React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoDialog } from '../../modal/OrisoDialog';
import { ReactComponent as AudioOnIcon } from '../../../resources/img/icons/audio-on.svg';
import { SOUND_IDS, SoundId } from '../../../utils/notificationSettings/model';
import { soundAssetFor } from '../../../utils/notificationSettings/soundPlayback';

export type SoundSlot = 'message' | 'mention';

/* ------------------------------------------------------------------ *
 * Presentational body
 * ------------------------------------------------------------------ */

export interface SoundSettingsDialogViewProps {
	messageSound: SoundId;
	mentionSound: SoundId;
	onChange: (slot: SoundSlot, soundId: SoundId) => void;
	onPreview: (soundId: SoundId) => void;
}

const SlotRow = ({
	slot,
	value,
	onChange,
	onPreview
}: {
	slot: SoundSlot;
	value: SoundId;
	onChange: (slot: SoundSlot, soundId: SoundId) => void;
	onPreview: (soundId: SoundId) => void;
}) => {
	const { t } = useTranslation();
	return (
		<div className="soundSettings__row" data-cy={`sound-slot-${slot}`}>
			<label
				className="soundSettings__label"
				htmlFor={`sound-slot-${slot}`}
			>
				{t(`profile.notifications.sounds.slot.${slot}`)}
			</label>
			<select
				id={`sound-slot-${slot}`}
				className="soundSettings__select"
				value={value}
				onChange={(e) => onChange(slot, e.target.value as SoundId)}
			>
				{SOUND_IDS.filter(
					(id) => slot === 'mention' || id !== 'default'
				).map((id) => (
					<option key={id} value={id}>
						{t(`profile.notifications.sounds.choice.${id}`)}
					</option>
				))}
			</select>
			<button
				type="button"
				className="soundSettings__preview"
				aria-label={t('profile.notifications.sounds.preview')}
				disabled={!soundAssetFor(value)}
				onClick={() => onPreview(value)}
				data-cy={`sound-preview-${slot}`}
			>
				▶
			</button>
		</div>
	);
};

export const SoundSettingsDialogView = ({
	messageSound,
	mentionSound,
	onChange,
	onPreview
}: SoundSettingsDialogViewProps) => {
	const { t } = useTranslation();
	return (
		<div className="soundSettings" data-cy="sound-settings">
			<p className="soundSettings__intro">
				{t('profile.notifications.sounds.intro')}
			</p>
			<SlotRow
				slot="message"
				value={messageSound}
				onChange={onChange}
				onPreview={onPreview}
			/>
			<SlotRow
				slot="mention"
				value={mentionSound}
				onChange={onChange}
				onPreview={onPreview}
			/>
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Container (dialog chrome + preview playback)
 * ------------------------------------------------------------------ */

interface SoundSettingsDialogProps {
	open: boolean;
	messageSound: SoundId;
	mentionSound: SoundId;
	onChange: (slot: SoundSlot, soundId: SoundId) => void;
	onClose: () => void;
}

export const SoundSettingsDialog = ({
	open,
	messageSound,
	mentionSound,
	onChange,
	onClose
}: SoundSettingsDialogProps) => {
	const { t } = useTranslation();

	const handlePreview = useCallback((soundId: SoundId) => {
		const asset = soundAssetFor(soundId);
		if (asset && 'Audio' in window) {
			const audio = new Audio(asset);
			audio.volume = 0.5;
			audio.play().catch(() => undefined);
		}
	}, []);

	return (
		<OrisoDialog
			open={open}
			onClose={onClose}
			title={t('profile.notifications.sounds.title')}
			icon={<AudioOnIcon />}
			maxWidth="480px"
			height="auto"
		>
			<SoundSettingsDialogView
				messageSound={messageSound}
				mentionSound={mentionSound}
				onChange={onChange}
				onPreview={handlePreview}
			/>
		</OrisoDialog>
	);
};
