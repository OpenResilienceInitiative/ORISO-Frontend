import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import {
	DepartmentConsentState,
	resolveEntryRoomConsent
} from '../../anonymousChat/entryRoom/entryRoomConsent';
import { useGroupDepartment } from './useGroupDepartment';

const PLATFORM_SENTENCE =
	'Ich habe die {{legal_links}} zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Webseite Cookies. Damit erkläre ich mich einverstanden.';
const MISSING_POLICY_SENTENCE =
	'Für diese Beratungsstelle ist derzeit keine eigene Datenschutzerklärung hinterlegt. Wenn Sie fortfahren, nutzen Sie das Angebot auf eigenes Risiko. Mit dem Aktivieren des Kontrollkästchens stimmen Sie den {{legal_links}} dieser Website zu. Diese Website verwendet Cookies.';

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
	const { t, i18n } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);
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

	const legalLinksHtml = useMemo(
		() =>
			renderToString(
				<LegalLinks
					legalLinks={legalLinks}
					filter={(link) => link.registration}
					params={{ aid: agencyId ?? null }}
					delimiter={', '}
				/>
			),
		[legalLinks, agencyId]
	);

	const consent = resolveEntryRoomConsent({
		hasDepartment: departmentState.status === 'loading' || !!department,
		department: departmentConsent,
		platformHtml: t('anonymousConsent.label.text', {
			defaultValue: PLATFORM_SENTENCE,
			interpolation: { escapeValue: false },
			legal_links: legalLinksHtml
		}),
		missingPolicyHtml: t('anonymousConsent.label.missingPolicy', {
			defaultValue: MISSING_POLICY_SENTENCE,
			interpolation: { escapeValue: false },
			legal_links: legalLinksHtml
		}),
		legalLinksHtml,
		locale: i18n?.language || 'de'
	});

	/** Records the agreement on the account, as the live chat records it. */
	const record = useCallback(
		() =>
			apiPatchUserData({
				dataPrivacyConfirmation: true,
				termsAndConditionsConfirmation: true
			}),
		[]
	);

	return { ...consent, department, record };
};
