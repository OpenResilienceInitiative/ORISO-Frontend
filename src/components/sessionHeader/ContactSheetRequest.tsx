import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequestContactSheetEmail } from '../../api/apiRequestContactSheetEmail';

interface ContactSheetRequestProps {
	sessionId: number;
	email?: string;
}

export const ContactSheetRequest = ({
	sessionId,
	email
}: ContactSheetRequestProps) => {
	const { t } = useTranslation();
	const [pending, setPending] = useState(false);
	const [result, setResult] = useState<'sent' | 'failed' | null>(null);
	const recipient = email?.trim();

	const request = async () => {
		if (!recipient || pending) return;
		setPending(true);
		setResult(null);
		try {
			await apiRequestContactSheetEmail(sessionId);
			setResult('sent');
		} catch {
			setResult('failed');
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="sessionInfo__contactSheetRequest">
			<button
				type="button"
				disabled={!recipient || pending}
				onClick={request}
			>
				{pending
					? t('contactSheet.sending')
					: t('contactSheet.request')}
			</button>
			{recipient ? (
				<small>
					{t('contactSheet.recipient', { email: recipient })}
				</small>
			) : (
				<small>{t('contactSheet.missingEmail')}</small>
			)}
			{result && (
				<p role={result === 'sent' ? 'status' : 'alert'}>
					{t(`contactSheet.${result}`, { email: recipient })}
				</p>
			)}
		</div>
	);
};
