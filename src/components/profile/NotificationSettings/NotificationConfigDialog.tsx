import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrisoDialog } from '../../modal/OrisoDialog';
import { ReactComponent as NotificationSettingsIcon } from '../../../resources/img/icons/notification_settings.svg';
import { ReactComponent as NotificationAudioOffIcon } from '../../../resources/img/icons/notification_audio_off.svg';
import { ReactComponent as PlayCircleIcon } from '../../../resources/img/icons/play-circle.svg';
import { ReactComponent as ArrowUpIcon } from '../../../resources/img/icons/keyboard_arrow_up.svg';
import { ReactComponent as ArrowDownIcon } from '../../../resources/img/icons/keyboard_arrow_down.svg';
import {
	NOTIFICATION_TONE_IDS,
	SoundId
} from '../../../utils/notificationSettings/model';
import { soundAssetFor } from '../../../utils/notificationSettings/soundPlayback';
import { M3Checkbox } from '../../M3Checkbox';
import {
	AREA_KINDS,
	BannerMode,
	clampVolume,
	DISABLED_AREAS,
	KindConfig,
	NOTIFICATION_AREAS,
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
		value: SoundId | BannerMode | boolean | number
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
						<ArrowUpIcon />
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
						<ArrowDownIcon />
					</button>
				</div>

				<div className="notifConfig__selectWrap">
					{/* Icon lives INSIDE the field (left), per the Figma: a
					    chosen tone → a play button to hear it; no sound →
					    the crossed-out (muted) icon, not clickable. */}
					{hasSound ? (
						<button
							type="button"
							className="notifConfig__fieldIcon notifConfig__fieldIcon--play"
							aria-label={t('profile.notifications.config.play')}
							onClick={() => onPreview(value.sound, value.volume)}
							data-cy={`notif-play-${area}-${kind}`}
						>
							<PlayCircleIcon />
						</button>
					) : (
						<span
							className="notifConfig__fieldIcon notifConfig__fieldIcon--mute"
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
						<option value="ring">
							{t('profile.notifications.config.ringTone')}
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
			<div className="notifConfig__channels">
				{/* Banner: off / temporary / persistent (requireInteraction —
				    Chromium only; Firefox/Safari fall back to temporary). */}
				<label className="notifConfig__banner">
					<span>
						{t('profile.notifications.config.banner.label')}
					</span>
					<select
						className="notifConfig__bannerSelect"
						value={value.banner}
						onChange={(e) =>
							onChange(
								area,
								kind,
								'banner',
								e.target.value as BannerMode
							)
						}
						data-cy={`notif-banner-${area}-${kind}`}
					>
						<option value="off">
							{t('profile.notifications.config.banner.off')}
						</option>
						<option value="temporary">
							{t('profile.notifications.config.banner.temporary')}
						</option>
						<option value="persistent">
							{t(
								'profile.notifications.config.banner.persistent'
							)}
						</option>
					</select>
				</label>
				<M3Checkbox
					checked={value.email}
					onChange={(checked) =>
						onChange(area, kind, 'email', checked)
					}
					label={t('profile.notifications.config.sendByEmail')}
					dataCy={`notif-email-${area}-${kind}`}
				/>
			</div>
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
		value: SoundId | BannerMode | boolean | number
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
				{AREA_KINDS[activeArea].map((kind) => (
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

			{/* Feature-signal dummy (FE#590): alarm-clock mode micro-survey.
			    Votes are a UI demo — the backend vote API is US#544. */}
			{activeArea === 'timeCritical' && <WeckerSignalCard />}
		</div>
	);
};

const WeckerSignalCard = () => {
	const { t } = useTranslation();
	const [voted, setVoted] = useState(false);
	return (
		<div className="notifConfig__signalCard" data-cy="notif-wecker-card">
			<strong className="notifConfig__signalTitle">
				{t('profile.notifications.config.wecker.title')}
			</strong>
			<p className="notifConfig__signalText">
				{t('profile.notifications.config.wecker.text')}
			</p>
			{voted ? (
				<p
					className="notifConfig__signalThanks"
					data-cy="notif-wecker-thanks"
				>
					{t('profile.notifications.config.wecker.thanks')}
				</p>
			) : (
				<div className="notifConfig__signalVotes">
					<button
						type="button"
						className="notifConfig__signalVote"
						onClick={() => setVoted(true)}
						data-cy="notif-wecker-up"
					>
						👍 {t('profile.notifications.config.wecker.upvote')}
					</button>
					<button
						type="button"
						className="notifConfig__signalVote"
						onClick={() => setVoted(true)}
						data-cy="notif-wecker-down"
					>
						👎 {t('profile.notifications.config.wecker.downvote')}
					</button>
				</div>
			)}
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
			value: SoundId | BannerMode | boolean | number
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
			hideActions
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
