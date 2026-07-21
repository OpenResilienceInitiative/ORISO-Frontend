import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoDialog } from '../../modal/OrisoDialog';
import { ReactComponent as NotificationSettingsIcon } from '../../../resources/img/icons/notification_settings.svg';
import { ReactComponent as NotificationAudioOffIcon } from '../../../resources/img/icons/notification_audio_off.svg';
import { ReactComponent as NotificationAudioIcon } from '../../../resources/img/icons/notification_audio.svg';
import {
	NOTIFICATION_TONE_IDS,
	SoundId
} from '../../../utils/notificationSettings/model';
import { soundAssetFor } from '../../../utils/notificationSettings/soundPlayback';
import {
	clampVolume,
	DISABLED_AREAS,
	KindConfig,
	NOTIFICATION_AREAS,
	NOTIFICATION_KINDS,
	NotificationArea,
	NotificationConfig,
	NotificationKind,
	VOLUME_STEP
} from '../../../utils/notificationSettings/notificationConfig';
import './notificationConfigDialog.styles.scss';

/* ------------------------------------------------------------------ *
 * A single kind row: volume arrows + sound dropdown (with play/mute) + email
 * ------------------------------------------------------------------ */

const KindRow = ({
	area,
	kind,
	value,
	onChange,
	onPreview
}: {
	area: NotificationArea;
	kind: NotificationKind;
	value: KindConfig;
	onChange: (
		area: NotificationArea,
		kind: NotificationKind,
		field: keyof KindConfig,
		value: SoundId | boolean | number
	) => void;
	onPreview: (soundId: SoundId, volume: number) => void;
}) => {
	const { t } = useTranslation();
	const hasSound = value.sound !== 'none' && !!soundAssetFor(value.sound);
	return (
		<div className="notifConfig__row" data-cy={`notif-row-${area}-${kind}`}>
			<label className="notifConfig__label">
				{t(`profile.notifications.config.kind.${kind}`)}
			</label>
			<div className="notifConfig__rowControls">
				{/* Volume up/down — the react-sounds volume, per kind. */}
				<div
					className="notifConfig__volume"
					data-cy={`notif-volume-${area}-${kind}`}
				>
					<button
						type="button"
						className="notifConfig__volumeBtn"
						aria-label={t('profile.notifications.config.volumeUp')}
						disabled={value.volume >= 1}
						onClick={() =>
							onChange(
								area,
								kind,
								'volume',
								clampVolume(value.volume + VOLUME_STEP)
							)
						}
						data-cy={`notif-volume-up-${area}-${kind}`}
					>
						▲
					</button>
					<button
						type="button"
						className="notifConfig__volumeBtn"
						aria-label={t(
							'profile.notifications.config.volumeDown'
						)}
						disabled={value.volume <= 0}
						onClick={() =>
							onChange(
								area,
								kind,
								'volume',
								clampVolume(value.volume - VOLUME_STEP)
							)
						}
						data-cy={`notif-volume-down-${area}-${kind}`}
					>
						▼
					</button>
				</div>

				<div className="notifConfig__selectWrap">
					{/* Sound chosen → a play button to preview it;
					    no sound → the crossed-out (muted) icon. */}
					{hasSound ? (
						<button
							type="button"
							className="notifConfig__play"
							aria-label={t('profile.notifications.config.play')}
							onClick={() => onPreview(value.sound, value.volume)}
							data-cy={`notif-play-${area}-${kind}`}
						>
							<NotificationAudioIcon />
							<span
								className="notifConfig__playTriangle"
								aria-hidden="true"
							>
								▶
							</span>
						</button>
					) : (
						<span
							className="notifConfig__selectIcon notifConfig__selectIcon--muted"
							aria-hidden="true"
							data-cy={`notif-muted-${area}-${kind}`}
						>
							<NotificationAudioOffIcon />
						</span>
					)}
					<select
						className="notifConfig__select"
						aria-label={t(
							`profile.notifications.config.kind.${kind}`
						)}
						value={value.sound}
						onChange={(e) =>
							onChange(
								area,
								kind,
								'sound',
								e.target.value as SoundId
							)
						}
					>
						<option value="none">
							{t('profile.notifications.config.noSound')}
						</option>
						{NOTIFICATION_TONE_IDS.map((id, index) => (
							<option key={id} value={id}>
								{t('profile.notifications.config.tone', {
									number: index + 1
								})}
							</option>
						))}
					</select>
				</div>
			</div>
			<label className="notifConfig__email">
				<input
					type="checkbox"
					checked={value.email}
					onChange={(e) =>
						onChange(area, kind, 'email', e.target.checked)
					}
					data-cy={`notif-email-${area}-${kind}`}
				/>
				<span>{t('profile.notifications.config.sendByEmail')}</span>
			</label>
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Presentational body (tabs + rows)
 * ------------------------------------------------------------------ */

export interface NotificationConfigViewProps {
	config: NotificationConfig;
	activeArea: NotificationArea;
	onAreaChange: (area: NotificationArea) => void;
	onChange: (
		area: NotificationArea,
		kind: NotificationKind,
		field: keyof KindConfig,
		value: SoundId | boolean | number
	) => void;
	onPreview: (soundId: SoundId, volume: number) => void;
}

export const NotificationConfigView = ({
	config,
	activeArea,
	onAreaChange,
	onChange,
	onPreview
}: NotificationConfigViewProps) => {
	const { t } = useTranslation();
	return (
		<div className="notifConfig" data-cy="notif-config">
			<p className="notifConfig__intro">
				{t('profile.notifications.config.intro')}
			</p>
			<p className="notifConfig__emailNote">
				{t('profile.notifications.config.emailNote')}
			</p>

			<div className="notifConfig__tabs" role="tablist">
				{NOTIFICATION_AREAS.map((area) => {
					const disabled = DISABLED_AREAS.includes(area);
					return (
						<button
							key={area}
							type="button"
							role="tab"
							aria-selected={area === activeArea}
							disabled={disabled}
							className={
								'notifConfig__tab' +
								(area === activeArea
									? ' notifConfig__tab--active'
									: '') +
								(disabled ? ' notifConfig__tab--disabled' : '')
							}
							onClick={() => !disabled && onAreaChange(area)}
							data-cy={`notif-tab-${area}`}
						>
							{t(`profile.notifications.config.area.${area}`)}
						</button>
					);
				})}
			</div>

			<div className="notifConfig__rows">
				{NOTIFICATION_KINDS.map((kind) => (
					<KindRow
						key={kind}
						area={activeArea}
						kind={kind}
						value={config[activeArea][kind]}
						onChange={onChange}
						onPreview={onPreview}
					/>
				))}
			</div>
		</div>
	);
};

/* ------------------------------------------------------------------ *
 * Container (dialog chrome + confirm/cancel + preview playback)
 * ------------------------------------------------------------------ */

interface NotificationConfigDialogProps {
	open: boolean;
	config: NotificationConfig;
	onConfirm: (config: NotificationConfig) => void;
	onClose: () => void;
}

export const NotificationConfigDialog = ({
	open,
	config,
	onConfirm,
	onClose
}: NotificationConfigDialogProps) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<NotificationConfig>(config);
	const [activeArea, setActiveArea] = useState<NotificationArea>('requests');

	React.useEffect(() => {
		if (open) {
			setDraft(config);
			setActiveArea('requests');
		}
	}, [open, config]);

	const handleChange = useCallback(
		(
			area: NotificationArea,
			kind: NotificationKind,
			field: keyof KindConfig,
			value: SoundId | boolean | number
		) => {
			setDraft((prev) => ({
				...prev,
				[area]: {
					...prev[area],
					[kind]: { ...prev[area][kind], [field]: value }
				}
			}));
		},
		[]
	);

	const handlePreview = useCallback((soundId: SoundId, volume: number) => {
		const asset = soundAssetFor(soundId);
		if (asset && 'Audio' in window) {
			const audio = new Audio(asset);
			audio.volume = Math.max(0, Math.min(1, volume));
			audio.play().catch(() => undefined);
		}
	}, []);

	return (
		<OrisoDialog
			open={open}
			onClose={onClose}
			title={t('profile.notifications.config.title')}
			icon={<NotificationSettingsIcon />}
			maxWidth="620px"
			height="auto"
		>
			<NotificationConfigView
				config={draft}
				activeArea={activeArea}
				onAreaChange={setActiveArea}
				onChange={handleChange}
				onPreview={handlePreview}
			/>
			<div className="notifConfig__footer">
				<button
					type="button"
					className="notifConfig__cancel"
					onClick={onClose}
					aria-label={t('profile.notifications.config.cancel')}
				>
					✕
				</button>
				<button
					type="button"
					className="notifConfig__confirm"
					onClick={() => onConfirm(draft)}
					data-cy="notif-confirm"
				>
					✓ {t('profile.notifications.config.confirm')}
				</button>
			</div>
		</OrisoDialog>
	);
};
