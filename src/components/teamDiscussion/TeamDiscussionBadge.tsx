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
	invalidateTeamDiscussionCache,
	subscribeTeamDiscussionCache
} from '../../services/teamDiscussionCache';
import { ReactComponent as TeamGlyph } from '../../resources/img/icons/speech-bubble-team.svg';
import './teamDiscussion.styles.scss';

export { getCachedTeamDiscussion, invalidateTeamDiscussionCache };

interface TeamDiscussionIconButtonProps {
	'onOpen'?: () => void;
	/**
	 * FE#2491: the case-header indication — the same marker as on the list
	 * row, with the word "Team-Chat" written out, like a chip.
	 */
	'showLabel'?: boolean;
	/** The team chat is the panel on screen right now (`aria-pressed`). */
	'active'?: boolean;
	'data-cy'?: string;
}

/** The pure view: one clickable icon, the word lives in name and tooltip. */
export const TeamDiscussionIconButton = ({
	onOpen,
	showLabel = false,
	active,
	'data-cy': dataCy = 'team-discussion-badge'
}: TeamDiscussionIconButtonProps) => {
	const { t: translate } = useTranslation();
	const label = translate('teamDiscussion.title');

	return (
		<button
			type="button"
			className={[
				'teamDiscussionBadge',
				showLabel && 'teamDiscussionBadge--chip',
				active && 'teamDiscussionBadge--active'
			]
				.filter(Boolean)
				.join(' ')}
			data-cy={dataCy}
			title={`${label} – ${translate('teamDiscussion.teamOnlyMarker')}`}
			aria-label={showLabel ? undefined : label}
			aria-pressed={active === undefined ? undefined : active}
			disabled={!onOpen}
			onKeyDown={(event) => {
				// Enter/Space activate this button, not the enclosing list row.
				if (event.key === 'Enter' || event.key === ' ') {
					event.stopPropagation();
				}
			}}
			onClick={(event) => {
				// The list row is itself clickable: do not also open the chat.
				event.stopPropagation();
				onOpen?.();
			}}
		>
			<TeamGlyph aria-hidden="true" focusable="false" />
			{showLabel && (
				<span className="teamDiscussionBadge__label">{label}</span>
			)}
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
		let lookup = 0;
		const load = () => {
			const current = ++lookup;
			getCachedTeamDiscussion(sessionId).then((result) => {
				if (!cancelled && current === lookup) {
					setDiscussion(result);
				}
			});
		};
		load();
		// FE#2491: a switch on/off elsewhere must not leave the list stale.
		const unsubscribe = subscribeTeamDiscussionCache((changedId) => {
			if (changedId === sessionId) load();
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [sessionId]);

	// FE#2491/#2494: the row marks only an active (OPEN) team chat — not a
	// switched-off (CLOSED) one, nor one archived after accept.
	if (!discussion || discussion.status !== 'OPEN') {
		return null;
	}

	return <TeamDiscussionIconButton onOpen={onOpen} />;
};
