import * as React from 'react';
import { useTranslation } from 'react-i18next';
import './HistoryRequestCard.styles.scss';

export interface HistoryRequestCardProps {
	/** What the person wrote about the conversation. */
	reason: string;
	/** Who asks, from which device, and when: shown so the counsellor can check. */
	requesterUserId?: string;
	requesterDeviceId?: string;
	receivedAt?: number;
	busy?: boolean;
	failed?: boolean;
	onApprove: () => void;
	onDecline: () => void;
}

/**
 * A person on a new device asks to read this conversation again. The
 * counsellor reads the text and decides; the keys of this one conversation
 * only go out after "Release".
 */
export const HistoryRequestCard: React.FC<HistoryRequestCardProps> = ({
	reason,
	requesterUserId,
	requesterDeviceId,
	receivedAt,
	busy = false,
	failed = false,
	onApprove,
	onDecline
}) => {
	const { t, i18n } = useTranslation();
	return (
		<section
			className="historyRequestCard"
			aria-label={t('historyRequest.card.title')}
		>
			<h3 className="historyRequestCard__title">
				{t('historyRequest.card.title')}
			</h3>
			{requesterUserId && (
				<p className="historyRequestCard__origin">
					{t('historyRequest.card.origin', {
						user: requesterUserId,
						device: requesterDeviceId ?? '',
						time: receivedAt
							? new Date(receivedAt).toLocaleString(
									i18n?.language
								)
							: ''
					})}
				</p>
			)}
			<p className="historyRequestCard__intro">
				{t('historyRequest.card.intro')}
			</p>
			<blockquote className="historyRequestCard__reason">
				{reason}
			</blockquote>
			{failed && (
				<p role="alert" className="historyRequestCard__failed">
					{t('historyRequest.card.failed')}
				</p>
			)}
			<div className="historyRequestCard__actions">
				<button
					type="button"
					className="historyRequestCard__decline"
					disabled={busy}
					onClick={onDecline}
				>
					{t('historyRequest.card.decline')}
				</button>
				<button
					type="button"
					className="historyRequestCard__approve"
					disabled={busy}
					onClick={onApprove}
				>
					{t('historyRequest.card.approve')}
				</button>
			</div>
		</section>
	);
};
