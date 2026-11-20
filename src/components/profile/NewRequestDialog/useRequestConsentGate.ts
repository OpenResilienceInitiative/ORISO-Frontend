import { useContext, useState } from 'react';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import {
	ConsentResolution,
	consentBindingKey,
	consentInputKey,
	departmentMayHaveConsentText,
	effectiveConsentResolution,
	mayAcceptConsent
} from '../../registration/accountData/consentAcceptance';
import { useTraegerSentenceHtml } from '../../registration/accountData/useTraegerSentenceHtml';

export type RequestConsentFailure = 'unavailable' | 'unrenderable' | null;

/**
 * ADR-022 gate 2 moved forward for an additional enquiry (FE#1876): the
 * consent of the chosen Beratungsstelle × topic, bound to the exact wording on
 * screen. Same derivation as the registration (`AccountData`), so both gates
 * fail closed for the same reasons: while the sentence is loading, when the
 * legal text is unavailable, or when a Träger text cannot be rendered.
 */
export const useRequestConsentGate = (
	agency?: AgencyDataInterface | null,
	topic?: TopicsDataInterface | null
) => {
	const { locale } = useContext(LocaleContext) ?? { locale: undefined };
	const legalLinks = useContext(LegalLinksContext) ?? [];
	const agencyInput = agency ?? undefined;
	const topicInput = topic ?? undefined;
	const inputs = consentInputKey(agencyInput, topicInput);

	const [resolution, setResolution] = useState<ConsentResolution>(() =>
		departmentMayHaveConsentText(agencyInput, topicInput)
			? { status: 'pending' }
			: { status: 'resolved', consentText: null, inputKey: inputs }
	);
	const [acceptedBinding, setAcceptedBinding] = useState<string | null>(null);

	const effective = effectiveConsentResolution(
		resolution,
		agencyInput,
		topicInput
	);
	const traegerSentence = useTraegerSentenceHtml(
		effective.status === 'resolved' ? effective.consentText : null,
		{ agencyName: agency?.name, topicName: topic?.name }
	);
	const unrenderable =
		effective.status === 'resolved' &&
		!!effective.consentText &&
		!traegerSentence;
	const platformUnavailable =
		effective.status === 'resolved' &&
		!effective.consentText &&
		!legalLinks.some((link) => link.registration);
	const isResolved =
		mayAcceptConsent(effective, inputs) &&
		!unrenderable &&
		!platformUnavailable;
	const binding =
		isResolved && effective.status === 'resolved'
			? consentBindingKey(
					agency?.id,
					topic?.id,
					effective.consentText?.versionId,
					`${locale}:${traegerSentence?.authored ?? 'platform'}`
				)
			: null;
	const accepted = binding !== null && acceptedBinding === binding;
	const failure: RequestConsentFailure =
		effective.status === 'unavailable' || platformUnavailable
			? 'unavailable'
			: unrenderable
				? 'unrenderable'
				: null;

	return {
		/** Pass to `DataProtectionConsentLabel` (a stable setter). */
		onResolutionChange: setResolution,
		isResolved,
		accepted,
		failure,
		/** The department version to pin with `apiPutSessionConsent`, if any. */
		versionId:
			effective.status === 'resolved' &&
			typeof effective.consentText?.versionId === 'number'
				? effective.consentText.versionId
				: null,
		toggle: () => setAcceptedBinding(accepted ? null : binding),
		reset: () => setAcceptedBinding(null)
	};
};
