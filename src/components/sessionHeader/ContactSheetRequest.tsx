import * as React from 'react';
import { useState } from 'react';
import { ReactComponent as EnvelopeIcon } from '../../resources/img/icons/envelope.svg';
import {
	ChatMenuDropdownItem,
	ChatMenuDropdownNote
} from '../chatMenuDropdown/ChatMenuDropdown';
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
		<>
			<ChatMenuDropdownItem
				icon={<EnvelopeIcon aria-hidden="true" focusable="false" />}
				title={
					pending
						? t('contactSheet.sending')
						: t('contactSheet.request')
				}
				disabled={!recipient || pending}
				onClick={request}
			/>
			<ChatMenuDropdownNote>
				{recipient
					? t('contactSheet.recipient', { email: recipient })
					: t('contactSheet.missingEmail')}
			</ChatMenuDropdownNote>
			{(pending || result) && (
				<div role={result === 'failed' ? 'alert' : 'status'}>
					<ChatMenuDropdownNote>
						{pending
							? t('contactSheet.sending')
							: t(`contactSheet.${result}`, { email: recipient })}
					</ChatMenuDropdownNote>
				</div>
			)}
		</>
	);
};
