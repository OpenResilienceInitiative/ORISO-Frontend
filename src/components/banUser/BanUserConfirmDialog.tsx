import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';

interface BanUserConfirmDialogProps {
	/** The member as the counsellor sees them; `null` keeps the dialog closed. */
	name: string | null;
	onCancel: () => void;
	onConfirm: () => void;
}

/** Asks before a counsellor removes (bans) a member from a group (#1923). */
export const BanUserConfirmDialog = ({
	name,
	onCancel,
	onConfirm
}: BanUserConfirmDialogProps) => {
	const { t: translate } = useTranslation();

	if (name === null) {
		return null;
	}

	return (
		<M3Dialog
			title={translate('banUser.confirm.title', { name })}
			description={translate('banUser.confirm.description')}
			severity="error"
			width={420}
			closeLabel={translate('app.close')}
			onClose={onCancel}
			actions={[
				{
					label: translate('app.cancel'),
					onClick: onCancel,
					testId: 'ban-user-confirm-cancel'
				},
				{
					label: translate('banUser.confirm.submit'),
					onClick: onConfirm,
					primary: true,
					testId: 'ban-user-confirm-submit'
				}
			]}
			data-testid="ban-user-confirm-dialog"
		/>
	);
};
