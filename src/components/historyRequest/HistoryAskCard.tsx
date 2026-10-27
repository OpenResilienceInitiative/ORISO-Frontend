import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matrixRoomHistoryKeyTransfer } from '../../services/matrixRoomHistoryKeyTransfer';
import { HistoryAskDialog } from './HistoryAskDialog';
import './HistoryRequestCard.styles.scss';

type AskState = 'idle' | 'sending' | 'failed' | 'waiting' | 'done';

export interface HistoryAskCardProps {
	roomId: string;
	/**
	 * Whether this conversation still holds events that cannot be read. After a
	 * request, readable history is what ends the wait, not the arrival of keys:
	 * a bundle may unlock only part of it.
	 */
	unreadable?: boolean;
	/** Test seam: how the request is sent. Defaults to the key-transfer service. */
	send?: (roomId: string, reason: string) => Promise<boolean>;
	initialState?: AskState;
	initialOpen?: boolean;
}

const defaultSend = (roomId: string, reason: string) =>
	matrixRoomHistoryKeyTransfer.requestKeys(roomId, { reason });

/**
 * Shown to a person who cannot read the earlier messages of this conversation
 * on this device. They can ask their counsellor to release the keys.
 */
export const HistoryAskCard: React.FC<HistoryAskCardProps> = ({
	roomId,
	unreadable = true,
	send = defaultSend,
	initialState = 'idle',
	initialOpen = false
}) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(initialOpen);
	const [state, setState] = useState<AskState>(initialState);

	// A request that was sent and is answered by readable history is done.
	const done = state === 'done' || (state === 'waiting' && !unreadable);
	// Nothing to ask for, nothing to report.
	if (!unreadable && !done) return null;

	const submit = (reason: string) => {
		setState('sending');
		void send(roomId, reason)
			.then((sent) => {
				setState(sent ? 'waiting' : 'failed');
				if (sent) setOpen(false);
			})
			.catch(() => setState('failed'));
	};

	return (
		<>
			<section
				className="historyRequestCard"
				aria-label={t('historyRequest.ask.title')}
			>
				<h3 className="historyRequestCard__title">
					{t('historyRequest.ask.title')}
				</h3>
				<p className="historyRequestCard__intro" role="status">
					{done
						? t('historyRequest.ask.done')
						: state === 'waiting'
							? t('historyRequest.ask.waiting')
							: t('historyRequest.ask.intro')}
				</p>
				{!done && state !== 'sending' && (
					<div className="historyRequestCard__actions">
						<button
							type="button"
							className="historyRequestCard__approve"
							data-testid="history-ask-open"
							onClick={() => setOpen(true)}
						>
							{t('historyRequest.ask.button')}
						</button>
					</div>
				)}
			</section>
			{open && !done && (
				<HistoryAskDialog
					busy={state === 'sending'}
					failed={state === 'failed'}
					onClose={() => setOpen(false)}
					onSend={submit}
				/>
			)}
		</>
	);
};
