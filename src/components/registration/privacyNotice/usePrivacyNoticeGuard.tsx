import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getCachedDepartmentLegalOutcome } from '../../../api/apiGetDepartmentLegal';
import { isPrivacyNoticeMissing } from './hasStoredPrivacyNotice';
import { NoPrivacyNoticeDialog } from './NoPrivacyNoticeDialog';

/**
 * Wraps the "I agree" toggle of a consent checkbox. When the selected centre
 * has no stored privacy notice, ticking the box first opens a warning dialog
 * and only ticks on "continue". Unticking, and every centre with a stored
 * text (or an unknown answer), toggles straight away.
 *
 * Shares the department-legal cache with the consent label, so it adds no
 * request of its own.
 */
export const usePrivacyNoticeGuard = (
	agencyId?: number | null,
	topicId?: number | null
) => {
	const [missing, setMissing] = useState(false);
	const [pendingToggle, setPendingToggle] = useState<(() => void) | null>(
		null
	);

	useEffect(() => {
		setMissing(false);
		if (agencyId == null || topicId == null) {
			return;
		}
		let cancelled = false;
		getCachedDepartmentLegalOutcome(agencyId, topicId).then((outcome) => {
			if (!cancelled) {
				setMissing(
					outcome.status === 'ok' &&
						isPrivacyNoticeMissing(outcome.data)
				);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [agencyId, topicId]);

	const guardToggle = useCallback(
		(toggle: () => void, currentlyAccepted: boolean) => {
			if (currentlyAccepted || !missing) {
				toggle();
				return;
			}
			setPendingToggle(() => toggle);
		},
		[missing]
	);

	const dialog = (
		<NoPrivacyNoticeDialog
			open={pendingToggle !== null}
			onCancel={() => setPendingToggle(null)}
			onContinue={() => {
				pendingToggle?.();
				setPendingToggle(null);
			}}
		/>
	);

	return { missing, guardToggle, dialog };
};
