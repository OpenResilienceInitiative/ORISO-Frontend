import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextarea } from '../form/OrisoTextarea';

export const HISTORY_ASK_MAX_LENGTH = 500;

export interface HistoryAskDialogProps {
	busy?: boolean;
	/** The request could not be sent; the text stays so nothing is retyped. */
	failed?: boolean;
	onClose: () => void;
	onSend: (reason: string) => void;
}

/**
 * The person describes what was in the conversation, so the counsellor can
 * recognise it before releasing the keys. The text is required.
 */
export const HistoryAskDialog: React.FC<HistoryAskDialogProps> = ({
	busy = false,
	failed = false,
	onClose,
	onSend
}) => {
	const { t } = useTranslation();
	const [reason, setReason] = useState('');
	const trimmed = reason.trim();
	return (
		<M3Dialog
			open
			onClose={onClose}
			closeLabel={t('app.close')}
			title={t('historyRequest.ask.dialog.title')}
			description={t('historyRequest.ask.dialog.description')}
			actions={[
				{
					label: t('historyRequest.ask.dialog.cancel'),
					onClick: onClose
				},
				{
					label: t('historyRequest.ask.dialog.send'),
					onClick: () => onSend(trimmed),
					disabled: busy || trimmed.length === 0,
					primary: true,
					testId: 'history-ask-send'
				}
			]}
		>
			<OrisoTextarea
				id="historyAskReason"
				name="reason"
				autoFocus
				fullWidth
				label={t('historyRequest.ask.dialog.label')}
				value={reason}
				onChange={(event) =>
					setReason(
						event.target.value.slice(0, HISTORY_ASK_MAX_LENGTH)
					)
				}
				inputProps={{ maxLength: HISTORY_ASK_MAX_LENGTH }}
				helperText={`${reason.length}/${HISTORY_ASK_MAX_LENGTH}`}
			/>
			{failed && (
				<p role="alert" className="historyAsk__failed">
					{t('historyRequest.ask.failed')}
				</p>
			)}
		</M3Dialog>
	);
};
