import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PhoneIcon } from '../../resources/img/icons/call.svg';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';

interface SessionListItemRunningCallProps {
	call: CallLifecycleMessage;
}

/**
 * Call design S10 (5c): "Läuft gerade — 4 Teilnehmende" in place of the
 * last message, so a running call is seen from the list. Opening the
 * conversation, as for any row, leads to the call card and the device check.
 */
export const SessionListItemRunningCall = ({
	call
}: SessionListItemRunningCallProps) => {
	const { t } = useTranslation();
	const count = call.present?.length ?? 0;
	return (
		<div
			className="sessionsListItem__subject sessionsListItem__runningCall"
			data-testid="session-list-running-call"
		>
			<PhoneIcon
				aria-hidden="true"
				className="sessionsListItem__runningCallIcon"
			/>
			{count > 0
				? t('calls.list.runningWithCount', { count })
				: t('calls.list.running')}
		</div>
	);
};
