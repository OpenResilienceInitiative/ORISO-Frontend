import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiExtendCaseHandoverCoAccess,
	apiGetCaseHandoverStatus,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { formatAbsoluteTime } from '../notificationsCenter/timelineTime';

/** #200: takes the composer's place for a read-only co-access viewer. */
export const CaseHandoverReadOnlyNotice = ({
	expiresAt,
	sessionId,
	canExtend,
	onStatusChange
}: {
	expiresAt?: string;
	sessionId?: number;
	/** The server lets this viewer extend their co-access right now. */
	canExtend?: boolean;
	onStatusChange?: (status: CaseHandoverStatus) => void;
}) => {
	const { t: translate, i18n } = useTranslation();
	const [extending, setExtending] = useState(false);
	// i18next tags like `de@informal` are not BCP-47; Intl throws on them.
	const until = expiresAt
		? formatAbsoluteTime(expiresAt, (i18n.language || 'de').split('@')[0])
		: '';

	const extend = () => {
		if (!sessionId || !onStatusChange) {
			return;
		}
		setExtending(true);
		apiExtendCaseHandoverCoAccess(sessionId)
			// Refused (it just expired) or failed: the current status closes the
			// curtain or hides the button.
			.catch(() => apiGetCaseHandoverStatus(sessionId))
			.then(onStatusChange)
			.catch(() => {})
			.finally(() => setExtending(false));
	};

	return (
		<div className="session__pseudonymActionBarSlot">
			<div
				className="session__readOnlyNote"
				role="status"
				data-cy="case-handover-read-only-notice"
			>
				{until
					? translate('caseHandover.readOnly.noticeUntil', { until })
					: translate('caseHandover.readOnly.notice')}
			</div>
			{canExtend && sessionId && onStatusChange && (
				<button
					type="button"
					className="session__readOnlyExtend"
					onClick={extend}
					disabled={extending}
					data-cy="case-handover-extend"
				>
					{translate('caseHandover.readOnly.extend')}
				</button>
			)}
		</div>
	);
};
