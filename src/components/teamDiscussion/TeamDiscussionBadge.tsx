/**
 * FE#514 — small "Team-Besprechung" indicator on an enquiry list item so
 * counsellors see before accepting that the team has weighed in. Existence
 * only (the post count lives in the panel); results are cached per session to
 * keep the list from re-fetching on every render.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamDiscussion } from '../../api/apiTeamDiscussion';
import {
	getCachedTeamDiscussion,
	invalidateTeamDiscussionCache
} from '../../services/teamDiscussionCache';
import { ReactComponent as TeamGlyph } from '../../resources/img/icons/speech-bubble-team.svg';
import './teamDiscussion.styles.scss';

export { getCachedTeamDiscussion, invalidateTeamDiscussionCache };

interface TeamDiscussionIconButtonProps {
	onOpen?: () => void;
}

/** The pure view: one clickable icon, the word lives in name and tooltip. */
export const TeamDiscussionIconButton = ({
	onOpen
}: TeamDiscussionIconButtonProps) => {
	const { t: translate } = useTranslation();
	const label = translate('teamDiscussion.title');

	return (
		<button
			type="button"
			className="teamDiscussionBadge"
			data-cy="team-discussion-badge"
			title={`${label} – ${translate('teamDiscussion.teamOnlyMarker')}`}
			aria-label={label}
			disabled={!onOpen}
			onClick={(event) => {
				// The list row is itself clickable: do not also open the chat.
				event.stopPropagation();
				onOpen?.();
			}}
		>
			<TeamGlyph aria-hidden="true" focusable="false" />
		</button>
	);
};

interface TeamDiscussionBadgeProps {
	sessionId: number;
	/** Opens the team discussion; the icon is a button only when given. */
	onOpen?: () => void;
}

export const TeamDiscussionBadge = ({
	sessionId,
	onOpen
}: TeamDiscussionBadgeProps) => {
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

	return <TeamDiscussionIconButton onOpen={onOpen} />;
};
