import { useCallback, useEffect, useState } from 'react';
import {
	apiGetTeamDiscussion,
	apiOpenTeamDiscussion,
	type TeamDiscussion
} from '../api/apiTeamDiscussion';
import { invalidateTeamDiscussionCache } from '../services/teamDiscussionCache';

interface TeamDiscussionChannelState {
	sessionId: number | null;
	allowCreate: boolean;
	teamChannelRequested: boolean;
	discussion: TeamDiscussion | null;
	error: Error | null;
	resolved: boolean;
}

interface UseTeamDiscussionChannelInput {
	sessionId?: number;
	enabled: boolean;
	allowCreate: boolean;
	teamChannelRequested: boolean;
}

interface TeamDiscussionChannelResult {
	discussion: TeamDiscussion | null;
	error: Error | null;
	resolved: boolean;
	retry: () => void;
}

const EMPTY_STATE: TeamDiscussionChannelState = {
	sessionId: null,
	allowCreate: false,
	teamChannelRequested: false,
	discussion: null,
	error: null,
	resolved: true
};

/** Resolves a session-keyed team room and creates it only on an explicit open. */
export const useTeamDiscussionChannel = ({
	sessionId,
	enabled,
	allowCreate,
	teamChannelRequested
}: UseTeamDiscussionChannelInput): TeamDiscussionChannelResult => {
	const [state, setState] = useState<TeamDiscussionChannelState>(EMPTY_STATE);
	const [retryToken, setRetryToken] = useState(0);
	const retry = useCallback(() => setRetryToken((token) => token + 1), []);

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
			error: null,
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
					if (teamChannelRequested && discussion) {
						invalidateTeamDiscussionCache(sessionId);
					}
					setState({
						sessionId,
						allowCreate,
						teamChannelRequested,
						discussion,
						error: null,
						resolved: true
					});
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setState({
						sessionId,
						allowCreate,
						teamChannelRequested,
						discussion: null,
						error:
							error instanceof Error
								? error
								: new Error('Team discussion lookup failed'),
						resolved: true
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [allowCreate, enabled, retryToken, sessionId, teamChannelRequested]);

	if (!enabled || !sessionId) {
		return { discussion: null, error: null, resolved: true, retry };
	}

	return state.sessionId === sessionId &&
		state.allowCreate === allowCreate &&
		state.teamChannelRequested === teamChannelRequested
		? {
				discussion: state.discussion,
				error: state.error,
				resolved: state.resolved,
				retry
			}
		: { discussion: null, error: null, resolved: false, retry };
};
