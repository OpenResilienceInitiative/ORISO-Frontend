import { useEffect, useState } from 'react';
import {
	apiGetTeamDiscussion,
	apiOpenTeamDiscussion,
	type TeamDiscussion
} from '../api/apiTeamDiscussion';

interface TeamDiscussionChannelState {
	sessionId: number | null;
	discussion: TeamDiscussion | null;
	resolved: boolean;
}

interface UseTeamDiscussionChannelInput {
	sessionId?: number;
	enabled: boolean;
	allowCreate: boolean;
	teamChannelRequested: boolean;
}

const EMPTY_STATE: TeamDiscussionChannelState = {
	sessionId: null,
	discussion: null,
	resolved: true
};

/** Resolves a session-keyed team room and creates it only on an explicit open. */
export const useTeamDiscussionChannel = ({
	sessionId,
	enabled,
	allowCreate,
	teamChannelRequested
}: UseTeamDiscussionChannelInput): Omit<
	TeamDiscussionChannelState,
	'sessionId'
> => {
	const [state, setState] = useState<TeamDiscussionChannelState>(EMPTY_STATE);

	useEffect(() => {
		let cancelled = false;
		if (!enabled || !sessionId) {
			setState(EMPTY_STATE);
			return () => {
				cancelled = true;
			};
		}

		setState({ sessionId, discussion: null, resolved: false });
		const request =
			teamChannelRequested && allowCreate
				? apiOpenTeamDiscussion
				: apiGetTeamDiscussion;
		request(sessionId)
			.then((discussion) => {
				if (!cancelled) {
					setState({ sessionId, discussion, resolved: true });
				}
			})
			.catch(() => {
				if (!cancelled) {
					setState({ sessionId, discussion: null, resolved: true });
				}
			});

		return () => {
			cancelled = true;
		};
	}, [allowCreate, enabled, sessionId, teamChannelRequested]);

	if (!enabled || !sessionId) {
		return { discussion: null, resolved: true };
	}

	return state.sessionId === sessionId
		? { discussion: state.discussion, resolved: state.resolved }
		: { discussion: null, resolved: false };
};
