/**
 * A start-call request (`startCallIntent`, FE#1050) for a group chat: the
 * group header owns the group's call buttons, so it takes the request with
 * the same checks that show those buttons (FE#2482, Frank 21 Nov 2026: the
 * moderator starts an audio or video circle's call from its waiting room).
 * `SessionMenu` takes requests for 1:1 conversations only.
 */
import * as React from 'react';
import { StartCallRequest, type CallKind } from '../../call/startCallIntent';
import { useConversationFeatureSettingsSettled } from '../../../hooks/useConversationFeatureSettings';

export interface GroupCallStartRequestProps {
	/** The group chat on screen. */
	sessionId: number | undefined;
	/** The header would show "Video-Call starten" / "Audio-Call starten". */
	video: boolean;
	audio: boolean;
	/** The header button's own start. */
	start: (isVideo: boolean) => void;
	/** No live gesture: point at the header button instead. */
	offer: (kind: CallKind) => void;
	/** A check refuses the call; the chat stays open. */
	refuse: (kind: CallKind) => void;
}

export const GroupCallStartRequest = ({
	sessionId,
	video,
	audio,
	start,
	offer,
	refuse
}: GroupCallStartRequestProps) => {
	const settled = useConversationFeatureSettingsSettled();
	return (
		<StartCallRequest
			sessionId={sessionId}
			settled={settled}
			calls={{
				video: {
					allowed: video,
					start: () => start(true),
					offer: () => offer('video'),
					refuse: () => refuse('video')
				},
				audio: {
					allowed: audio,
					start: () => start(false),
					offer: () => offer('audio'),
					refuse: () => refuse('audio')
				}
			}}
		/>
	);
};
