import { RefObject, useCallback, useEffect, useRef } from 'react';
import type { SessionChannel } from '../../utils/channelRoute';

/** Return to the actual answers opener only when its thread closes to this session. */
export const useThreadFocusReturn = ({
	channel,
	sessionId,
	timelineRef
}: {
	channel: SessionChannel | null;
	sessionId: string | number;
	timelineRef: RefObject<HTMLElement | null>;
}) => {
	const channelKey =
		channel?.kind === 'thread'
			? `thread:${channel.rootId}`
			: (channel?.kind ?? '');
	const previous = useRef({ channelKey, sessionId });
	const opener = useRef<{
		rootId: string;
		sessionId: string | number;
		node: HTMLElement;
	} | null>(null);
	const rememberOpener = useCallback(
		(rootId: string, node?: HTMLElement) => {
			opener.current = node ? { rootId, sessionId, node } : null;
		},
		[sessionId]
	);
	useEffect(() => {
		const before = previous.current;
		previous.current = { channelKey, sessionId };
		const remembered = opener.current;
		if (!remembered) return;
		if (
			before.sessionId !== sessionId ||
			remembered.sessionId !== sessionId
		) {
			opener.current = null;
			return;
		}
		if (channelKey) {
			if (channelKey !== `thread:${remembered.rootId}`)
				opener.current = null;
			return;
		}
		if (before.channelKey !== `thread:${remembered.rootId}`) return;
		opener.current = null;
		// Phone navigation can remount the main timeline. Wait until its DOM
		// and normal mount effects have settled, then find this exact root.
		const frame = requestAnimationFrame(() => {
			const timeline = timelineRef.current;
			if (!timeline) return;
			const node =
				remembered.node.isConnected &&
				timeline.contains(remembered.node)
					? remembered.node
					: Array.from(
							timeline.querySelectorAll<HTMLElement>(
								'[data-message-id]'
							)
						)
							.find(
								(message) =>
									message.dataset.messageId ===
									remembered.rootId
							)
							?.querySelector<HTMLElement>(
								'[data-cy="thread-entry"]'
							);
			node?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [channelKey, sessionId, timelineRef]);
	return rememberOpener;
};
