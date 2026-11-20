import * as React from 'react';
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface NoPrivacyNoticeDialogProps {
	open: boolean;
	onContinue: () => void;
	onCancel: () => void;
}

/**
 * Shown when someone ticks the consent box of a centre that has not stored a
 * privacy notice at any level. A warning, not a gate: the person may continue
 * knowingly. It states only that nothing is stored and who is responsible —
 * never that a stored text is legally correct (ORISO-AgencyService#366).
 */
export const NoPrivacyNoticeDialog = ({
	open,
	onContinue,
	onCancel
}: NoPrivacyNoticeDialogProps) => {
	const { t } = useTranslation();
	return (
		<Dialog
			open={open}
			onClose={onCancel}
			aria-labelledby="no-privacy-notice-title"
			aria-describedby="no-privacy-notice-body"
			data-cy="no-privacy-notice-dialog"
		>
			<DialogTitle id="no-privacy-notice-title">
				{t('registration.dataProtection.noNotice.title')}
			</DialogTitle>
			<DialogContent>
				<DialogContentText id="no-privacy-notice-body">
					{t('registration.dataProtection.noNotice.body')}
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={onCancel} data-cy="no-privacy-notice-cancel">
					{t('registration.dataProtection.noNotice.cancel')}
				</Button>
				<Button
					onClick={onContinue}
					variant="contained"
					data-cy="no-privacy-notice-continue"
				>
					{t('registration.dataProtection.noNotice.continue')}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
