import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LeaveQueueDialog.styles.scss';

export interface LeaveQueueDialogProps {
	open: boolean;
	/**
	 * Whether a counsellor has already accepted the conversation. When they
	 * have not, "start chat now" is rendered disabled rather than removed —
	 * house rule: disable, never hide, so the asker can see the option exists
	 * and is simply not available yet.
	 */
	canStartChat: boolean;
	/** Dismiss and stay in the queue. */
	onStay: () => void;
	/** Leave the waiting screen and open the conversation. */
	onStartChat: () => void;
	/** End the conversation and give up the anonymous access. */
	onDeleteAccess: () => void;
	/** `true` while one of the actions is in flight. */
	busy?: boolean;
	/**
	 * Set when ending the conversation failed. Surfaced as a live alert and
	 * the confirmation stays reachable, so the asker can retry — swallowing
	 * the failure would leave them believing they had left while the account
	 * is still live.
	 */
	errorMessage?: string;
}

/** Door-with-arrow glyph — the hero icon every ORISO dialog carries. */
const LeaveIcon: React.FC = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M5 21q-.825 0-1.412-.587Q3 19.825 3 19V5q0-.825.588-1.413Q4.175 3 5 3h7v2H5v14h7v2Zm11-4-1.375-1.45 2.55-2.55H9v-2h8.175l-2.55-2.55L16 7l5 5Z"
			fill="#1C1B1F"
		/>
	</svg>
);

/**
 * The way out of the live-chat waiting queue.
 *
 * Until this existed, an advice seeker waiting for a counsellor could neither
 * leave the queue nor give up the anonymous account they had just created —
 * the only exit was abandoning the tab, which leaves the account behind.
 *
 * Three choices, per the CAR02 design (2183-15203):
 *
 *   - stay in the queue
 *   - start the chat now, once somebody has accepted
 *   - end the chat and give up the access
 *
 * The third one is irreversible for an anonymous account — there is no e-mail
 * address and no password recovery — so it takes a deliberate second step
 * rather than a single tap.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#893.
 */
export const LeaveQueueDialog: React.FC<LeaveQueueDialogProps> = ({
	open,
	canStartChat,
	onStay,
	onStartChat,
	onDeleteAccess,
	busy = false,
	errorMessage
}) => {
	const { t } = useTranslation();
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	// Reopening the dialog must never land straight on the confirmation step.
	useEffect(() => {
		if (!open) {
			setConfirmingDelete(false);
		}
	}, [open]);

	if (!open) {
		return null;
	}

	return (
		<div
			className="leaveQueueDialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="leaveQueueDialogTitle"
		>
			<div className="leaveQueueDialog__card">
				<div className="leaveQueueDialog__header">
					<span className="leaveQueueDialog__icon" aria-hidden="true">
						<LeaveIcon />
					</span>
					<h2
						className="leaveQueueDialog__title"
						id="leaveQueueDialogTitle"
					>
						{t('anonymousChat.leaveQueue.headline', 'Chat verlassen?')}
					</h2>
				</div>

				<p className="leaveQueueDialog__body">
					{canStartChat
						? t(
								'anonymousChat.leaveQueue.bodyAccepted',
								'Eine beratende Person wartet bereits auf Sie. Sie können den Chat jetzt starten, im Wartebereich bleiben oder Ihren Zugang löschen.'
							)
						: t(
								'anonymousChat.leaveQueue.body',
								'Sie sind noch im Wartebereich. Sie können weiter warten oder Ihren Zugang löschen — dann wird dieser Chat beendet.'
							)}
				</p>

				{confirmingDelete ? (
					<>
						<p
							className="leaveQueueDialog__warning"
							role="status"
						>
							{t(
								'anonymousChat.leaveQueue.deleteWarning',
								'Ihr Zugang wird deaktiviert und dieser Chat beendet. Sie können sich mit diesem Namen und Passwort nicht mehr anmelden, und wir können den Zugang nicht wiederherstellen.'
							)}
						</p>
						<div className="leaveQueueDialog__actions leaveQueueDialog__actions--confirm">
							<button
								type="button"
								className="leaveQueueDialog__btnSecondary"
								onClick={() => setConfirmingDelete(false)}
								disabled={busy}
							>
								{t(
									'anonymousChat.leaveQueue.cancelDelete',
									'Abbrechen'
								)}
							</button>
							<button
								type="button"
								className="leaveQueueDialog__btnDanger"
								onClick={onDeleteAccess}
								disabled={busy}
							>
								{t(
									'anonymousChat.leaveQueue.confirmDelete',
									'Ja, endgültig löschen'
								)}
							</button>
						</div>
					</>
				) : (
					<div className="leaveQueueDialog__actions">
						<button
							type="button"
							className="leaveQueueDialog__btnSecondary"
							onClick={onStay}
							disabled={busy}
						>
							{t(
								'anonymousChat.leaveQueue.stay',
								'Im Wartebereich bleiben'
							)}
						</button>
						<button
							type="button"
							className="leaveQueueDialog__btnPrimary"
							onClick={onStartChat}
							disabled={busy || !canStartChat}
							title={
								canStartChat
									? undefined
									: t(
											'anonymousChat.leaveQueue.startChatUnavailable',
											'Sobald eine beratende Person den Chat annimmt, können Sie hier starten.'
										)
							}
						>
							{t(
								'anonymousChat.leaveQueue.startChat',
								'Chat jetzt starten'
							)}
						</button>
						<button
							type="button"
							className="leaveQueueDialog__btnDangerQuiet"
							onClick={() => setConfirmingDelete(true)}
							disabled={busy}
						>
							{t(
								'anonymousChat.leaveQueue.delete',
								'Chat beenden & Zugang löschen'
							)}
						</button>
					</div>
				)}

				{errorMessage && (
					<p className="leaveQueueDialog__error" role="alert">
						{errorMessage}
					</p>
				)}

				{!canStartChat && !confirmingDelete && (
					<p className="leaveQueueDialog__hint">
						{t(
							'anonymousChat.leaveQueue.startChatUnavailable',
							'Sobald eine beratende Person den Chat annimmt, können Sie hier starten.'
						)}
					</p>
				)}
			</div>
		</div>
	);
};
