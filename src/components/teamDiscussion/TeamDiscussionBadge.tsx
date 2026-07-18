/**
 * FE#514 — small "Team-Besprechung" indicator on an enquiry list item so
 * counsellors see before accepting that the team has weighed in. Existence
 * only (the post count lives in the panel); results are cached per session to
 * keep the list from re-fetching on every render.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetTeamDiscussion,
	TeamDiscussion
} from '../../api/apiTeamDiscussion';
import './teamDiscussion.styles.scss';

const discussionCache = new Map<number, Promise<TeamDiscussion | null>>();

export const getCachedTeamDiscussion = (
	sessionId: number
): Promise<TeamDiscussion | null> => {
	if (!discussionCache.has(sessionId)) {
		discussionCache.set(
			sessionId,
			apiGetTeamDiscussion(sessionId).catch(() => {
				discussionCache.delete(sessionId);
				return null;
			})
		);
	}
	return discussionCache.get(sessionId);
};

/** Invalidate after opening/creating a discussion so the badge appears. */
export const invalidateTeamDiscussionCache = (sessionId: number) => {
	discussionCache.delete(sessionId);
};

interface TeamDiscussionBadgeProps {
	sessionId: number;
}

export const TeamDiscussionBadge = ({
	sessionId
}: TeamDiscussionBadgeProps) => {
	const { t: translate } = useTranslation();
	const [discussion, setDiscussion] = useState<TeamDiscussion | null>(null);

	useEffect(() => {
		let cancelled = false;
		getCachedTeamDiscussion(sessionId).then((result) => {
			if (!cancelled) {
				setDiscussion(result);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	if (!discussion) {
		return null;
	}

	return (
		<span
			className="teamDiscussionBadge"
			data-cy="team-discussion-badge"
			title={translate('teamDiscussion.teamOnlyMarker')}
		>
			{translate('teamDiscussion.title')}
		</span>
	);
};
