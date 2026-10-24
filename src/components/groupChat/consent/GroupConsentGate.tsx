import * as React from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { WaitingRoomBar } from '../../waitingRoom/WaitingRoomBar';
import {
	useWaitingRoomConsent,
	WaitingRoomConsentPanel
} from '../../waitingRoom/WaitingRoomConsent';
import { useGroupConsent } from './useGroupConsent';

export interface GroupConsentGateProps {
	/** The Beratungsstelle that runs the group. */
	agencyId?: number | null;
	/** Its name, so the sentence says whom the person joins. */
	agencyName?: string;
	/** Called once the agreement is recorded on the account. */
	onAccepted: () => void;
}

/**
 * Gate 2 of ADR-022 in a self-help group (#1499): the statement of the
 * Beratungsstelle that runs the group, agreed to before the first message.
 *
 * The waiting room asks on "Beitreten" (Frank, 2026-10-16); this gate is the
 * safety net for a way in that skips the waiting room, and appears only
 * while the account has no agreement. Since #1689 it is the same consent
 * panel in the same bar as the waiting room, where the composer would be,
 * instead of a dialog of its own.
 */
export const GroupConsentGate = ({
	agencyId,
	agencyName,
	onAccepted
}: GroupConsentGateProps) => {
	const { t } = useTranslation();
	const groupConsent = useGroupConsent(agencyId);
	const consent = useWaitingRoomConsent({
		consentHtml: groupConsent.html,
		department: groupConsent.department
	});
	const [busy, setBusy] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [declined, setDeclined] = useState(false);
	// `busy` only disables the button after the next render.
	const inFlight = useRef(false);
	const rejectedText = t(
		'groupChat.consent.rejected',
		'Ohne Ihre Zustimmung können Sie in dieser Gruppe nicht schreiben. Sie können jederzeit später zustimmen.'
	);

	const accept = () =>
		consent.guard(() => {
			if (!groupConsent.readable || inFlight.current) return;
			inFlight.current = true;
			setBusy(true);
			setSaveFailed(false);
			setDeclined(false);
			groupConsent
				.record()
				.then(() => onAccepted())
				.catch(() => {
					// Not recorded: the gate stays, and the client is told so.
					setSaveFailed(true);
				})
				.finally(() => {
					inFlight.current = false;
					setBusy(false);
				});
		});

	return (
		<Box
			data-testid="group-consent-gate"
			sx={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-end',
				flex: 1,
				minHeight: '100%',
				px: { xs: 2, sm: 3 }
			}}
		>
			<WaitingRoomBar
				contained
				consent={
					<WaitingRoomConsentPanel
						consent={consent}
						heading={t(
							'groupChat.consent.headline',
							'Bevor Sie schreiben'
						)}
						subtitle={
							agencyName
								? t('groupChat.consent.descriptionNamed', {
										agency: agencyName,
										defaultValue:
											'Diese Gruppe wird von {{agency}} geleitet. Bitte stimmen Sie der Datenschutzerklärung dieser Beratungsstelle zu, bevor Sie in der Gruppe schreiben.'
									})
								: t(
										'groupChat.consent.description',
										'Diese Gruppe wird von einer Beratungsstelle geleitet. Bitte stimmen Sie ihrer Datenschutzerklärung zu, bevor Sie in der Gruppe schreiben.'
									)
						}
						declineLabel={t('groupChat.consent.reject', 'Ablehnen')}
						/* There is no room behind this gate to go back to: the
						   tick is taken back and the reason stays visible. */
						onDecline={() => setDeclined(true)}
						missingText={rejectedText}
						error={
							saveFailed
								? t(
										'groupChat.consent.saveFailed',
										'Ihre Zustimmung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
									)
								: declined && !consent.accepted
									? rejectedText
									: undefined
						}
						errorId="groupConsentGateError"
						disabled={busy}
					/>
				}
				primary={{
					label: t('groupChat.consent.accept', 'Einverstanden'),
					onClick: accept,
					disabled: busy || !groupConsent.readable,
					testId: 'group-consent-accept'
				}}
			/>
		</Box>
	);
};
