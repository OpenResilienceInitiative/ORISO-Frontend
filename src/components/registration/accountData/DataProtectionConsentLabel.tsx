import * as React from 'react';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import {
	apiGetConsentText,
	ConsentTextData
} from '../../../api/apiGetConsentText';
import { getDepartmentForTopic } from '../../departmentLegal/getDepartmentForTopic';
import { ConsentSentence } from './ConsentSentence';

/**
 * Whether the selected Fachbereich *could* carry a Träger-authored consent
 * text. The sentence is a field of the department's data-protection policy
 * (ADR-021 decision 4), so a department without a published policy cannot have
 * one — which is decidable from data the registration already holds, with no
 * request and therefore no waiting.
 *
 * Exported because `AccountData` needs the same answer on its very first
 * render to decide whether the consent checkbox starts enabled. Without that,
 * the far more common unconfigured case would flicker through a disabled
 * state it has no reason to be in.
 */
export const departmentMayHaveConsentText = (
	agency?: AgencyDataInterface,
	topic?: TopicsDataInterface
): boolean =>
	getDepartmentForTopic(agency, topic)?.hasPublishedDpp === true &&
	!!agency?.id &&
	!!topic?.id;

/**
 * Whether the sentence a help-seeker is asked to agree to is known yet.
 *
 * `pending` is not a cosmetic loading state: while it holds, there is no
 * wording on screen, and consent to wording nobody has seen is not consent.
 * Everything that can record agreement has to be inert until this resolves.
 */
export type ConsentResolution =
	| { status: 'pending' }
	| { status: 'resolved'; consentText: ConsentTextData | null };

export interface DataProtectionConsentLabelProps {
	agency?: AgencyDataInterface;
	topic?: TopicsDataInterface;
	/**
	 * Reports the resolution so the owner of the checkbox can keep it disabled
	 * until there is a sentence next to it, and can bind an acceptance to the
	 * exact wording that was accepted. Must be referentially stable — a
	 * `useState` setter is.
	 */
	onResolutionChange?: (resolution: ConsentResolution) => void;
}

/**
 * Resolves which consent sentence belongs next to the data-protection checkbox
 * at registration, and hands it to `ConsentSentence` to render.
 *
 * Which shape applies is a property of the selected Fachbereich
 * (Beratungsstelle x Thema), not of the component: a Fachbereich with a
 * published data-protection policy may carry a Träger-authored consent text
 * (ADR-021 decision 4), anything else falls back to today's static sentence.
 */
export const DataProtectionConsentLabel: FC<
	DataProtectionConsentLabelProps
> = ({ agency, topic, onResolutionChange }) => {
	const { t } = useTranslation();
	const mayHaveConsentText = departmentMayHaveConsentText(agency, topic);

	/* Starts resolved in the unconfigured case, so that path issues no request,
	   shows today's sentence immediately and never disables anything. */
	const [resolution, setResolution] = useState<ConsentResolution>(() =>
		mayHaveConsentText
			? { status: 'pending' }
			: { status: 'resolved', consentText: null }
	);

	useEffect(() => {
		onResolutionChange?.(resolution);
	}, [resolution, onResolutionChange]);

	useEffect(() => {
		if (!mayHaveConsentText) {
			setResolution({ status: 'resolved', consentText: null });
			return;
		}

		const abortController = new AbortController();
		setResolution({ status: 'pending' });
		apiGetConsentText(agency.id, topic.id, abortController.signal).then(
			(consentText) => {
				if (!abortController.signal.aborted) {
					setResolution({ status: 'resolved', consentText });
				}
			}
		);
		return () => abortController.abort();
	}, [mayHaveConsentText, agency?.id, topic?.id]);

	/* A configured Fachbereich is still being fetched: never the platform
	   wording, which would mean the checkbox briefly carries a sentence that is
	   not the one in force. But not nothing either — disabling a control does
	   not remove it from the accessibility tree, so rendering nothing left a
	   screen-reader user on an unnamed checkbox with no hint that anything was
	   happening. A loading notice is safe here precisely because it is not a
	   consent sentence: there is nothing in it to agree to. `aria-live` because
	   it is replaced in place once the real sentence arrives. */
	if (resolution.status === 'pending') {
		return (
			<span aria-live="polite" data-cy="consent-sentence-pending">
				{t(
					'registration.dataProtection.loading',
					'Der Einwilligungstext wird geladen …'
				)}
			</span>
		);
	}

	return <ConsentSentence consentText={resolution.consentText} />;
};
