import { useEffect, useState } from 'react';
import { apiGetAgencyById } from '../../api/apiGetAgencyId';
import { apiGetPublicTopicName } from '../../api/apiGetPublicTopicName';
import { ConsentContext } from '../../utils/consentText';

const NONE: ConsentContext = {};

/**
 * Names for `{{Beratungsstelle}}` and `{{Thema}}` in an entry room's consent
 * sentence; the public legal endpoint cannot resolve the topic itself.
 * `pending` holds agreement so nobody ticks a sentence with names missing.
 */
export const useConsentContext = (
	department: { agencyId: number; topicId: number } | null
): { context: ConsentContext; pending: boolean } => {
	const [answer, setAnswer] = useState<{
		key: string;
		context: ConsentContext;
	} | null>(null);
	const key = department
		? `${department.agencyId}:${department.topicId}`
		: null;

	useEffect(() => {
		if (!department || !key) return undefined;
		let cancelled = false;
		Promise.all([
			apiGetAgencyById(department.agencyId).catch(() => null),
			apiGetPublicTopicName(department.topicId)
		]).then(([agency, topicName]) => {
			if (cancelled) return;
			setAnswer({
				key,
				context: { agencyName: agency?.name || undefined, topicName }
			});
		});
		return () => {
			cancelled = true;
		};
		// The key stands for the department; its object identity may change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	if (!key) return { context: NONE, pending: false };
	return answer && answer.key === key
		? { context: answer.context, pending: false }
		: { context: NONE, pending: true };
};
