import * as React from 'react';
import './knockWaitDialog.styles.scss';
import { ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircularProgress, useMediaQuery } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { M3Dialog, M3DialogAction } from '../m3Dialog/M3Dialog';
import { GdprIcon } from '../../resources/img/icons';
import { VideoCheck } from '../waitingRoom/callEntry/VideoCheck';
import { DeviceToggle } from '../waitingRoom/callEntry/DeviceToggle';
import { DevicePicker } from '../waitingRoom/callEntry/DevicePicker';
import { MicLevelMeter } from '../waitingRoom/callEntry/MicLevelMeter';
import {
	CallDeviceKind,
	CallDevices,
	CallDeviceSelection,
	CallModality
} from '../waitingRoom/callEntry/callEntryTypes';
import type { Avatar } from '../../utils/pseudonymGenerator';
import { KnockWaitPhase, KnockWaitVariant } from './knockWaitPhase';

/** Mic and camera of the call variant; the caller owns the real stream. */
export interface KnockWaitMedia {
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
	onToggleMic: () => void;
	onToggleCamera: () => void;
	onSelectDevice: (kind: CallDeviceKind, id: string) => void;
}

export interface KnockWaitDialogProps {
	open?: boolean;
	/** `call`: a running call in the chat. `group`: the time-limited group chat. */
	variant: KnockWaitVariant;
	phase: KnockWaitPhase;
	/** Call variant only: preview and switches. Without it, none are shown. */
	media?: KnockWaitMedia;
	/** Group consent: the Beratungsstelle's sentence, already sanitized. */
	consentSentence?: ReactNode;
	/** Group consent: names the Beratungsstelle in the description. */
	agencyName?: string;
	/** Group variant: closing time, already formatted, e.g. "19:30". */
	openUntil?: string;
	/**
	 * Records the agreement; the caller then sends `consentAccepted`. A
	 * rejected promise keeps the consent step and says it was not saved.
	 */
	onAcceptConsent?: () => Promise<void> | void;
	/**
	 * "Nicht mehr warten" (and Escape while waiting): withdraws the knock;
	 * the caller closes the dialog. There is no "cancelled" screen.
	 */
	onCancel: () => void;
	onKnockAgain: () => void;
	onClose: () => void;
	/**
	 * Bottom sheet instead of a centred dialog. Defaults to phones (< 600px);
	 * stories may force either.
	 */
	sheet?: boolean;
}

const HERO: Partial<Record<KnockWaitPhase, ReactNode>> = {
	consent: <GdprIcon />,
	admitted: <CheckCircleRoundedIcon />,
	declined: <EventBusyRoundedIcon />
};

/**
 * The small "wait until you are let in" dialog over the chat (Frank,
 * 2026-10-21): a signed-in person clicks the call message, or opens a
 * time-limited self-help group chat that needs the lead's admission.
 *
 * Deliberately not a waiting room: no frame, no bar, no gate button. It is
 * the house `M3Dialog` with the call entry's own preview and switches, a
 * status line and one way out. In the group chat it asks the Beratungsstelle's
 * consent first when the account has none (same copy as `GroupConsentGate`).
 */
export const KnockWaitDialog = ({
	open = true,
	variant,
	phase,
	media,
	consentSentence,
	agencyName,
	openUntil,
	onAcceptConsent,
	onCancel,
	onKnockAgain,
	onClose,
	sheet
}: KnockWaitDialogProps) => {
	const { t } = useTranslation();
	const phone = useMediaQuery('(max-width: 599.95px)');
	const asSheet = sheet ?? phone;
	const [busy, setBusy] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [rejected, setRejected] = useState(false);
	const isCall = variant === 'call';
	const of = (call: string, group: string) => (isCall ? call : group);

	const acceptConsent = useCallback(() => {
		if (busy || !onAcceptConsent) return;
		setBusy(true);
		setSaveFailed(false);
		setRejected(false);
		Promise.resolve()
			.then(onAcceptConsent)
			.catch(() => setSaveFailed(true))
			.finally(() => setBusy(false));
	}, [busy, onAcceptConsent]);

	/* While waiting, every way out (✕ is hidden, Escape, backdrop) stops the
	   knock, so nobody keeps waiting unseen. Once admitted there is none. */
	const handleClose = () => {
		if (phase === 'waiting') onCancel();
		else if (phase !== 'admitted') onClose();
	};

	const close: M3DialogAction = {
		label: t('app.close'),
		onClick: onClose,
		testId: 'knock-wait-close'
	};
	const knockAgain: M3DialogAction = {
		label: t('knockWait.knockAgain'),
		onClick: onKnockAgain,
		primary: true,
		testId: 'knock-wait-again'
	};

	let title: ReactNode;
	let description: ReactNode;
	let body: ReactNode = null;
	let actions: M3DialogAction[] = [];

	switch (phase) {
		case 'consent':
			title = t('groupChat.consent.headline');
			description = agencyName
				? t('groupChat.consent.descriptionNamed', {
						agency: agencyName
					})
				: t('groupChat.consent.description');
			body = (
				<>
					{consentSentence && (
						<p className="knockWaitDialog__sentence">
							{consentSentence}
						</p>
					)}
					{saveFailed && (
						<p className="knockWaitDialog__alert" role="alert">
							{t('groupChat.consent.saveFailed')}
						</p>
					)}
					{rejected && (
						<p className="knockWaitDialog__alert" role="alert">
							{t('groupChat.consent.rejected')}
						</p>
					)}
				</>
			);
			actions = [
				{
					label: t('groupChat.consent.reject'),
					onClick: () => setRejected(true),
					disabled: busy,
					testId: 'knock-wait-consent-reject'
				},
				{
					label: t('groupChat.consent.accept'),
					onClick: acceptConsent,
					primary: true,
					disabled: busy || !consentSentence,
					testId: 'knock-wait-consent-accept'
				}
			];
			break;
		case 'waiting':
			title = t('knockWait.waiting.title');
			description = of(
				t('knockWait.waiting.descriptionCall'),
				t('knockWait.waiting.descriptionGroup')
			);
			body = (
				<>
					{isCall && media && <KnockWaitMediaControls {...media} />}
					<Status
						text={of(
							t('knockWait.waiting.statusCall'),
							t('knockWait.waiting.statusGroup')
						)}
					/>
					{!isCall && openUntil && (
						<p className="knockWaitDialog__quiet">
							{t('knockWait.waiting.openUntil', {
								time: openUntil
							})}
						</p>
					)}
				</>
			);
			actions = [
				{
					label: t('knockWait.waiting.cancel'),
					onClick: onCancel,
					testId: 'knock-wait-cancel'
				}
			];
			break;
		case 'admitted':
			title = t('knockWait.admitted.title');
			body = (
				<Status
					text={of(
						t('knockWait.admitted.statusCall'),
						t('knockWait.admitted.statusGroup')
					)}
				/>
			);
			break;
		case 'declined':
			title = t('knockWait.declined.title');
			description = of(
				t('knockWait.declined.descriptionCall'),
				t('knockWait.declined.descriptionGroup')
			);
			actions = [close, knockAgain];
			break;
	}

	return (
		<M3Dialog
			open={open}
			onClose={handleClose}
			closable={phase !== 'waiting' && phase !== 'admitted'}
			closeLabel={t('app.close')}
			width={480}
			icon={HERO[phase]}
			title={title}
			description={description}
			actions={actions}
			showDivider={false}
			className={
				asSheet
					? 'knockWaitDialog knockWaitDialog--sheet'
					: 'knockWaitDialog'
			}
			data-testid="knock-wait-dialog"
		>
			{body}
		</M3Dialog>
	);
};

/** A quiet live line: what is happening right now. */
const Status = ({ text }: { text: string }) => (
	<p
		className="knockWaitDialog__status"
		role="status"
		data-testid="knock-wait-status"
	>
		<CircularProgress size={16} thickness={5} color="inherit" aria-hidden />
		<span>{text}</span>
	</p>
);

/**
 * Only mic and camera, and a device choice only where there is one to make:
 * the call entry's preview tile, or for a phone call one mic switch and its
 * meter. No speaker test, no identity, no tips.
 */
const KnockWaitMediaControls = ({
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
	onToggleMic,
	onToggleCamera,
	onSelectDevice
}: KnockWaitMedia) => {
	const { t } = useTranslation();
	const video = modality === 'video';
	const kinds: CallDeviceKind[] = video
		? ['microphone', 'camera']
		: ['microphone'];
	const pickers = kinds.filter((kind) => devices[kind].length > 1);

	return (
		<div className="knockWaitDialog__media">
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
					onToggleMic={onToggleMic}
				/>
			) : (
				<div className="knockWaitDialog__voice">
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
				<div className="knockWaitDialog__pickers">
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
