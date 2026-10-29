import * as React from 'react';
import './groupConsentGate.styles.scss';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mui/material';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { GdprIcon } from '../../../resources/img/icons';
import { sanitizeConsentHtml } from '../../legalContent/legalHtmlSanitizer';
import htmlParser from '../../../resources/scripts/util/htmlParser';
import { useGroupConsent } from './useGroupConsent';

export interface GroupConsentGateProps {
	/** The Beratungsstelle that runs the group. */
	agencyId?: number | null;
	/** Called once the agreement is recorded on the account. */
	onAccepted: () => void;
}

/**
 * Gate 2 of ADR-022 in a self-help group (#1499): the statement of the
 * Beratungsstelle that runs the group, agreed to before the first message.
 *
 * Since 2026-10-16 the waiting room asks on "Beitreten" (Frank); this dialog
 * is the safety net for a way in that skips the waiting room, and appears
 * only while the account has no agreement. Sentence and recording come from
 * `useGroupConsent`, the same rules as the live chat's gate.
 */
export const GroupConsentGate = ({
	agencyId,
	onAccepted
}: GroupConsentGateProps) => {
	const { t } = useTranslation();
	const consent = useGroupConsent(agencyId);
	const [busy, setBusy] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [rejected, setRejected] = useState(false);
	const phone = useMediaQuery('(max-width:599px)');

	const handleAccept = useCallback(() => {
		if (busy || !consent.readable) return;
		setBusy(true);
		setSaveFailed(false);
		consent
			.record()
			.then(() => onAccepted())
			.catch(() => {
				// Not recorded: the gate stays, and the client is told so.
				setSaveFailed(true);
				setBusy(false);
			});
	}, [busy, consent, onAccepted]);

	/* The sentence becomes Träger-authored text (ADR-021 decision 4), so it
	   goes through the shared consent sanitizer, never into a raw sink. */
	const sentence = useMemo(
		() => htmlParser(sanitizeConsentHtml(consent.html)),
		[consent.html]
	);

	/* The house M3 dialog (icon, title, supporting text, text actions), full
	   screen on a phone like the group's share dialog. No close: agreeing is
	   the way into the group, and "Ablehnen" says so instead of hiding it. */
	return (
		<M3Dialog
			open
			onClose={() => undefined}
			closable={false}
			fullScreen={phone}
			width={560}
			icon={<GdprIcon />}
			title={t('groupChat.consent.headline', 'Bevor Sie schreiben')}
			description={t(
				'groupChat.consent.description',
				'Diese Gruppe wird von einer Beratungsstelle geleitet. Bitte stimmen Sie ihrer Datenschutzerklärung zu, bevor Sie in der Gruppe schreiben.'
			)}
			className="groupConsentGate"
			data-testid="group-consent-gate"
			actions={[
				{
					label: t('groupChat.consent.reject', 'Ablehnen'),
					onClick: () => setRejected(true),
					disabled: busy,
					testId: 'group-consent-reject'
				},
				{
					label: t('groupChat.consent.accept', 'Einverstanden'),
					onClick: handleAccept,
					primary: true,
					disabled: busy || !consent.readable,
					testId: 'group-consent-accept'
				}
			]}
		>
			{/* While the statement for this group loads, show none at all. */}
			{consent.readable && (
				<p className="groupConsentGate__sentence">{sentence}</p>
			)}
			{saveFailed && (
				<p className="groupConsentGate__rejected" role="alert">
					{t(
						'groupChat.consent.saveFailed',
						'Ihre Zustimmung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
					)}
				</p>
			)}
			{rejected && (
				<p className="groupConsentGate__rejected" role="alert">
					{t(
						'groupChat.consent.rejected',
						'Ohne Ihre Zustimmung können Sie in dieser Gruppe nicht schreiben. Sie können jederzeit später zustimmen.'
					)}
				</p>
			)}
		</M3Dialog>
	);
};
