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
	DISABLED_AREAS,
	KindConfig,
	NOTIFICATION_AREAS,
	NOTIFICATION_KINDS,
	NotificationArea,
	NotificationConfig,
	NotificationKind
} from '../../../utils/notificationSettings/notificationConfig';
import './notificationConfigDialog.styles.scss';

/* ------------------------------------------------------------------ *
 * A single kind row: sound dropdown + "send by email"
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
		value: SoundId | boolean
	) => void;
	onPreview: (soundId: SoundId) => void;
}) => {
	const { t } = useTranslation();
	const hasSound = value.sound !== 'none' && !!soundAssetFor(value.sound);
	return (
		<div className="notifConfig__row" data-cy={`notif-row-${area}-${kind}`}>
			<label className="notifConfig__label">
				{t(`profile.notifications.config.kind.${kind}`)}
			</label>
			<div className="notifConfig__selectWrap">
				<span className="notifConfig__selectIcon" aria-hidden="true">
					{hasSound ? (
						<NotificationAudioIcon />
					) : (
						<NotificationAudioOffIcon />
					)}
				</span>
				<select
					className="notifConfig__select"
					aria-label={t(`profile.notifications.config.kind.${kind}`)}
					value={value.sound}
					onChange={(e) => {
						const sound = e.target.value as SoundId;
						onChange(area, kind, 'sound', sound);
						if (sound !== 'none') {
							onPreview(sound);
						}
					}}
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
		value: SoundId | boolean
	) => void;
	onPreview: (soundId: SoundId) => void;
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
			value: SoundId | boolean
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
