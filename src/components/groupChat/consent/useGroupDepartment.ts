import { useEffect, useState } from 'react';
import { apiGetAgencyById } from '../../../api/apiGetAgencyId';
import { getGroupInviteTopicId } from '../../registration/groupInviteEntry/groupInviteEntryState';

export type GroupDepartment = { agencyId: number; topicId: number };

export type GroupDepartmentState =
	| { status: 'loading' }
	| { status: 'ready'; department: GroupDepartment | null };

type Answer = { agencyId: number; department: GroupDepartment | null };

/**
 * The department (agency × topic) whose legal texts govern a self-help group.
 *
 * A group carries its agency but no topic. The topic is the agency's own when
 * it has exactly one — the same rule the invite link uses to skip the topic
 * step (#1499). Several topics, or none, leave the department unknown, and
 * callers fall back to the platform's wording.
 */
export const useGroupDepartment = (
	agencyId?: number | null
): GroupDepartmentState => {
	const [answer, setAnswer] = useState<Answer | null>(null);

	useEffect(() => {
		if (!agencyId) return undefined;
		let cancelled = false;
		apiGetAgencyById(agencyId)
			.then((agency) => {
				if (cancelled) return;
				const topicId = getGroupInviteTopicId(agency);
				setAnswer({
					agencyId,
					department: topicId == null ? null : { agencyId, topicId }
				});
			})
			.catch(() => {
				if (!cancelled) setAnswer({ agencyId, department: null });
			});
		return () => {
			cancelled = true;
		};
	}, [agencyId]);

	if (!agencyId) return { status: 'ready', department: null };
	// An answer for another agency must never stand in for this one.
	return answer?.agencyId === agencyId
		? { status: 'ready', department: answer.department }
		: { status: 'loading' };
};
