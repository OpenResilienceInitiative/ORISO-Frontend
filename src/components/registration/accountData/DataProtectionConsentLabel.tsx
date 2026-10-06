import * as React from 'react';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import {
	ConsentResolution,
	consentInputKey,
	departmentMayHaveConsentText,
	effectiveConsentResolution
} from './consentAcceptance';
import { ConsentSentence } from './ConsentSentence';

export type { ConsentResolution };
export { departmentMayHaveConsentText };

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
	/* Derived during render from every input that feeds the answer, so it can
	   never lag behind them. See `consentInputKey`. */
	const inputKey = consentInputKey(agency, topic);

	/* Starts resolved in the unconfigured case, so that path issues no request,
	   shows today's sentence immediately and never disables anything. */
	const [resolution, setResolution] = useState<ConsentResolution>(() =>
		mayHaveConsentText
			? { status: 'pending' }
			: { status: 'resolved', consentText: null, inputKey }
	);

	/* State is written in an effect, so between an agency/topic change and that
	   effect running, `resolution` still answers the *previous* question. Derive
	   the effective one during render instead of acting on the stale value. */
	const effectiveResolution: ConsentResolution = effectiveConsentResolution(
		resolution,
		agency,
		topic
	);

	useEffect(() => {
		onResolutionChange?.(effectiveResolution);
		// `effectiveResolution` is derived per render; keying the effect on its
		// two inputs keeps this from firing on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resolution, agency?.id, topic?.id, onResolutionChange]);

	useEffect(() => {
		if (!mayHaveConsentText) {
			setResolution({ status: 'resolved', consentText: null, inputKey });
			return;
		}

		const abortController = new AbortController();
		setResolution({ status: 'pending' });
		apiGetConsentText(agency.id, topic.id, abortController.signal).then(
			(result) => {
				if (abortController.signal.aborted) {
					return;
				}
				setResolution(
					result.status === 'ok'
						? {
								status: 'resolved',
								consentText: result.consentText,
								inputKey
							}
						: { status: 'unavailable', inputKey }
				);
			}
		);
		return () => abortController.abort();
		// `inputKey` subsumes every input this reads; the ids are listed only
		// to satisfy the exhaustive-deps rule.
	}, [inputKey, mayHaveConsentText, agency?.id, topic?.id]);

	/* A configured Fachbereich is still being fetched: never the platform
	   wording, which would mean the checkbox briefly carries a sentence that is
	   not the one in force. But not nothing either — disabling a control does
	   not remove it from the accessibility tree, so rendering nothing left a
	   screen-reader user on an unnamed checkbox with no hint that anything was
	   happening. A loading notice is safe here precisely because it is not a
	   consent sentence: there is nothing in it to agree to. `aria-live` because
	   it is replaced in place once the real sentence arrives. */
	/* Asked, and the backend could not answer. The platform sentence must not
	   stand in: this Fachbereich reports a published policy, so its own wording
	   is the one that governs, and offering the platform text here would
	   collect agreement to a document that does not apply. Fail closed — the
	   checkbox stays disabled (`AccountData`), and the person is told why
	   rather than being left with a dead control. */
	if (effectiveResolution.status === 'unavailable') {
		return (
			<span role="alert" data-cy="consent-sentence-unavailable">
				{t('registration.agency.legal.unavailable')}
			</span>
		);
	}

	if (effectiveResolution.status === 'pending') {
		return (
			<span aria-live="polite" data-cy="consent-sentence-pending">
				{t('registration.dataProtection.loading')}
			</span>
		);
	}

	return (
		<ConsentSentence
			consentText={effectiveResolution.consentText}
			agency={agency}
			topic={topic}
		/>
	);
};
