import * as React from 'react';
import { FC, useEffect, useState } from 'react';
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

export interface DataProtectionConsentLabelProps {
	agency?: AgencyDataInterface;
	topic?: TopicsDataInterface;
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
> = ({ agency, topic }) => {
	/* Deciding this from data the registration already holds means the
	   unconfigured case issues no request at all and renders today's sentence
	   immediately: no spinner, no swap, nothing to regress. */
	const department = getDepartmentForTopic(agency, topic);
	const mayHaveConsentText =
		department?.hasPublishedDpp === true && !!agency?.id && !!topic?.id;

	const [consentText, setConsentText] = useState<ConsentTextData | null>(
		null
	);
	const [isResolved, setIsResolved] = useState(false);

	useEffect(() => {
		if (!mayHaveConsentText) {
			setConsentText(null);
			setIsResolved(true);
			return;
		}

		const abortController = new AbortController();
		setIsResolved(false);
		apiGetConsentText(agency.id, topic.id, abortController.signal).then(
			(data) => {
				if (!abortController.signal.aborted) {
					setConsentText(data);
					setIsResolved(true);
				}
			}
		);
		return () => abortController.abort();
	}, [mayHaveConsentText, agency?.id, topic?.id]);

	/* A configured Fachbereich is still being fetched: render nothing rather
	   than the platform wording. Showing it and swapping it for the Träger's a
	   moment later would mean the checkbox briefly carries a sentence that is
	   not the one in force. */
	if (!isResolved) {
		return null;
	}

	return <ConsentSentence consentText={consentText} />;
};
