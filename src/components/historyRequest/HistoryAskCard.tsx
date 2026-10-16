import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
	matrixRoomHistoryKeyTransfer
} from '../../services/matrixRoomHistoryKeyTransfer';
import { HistoryAskDialog } from './HistoryAskDialog';
import './HistoryRequestCard.styles.scss';

type AskState = 'idle' | 'sending' | 'failed' | 'waiting' | 'done';

export interface HistoryAskCardProps {
	roomId: string;
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
	send = defaultSend,
	initialState = 'idle',
	initialOpen = false
}) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(initialOpen);
	const [state, setState] = useState<AskState>(initialState);

	useEffect(() => {
		const onImported = (event: Event) => {
			if ((event as CustomEvent).detail?.roomId === roomId)
				setState('done');
		};
		window.addEventListener(MATRIX_HISTORY_KEYS_IMPORTED_EVENT, onImported);
		return () =>
			window.removeEventListener(
				MATRIX_HISTORY_KEYS_IMPORTED_EVENT,
				onImported
			);
	}, [roomId]);

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
					{state === 'waiting'
						? t('historyRequest.ask.waiting')
						: state === 'done'
							? t('historyRequest.ask.done')
							: t('historyRequest.ask.intro')}
				</p>
				{(state === 'idle' || state === 'failed') && (
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
			{open && state !== 'done' && (
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
