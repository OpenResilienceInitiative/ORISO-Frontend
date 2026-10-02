import { useEffect, useState } from 'react';
import { apiGetAgencyById } from '../../../api/apiGetAgencyId';
import { getGroupInviteTopicId } from '../../registration/groupInviteEntry/groupInviteEntryState';

export type GroupDepartment = { agencyId: number; topicId: number };

export type GroupDepartmentState =
	| { status: 'loading' }
	| { status: 'ready'; department: GroupDepartment | null };

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
	const [state, setState] = useState<GroupDepartmentState>(() =>
		agencyId ? { status: 'loading' } : { status: 'ready', department: null }
	);

	useEffect(() => {
		if (!agencyId) {
			setState({ status: 'ready', department: null });
			return undefined;
		}
		let cancelled = false;
		setState({ status: 'loading' });
		apiGetAgencyById(agencyId)
			.then((agency) => {
				if (cancelled) return;
				const topicId = getGroupInviteTopicId(agency);
				setState({
					status: 'ready',
					department: topicId == null ? null : { agencyId, topicId }
				});
			})
			.catch(() => {
				if (!cancelled) setState({ status: 'ready', department: null });
			});
		return () => {
			cancelled = true;
		};
	}, [agencyId]);

	return state;
};
