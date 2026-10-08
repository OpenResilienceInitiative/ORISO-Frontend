import * as React from 'react';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaseHandoverInfoDialog } from './CaseHandoverClientCards';

/** Body inside the persisted grant's existing bubble. No request controls or automatic invitation. */
export const CaseHandoverInformationalBody = ({
	description,
	sessionId,
	onSetupNotifications
}: {
	description: string;
	sessionId: number;
	onSetupNotifications?: () => void;
}) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	useLayoutEffect(() => {
		setOpen(false);
	}, [sessionId]);
	return (
		<>
			<p className="messageItem__systemNotificationDescription">
				{description}
			</p>
			<button
				type="button"
				className="caseHandoverMessage__more"
				aria-haspopup="dialog"
				onClick={() => setOpen(true)}
			>
				{t('caseHandover.consent.info.more')}
			</button>
			<CaseHandoverInfoDialog
				open={open}
				mode="NONE"
				onClose={() => setOpen(false)}
				onSetupNotifications={onSetupNotifications}
			/>
		</>
	);
};
