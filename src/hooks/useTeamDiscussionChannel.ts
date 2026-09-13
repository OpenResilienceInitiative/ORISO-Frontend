import { useEffect, useState } from 'react';
import {
	apiGetTeamDiscussion,
	apiOpenTeamDiscussion,
	type TeamDiscussion
} from '../api/apiTeamDiscussion';

interface TeamDiscussionChannelState {
	sessionId: number | null;
	allowCreate: boolean;
	teamChannelRequested: boolean;
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
	allowCreate: false,
	teamChannelRequested: false,
	discussion: null,
	resolved: true
};

/** Resolves a session-keyed team room and creates it only on an explicit open. */
export const useTeamDiscussionChannel = ({
	sessionId,
	enabled,
	allowCreate,
	teamChannelRequested
}: UseTeamDiscussionChannelInput): Pick<
	TeamDiscussionChannelState,
	'discussion' | 'resolved'
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

		setState({
			sessionId,
			allowCreate,
			teamChannelRequested,
			discussion: null,
			resolved: false
		});
		const resolveDiscussion = async () => {
			if (teamChannelRequested && allowCreate) {
				return apiOpenTeamDiscussion(sessionId);
			}

			const existing = await apiGetTeamDiscussion(sessionId);
			// POST is also the join contract. Accepted/archived sessions may not
			// create a room, but must still join an existing room when opened.
			return teamChannelRequested && existing
				? apiOpenTeamDiscussion(sessionId)
				: existing;
		};
		resolveDiscussion()
			.then((discussion) => {
				if (!cancelled) {
					setState({
						sessionId,
						allowCreate,
						teamChannelRequested,
						discussion,
						resolved: true
					});
				}
			})
			.catch(() => {
				if (!cancelled) {
					setState({
						sessionId,
						allowCreate,
						teamChannelRequested,
						discussion: null,
						resolved: true
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [allowCreate, enabled, sessionId, teamChannelRequested]);

	if (!enabled || !sessionId) {
		return { discussion: null, resolved: true };
	}

	return state.sessionId === sessionId &&
		state.allowCreate === allowCreate &&
		state.teamChannelRequested === teamChannelRequested
		? { discussion: state.discussion, resolved: state.resolved }
		: { discussion: null, resolved: false };
};
