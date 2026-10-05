import * as React from 'react';
import './groupConsentGate.styles.scss';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@mui/material';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { GdprIcon } from '../../../resources/img/icons';
import { sanitizeConsentHtml } from '../../legalContent/legalHtmlSanitizer';
import htmlParser from '../../../resources/scripts/util/htmlParser';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import {
	DepartmentConsentState,
	resolveEntryRoomConsent
} from '../../anonymousChat/entryRoom/entryRoomConsent';
import { useGroupDepartment } from './useGroupDepartment';

export interface GroupConsentGateProps {
	/** The Beratungsstelle that runs the group. */
	agencyId?: number | null;
	/** Called once the agreement is recorded on the account. */
	onAccepted: () => void;
}

const PLATFORM_SENTENCE =
	'Ich habe die {{legal_links}} zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Webseite Cookies. Damit erkläre ich mich einverstanden.';
const MISSING_POLICY_SENTENCE =
	'Für diese Beratungsstelle ist derzeit keine eigene Datenschutzerklärung hinterlegt. Wenn Sie fortfahren, nutzen Sie das Angebot auf eigenes Risiko. Mit dem Aktivieren des Kontrollkästchens stimmen Sie den {{legal_links}} dieser Website zu. Diese Website verwendet Cookies.';

/**
 * Gate 2 of ADR-022 in a self-help group (#1499): the statement of the
 * Beratungsstelle that runs the group, agreed to before the first message.
 *
 * The same dialog and the same sentence rules as the live chat's gate
 * (`resolveEntryRoomConsent`): the department's own wording when it has one,
 * the fixed warning when it has none, the platform sentence when the group's
 * department cannot be told. The agreement is recorded on the account, as the
 * live chat records it; a group has no session to pin a version to.
 */
export const GroupConsentGate = ({
	agencyId,
	onAccepted
}: GroupConsentGateProps) => {
	const { t, i18n } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);
	const departmentState = useGroupDepartment(agencyId);
	const department =
		departmentState.status === 'ready' ? departmentState.department : null;
	const [departmentConsent, setDepartmentConsent] =
		useState<DepartmentConsentState>({ status: 'idle' });
	const [busy, setBusy] = useState(false);
	const [rejected, setRejected] = useState(false);
	const phone = useMediaQuery('(max-width:599px)');

	useEffect(() => {
		if (!department) return undefined;
		let cancelled = false;
		apiGetConsentText(department.agencyId, department.topicId)
			.then((result) => {
				if (cancelled) return;
				setDepartmentConsent(
					result.status === 'ok'
						? {
								status: 'ok',
								sentence: result.consentText?.sentence ?? null,
								versionId: result.consentText?.versionId ?? null
							}
						: { status: 'unavailable' }
				);
			})
			.catch(() => {
				if (!cancelled) setDepartmentConsent({ status: 'unavailable' });
			});
		return () => {
			cancelled = true;
		};
	}, [department]);

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

	const handleAccept = useCallback(() => {
		if (busy || !consent.readable) return;
		setBusy(true);
		apiPatchUserData({
			dataPrivacyConfirmation: true,
			termsAndConditionsConfirmation: true
		})
			.then(() => onAccepted())
			.catch(() => setBusy(false));
	}, [busy, consent.readable, onAccepted]);

	/* The sentence becomes Träger-authored text (ADR-021 decision 4), so it
	   goes through the shared consent sanitizer, never into a raw sink. */
	const sentence = useMemo(
		() => htmlParser(sanitizeConsentHtml(consent.html)),
		[consent.html]
	);

	/* The house M3 dialog (icon, title, supporting text, text actions), full
	   screen on a phone like the group's share dialog. No close: agreeing is
	   the way into the group, and "Ablehnen" says so instead of hiding it. */
	return (
		<M3Dialog
			open
			onClose={() => undefined}
			closable={false}
			fullScreen={phone}
			width={560}
			icon={<GdprIcon />}
			title={t('groupChat.consent.headline', 'Bevor Sie schreiben')}
			description={t(
				'groupChat.consent.description',
				'Diese Gruppe wird von einer Beratungsstelle geleitet. Bitte stimmen Sie ihrer Datenschutzerklärung zu, bevor Sie in der Gruppe schreiben.'
			)}
			className="groupConsentGate"
			data-testid="group-consent-gate"
			actions={[
				{
					label: t('groupChat.consent.reject', 'Ablehnen'),
					onClick: () => setRejected(true),
					disabled: busy,
					testId: 'group-consent-reject'
				},
				{
					label: t('groupChat.consent.accept', 'Einverstanden'),
					onClick: handleAccept,
					primary: true,
					disabled: busy || !consent.readable,
					testId: 'group-consent-accept'
				}
			]}
		>
			<p className="groupConsentGate__sentence">{sentence}</p>
			{rejected && (
				<p className="groupConsentGate__rejected" role="alert">
					{t(
						'groupChat.consent.rejected',
						'Ohne Ihre Zustimmung können Sie in dieser Gruppe nicht schreiben. Sie können jederzeit später zustimmen.'
					)}
				</p>
			)}
		</M3Dialog>
	);
};
