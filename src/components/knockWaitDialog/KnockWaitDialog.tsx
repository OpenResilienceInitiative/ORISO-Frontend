import * as React from 'react';
import './knockWaitDialog.styles.scss';
import { ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircularProgress, useMediaQuery } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { M3Dialog, M3DialogAction } from '../m3Dialog/M3Dialog';
import { GdprIcon } from '../../resources/img/icons';
import {
	CallDeviceCheck,
	CallDeviceCheckProps
} from '../waitingRoom/callEntry/CallDeviceCheck';
import { KnockWaitPhase, KnockWaitVariant } from './knockWaitPhase';

/**
 * Mic and camera of the call variant; the caller owns the real stream. The
 * waiting room's shared device check (`CallDeviceCheck`).
 */
export type KnockWaitMedia = CallDeviceCheckProps;

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
	 * `ready` only (#2016): "Jetzt beitreten". The caller closes the dialog
	 * first, so its preview lets go of the camera, then joins.
	 */
	onJoin?: () => void;
	/**
	 * `ready` only. `join` (default): the check right before the call.
	 * `check`: the circle pre-lobby's option, kept for the group's next call;
	 * the action says "Fertig".
	 */
	purpose?: 'join' | 'check';
	/** `ready` only: the check could not run, ask the browser again. */
	onRetry?: () => void;
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
 * The small dialog over the chat before a signed-in person enters a call.
 *
 * `ready` (#2016): the device check before joining from the call message,
 * and the circle pre-lobby's device option.
 *
 * The other phases: the "wait until you are let in" dialog (Frank,
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
	onJoin,
	purpose = 'join',
	onRetry,
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
	/* What the live region says: the knock's state and the host's answer. */
	let announcement = '';
	let actions: M3DialogAction[] = [];

	switch (phase) {
		case 'ready':
			title = t('knockWait.ready.title');
			description =
				purpose === 'check'
					? t('knockWait.ready.descriptionCheck')
					: t('knockWait.ready.description');
			body = media ? <CallDeviceCheck {...media} /> : null;
			actions = [
				...(media?.blocker && onRetry
					? [
							{
								label: t('knockWait.ready.retry'),
								onClick: onRetry,
								testId: 'knock-wait-retry'
							}
						]
					: []),
				...(onJoin
					? [
							{
								label:
									purpose === 'check'
										? t('knockWait.ready.done')
										: t('knockWait.ready.join'),
								onClick: onJoin,
								primary: true,
								testId: 'knock-wait-join'
							}
						]
					: [])
			];
			break;
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
					disabled: busy || !consentSentence || !onAcceptConsent,
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
			announcement = of(
				t('knockWait.waiting.statusCall'),
				t('knockWait.waiting.statusGroup')
			);
			body = (
				<>
					{isCall && media && <CallDeviceCheck {...media} />}
					<Status text={announcement} />
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
			announcement = of(
				t('knockWait.admitted.statusCall'),
				t('knockWait.admitted.statusGroup')
			);
			body = <Status text={announcement} />;
			break;
		case 'declined':
			title = t('knockWait.declined.title');
			description = announcement = of(
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
			footerContent={
				/* One live region for the dialog's whole life, so a screen
				   reader hears every change, the host's answer included. It sits
				   in the footer, which every phase renders, not in the body:
				   an empty body would still be a tab stop. */
				<p
					className="sr-only"
					role="status"
					aria-live="polite"
					data-testid="knock-wait-live"
				>
					{announcement}
				</p>
			}
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

/** The visible line of what is happening; the live region announces it. */
const Status = ({ text }: { text: string }) => (
	<p
		className="knockWaitDialog__status"
		aria-hidden="true"
		data-testid="knock-wait-status"
	>
		<CircularProgress size={16} thickness={5} color="inherit" aria-hidden />
		<span>{text}</span>
	</p>
);
