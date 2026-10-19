import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatAbsoluteTime } from '../notificationsCenter/timelineTime';

/** #200: takes the composer's place for a read-only co-access viewer. */
export const CaseHandoverReadOnlyNotice = ({
	expiresAt
}: {
	expiresAt?: string;
}) => {
	const { t: translate, i18n } = useTranslation();
	// i18next tags like `de@informal` are not BCP-47; Intl throws on them.
	const until = expiresAt
		? formatAbsoluteTime(expiresAt, (i18n.language || 'de').split('@')[0])
		: '';

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
		</div>
	);
};
