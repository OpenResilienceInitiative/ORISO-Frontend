import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiCloseTeamDiscussion,
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

export type TeamDiscussionToggle = 'on' | 'off';

interface TeamDiscussionChannelResult {
	discussion: TeamDiscussion | null;
	error: Error | null;
	resolved: boolean;
	retry: () => void;
	/**
	 * FE#2491: explicit "switch the team chat on" for an open enquiry — the
	 * only path that POSTs for a CLOSED discussion (POST reopens it).
	 */
	switchOn: () => Promise<void>;
	/** FE#2491: switch the team chat off (CLOSED, read-only for everyone). */
	switchOff: () => Promise<void>;
	/** The switch currently in flight, if any. */
	toggling: TeamDiscussionToggle | null;
	/** The switch that failed last; cleared by the next attempt. */
	toggleError: TeamDiscussionToggle | null;
}

const EMPTY_STATE: TeamDiscussionChannelState = {
	sessionId: null,
	allowCreate: false,
	teamChannelRequested: false,
	discussion: null,
	error: null,
	resolved: true
};

/**
 * Looks at the GET answer first and decides whether the open route may POST.
 * POST creates, joins and — since FE#2491 — REOPENS a CLOSED discussion, so a
 * CLOSED one is only ever looked at here, never posted to.
 */
const resolveRequestedDiscussion = async (
	sessionId: number,
	allowCreate: boolean
): Promise<TeamDiscussion | null> => {
	let existing: TeamDiscussion | null;
	try {
		existing = await apiGetTeamDiscussion(sessionId);
	} catch (error) {
		// An open enquiry kept its old contract: the click creates the room
		// even when the lookup failed. Accepted cases never create.
		if (allowCreate) {
			return apiOpenTeamDiscussion(sessionId);
		}
		throw error;
	}
	if (existing?.status === 'CLOSED') {
		return existing;
	}
	// POST is also the join contract. Accepted/archived sessions may not
	// create a room, but must still join an existing room when opened.
	if (existing || allowCreate) {
		return apiOpenTeamDiscussion(sessionId);
	}
	return null;
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
	const [toggling, setToggling] = useState<TeamDiscussionToggle | null>(null);
	const [toggleError, setToggleError] = useState<TeamDiscussionToggle | null>(
		null
	);
	const retry = useCallback(() => setRetryToken((token) => token + 1), []);
	const currentSessionRef = useRef(sessionId);
	currentSessionRef.current = sessionId;

	useEffect(() => {
		setToggleError(null);
	}, [sessionId]);

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
		const resolveDiscussion = () =>
			teamChannelRequested
				? resolveRequestedDiscussion(sessionId, allowCreate)
				: apiGetTeamDiscussion(sessionId);
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

	const switchOn = useCallback(async () => {
		if (!enabled || !sessionId || !allowCreate) {
			return;
		}
		setToggling('on');
		setToggleError(null);
		try {
			const discussion = await apiOpenTeamDiscussion(sessionId);
			invalidateTeamDiscussionCache(sessionId);
			if (currentSessionRef.current === sessionId) {
				setState((previous) =>
					previous.sessionId === sessionId
						? { ...previous, discussion, error: null }
						: previous
				);
			}
		} catch (error) {
			if (currentSessionRef.current === sessionId) {
				setToggleError('on');
			}
			throw error;
		} finally {
			setToggling(null);
		}
	}, [allowCreate, enabled, sessionId]);

	const switchOff = useCallback(async () => {
		if (!enabled || !sessionId) {
			return;
		}
		setToggling('off');
		setToggleError(null);
		try {
			await apiCloseTeamDiscussion(sessionId);
			invalidateTeamDiscussionCache(sessionId);
			if (currentSessionRef.current === sessionId) {
				setState((previous) =>
					previous.sessionId === sessionId && previous.discussion
						? {
								...previous,
								discussion: {
									...previous.discussion,
									status: 'CLOSED',
									closedDate: new Date().toISOString()
								}
							}
						: previous
				);
			}
		} catch (error) {
			if (currentSessionRef.current === sessionId) {
				setToggleError('off');
			}
			throw error;
		} finally {
			setToggling(null);
		}
	}, [enabled, sessionId]);

	if (!enabled || !sessionId) {
		return {
			discussion: null,
			error: null,
			resolved: true,
			retry,
			switchOn,
			switchOff,
			toggling: null,
			toggleError: null
		};
	}

	return state.sessionId === sessionId &&
		state.allowCreate === allowCreate &&
		state.teamChannelRequested === teamChannelRequested
		? {
				discussion: state.discussion,
				error: state.error,
				resolved: state.resolved,
				retry,
				switchOn,
				switchOff,
				toggling,
				toggleError
			}
		: {
				discussion: null,
				error: null,
				resolved: false,
				retry,
				switchOn,
				switchOff,
				toggling,
				toggleError
			};
};
