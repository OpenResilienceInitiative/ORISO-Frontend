import { Button, BUTTON_TYPES } from '../button/Button';
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
			<Button
				className="caseHandoverInformational__more"
				ariaHasPopup="dialog"
				item={{
					type: BUTTON_TYPES.LINK_INLINE,
					label: t('caseHandover.consent.info.more')
				}}
				buttonHandle={() => setOpen(true)}
			/>
			<CaseHandoverInfoDialog
				open={open}
				mode="NONE"
				onClose={() => setOpen(false)}
				onSetupNotifications={onSetupNotifications}
			/>
		</>
	);
};
