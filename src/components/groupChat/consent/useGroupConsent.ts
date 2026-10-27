import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { apiGetUserData } from '../../../api/apiGetUserData';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import {
	DepartmentConsentState,
	resolveEntryRoomConsent
} from '../../anonymousChat/entryRoom/entryRoomConsent';
import { useGroupDepartment } from './useGroupDepartment';
import { useConsentSentences } from '../../waitingRoom/useConsentSentences';

/**
 * Gate 2 of ADR-022 for a self-help group (#1499): which sentence the client
 * agrees to, and recording the agreement on the account. Shared by the
 * waiting room, where the agreement is asked on "Beitreten" (Frank,
 * 2026-10-16), and `GroupConsentGate`, which asks in the chat only when the
 * account has none yet.
 *
 * The same sentence rules as the live chat (`resolveEntryRoomConsent`): the
 * department's own wording when it has one, the fixed warning when it has
 * none, the platform sentence when the group's department cannot be told.
 */
export const useGroupConsent = (agencyId?: number | null) => {
	const { i18n } = useTranslation();
	const userDataContext = useContext(UserDataContext);
	const departmentState = useGroupDepartment(agencyId);
	const department =
		departmentState.status === 'ready' ? departmentState.department : null;
	/* Keyed to its department: another group's statement never stands in
	   while this one's is still loading. */
	const [answeredConsent, setAnsweredConsent] = useState<{
		key: string;
		state: DepartmentConsentState;
	} | null>(null);
	const departmentKey = department
		? `${department.agencyId}:${department.topicId}`
		: null;
	const departmentConsent: DepartmentConsentState =
		answeredConsent && answeredConsent.key === departmentKey
			? answeredConsent.state
			: { status: 'idle' };

	useEffect(() => {
		if (!department || !departmentKey) return undefined;
		let cancelled = false;
		apiGetConsentText(department.agencyId, department.topicId)
			.then((result) => {
				if (cancelled) return;
				setAnsweredConsent({
					key: departmentKey,
					state:
						result.status === 'ok'
							? {
									status: 'ok',
									sentence:
										result.consentText?.sentence ?? null,
									versionId:
										result.consentText?.versionId ?? null
								}
							: { status: 'unavailable' }
				});
			})
			.catch(() => {
				if (!cancelled) {
					setAnsweredConsent({
						key: departmentKey,
						state: { status: 'unavailable' }
					});
				}
			});
		return () => {
			cancelled = true;
		};
		// The key stands for the department; its object identity may change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [departmentKey]);

	const { legalLinksHtml, platformHtml, missingPolicyHtml } =
		useConsentSentences(agencyId);

	const consent = resolveEntryRoomConsent({
		hasDepartment: departmentState.status === 'loading' || !!department,
		department: departmentConsent,
		platformHtml,
		missingPolicyHtml,
		legalLinksHtml,
		locale: i18n?.language || 'de'
	});

	/**
	 * Records the agreement on the account, as the live chat records it. The
	 * chat asks again while the account in memory shows none, so it is marked
	 * there at once and reloaded behind; the reload never holds the person
	 * back.
	 */
	const record = useCallback(
		() =>
			apiPatchUserData({
				dataPrivacyConfirmation: true,
				termsAndConditionsConfirmation: true
			}).then(() => {
				if (!userDataContext?.userData) return;
				const now = new Date().toISOString();
				userDataContext.setUserData({
					...userDataContext.userData,
					dataPrivacyConfirmation: now,
					termsAndConditionsConfirmation: now
				});
				apiGetUserData()
					.then((fresh) => userDataContext.setUserData(fresh))
					.catch(() => undefined);
			}),
		[userDataContext]
	);

	return { ...consent, department, record };
};
