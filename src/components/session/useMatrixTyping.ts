import { useCallback, useEffect, useRef } from 'react';
import { chatTransportService } from '../../services/chatTransportService';

/** Re-announce "typing" at most once per second while keys keep coming. */
export const MATRIX_TYPING_TRIGGER_MS = 1000;
/** Typing ends this long after the last keystroke. */
export const MATRIX_TYPING_TIMEOUT_MS = 3200;
const CLEARED_TYPING_DELAY_MS = 250;

/**
 * The chat's typing indicator rule (moved out of SessionStream for #1824 D3,
 * so the Activity Timeline preview announces typing exactly like the chat).
 *
 * Returns the composer's `isTyping(isCleared, targetRoomId?)` callback. A
 * running announcement always ends: after idle time, when the field is
 * cleared, and when the room changes or the view closes.
 */
export const useMatrixTyping = (roomId: string | null | undefined) => {
	const timeoutRef = useRef<number | null>(null);
	const lastTriggerRef = useRef(0);
	const typingInRoomRef = useRef<string | null>(null);

	const clearTimer = () => {
		if (timeoutRef.current) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	};

	// Typing is a courtesy: a client that cannot announce it (not ready yet)
	// must never break the view, whether it rejects or throws.
	const send = (targetRoomId: string, typing: boolean) => {
		try {
			void chatTransportService
				.sendTyping(targetRoomId, typing)
				?.catch?.(() => undefined);
		} catch {
			// nothing to do
		}
	};

	const endTyping = useCallback(() => {
		clearTimer();
		const typingRoomId = typingInRoomRef.current;
		typingInRoomRef.current = null;
		lastTriggerRef.current = 0;
		if (typingRoomId) {
			send(typingRoomId, false);
		}
	}, []);

	// A new room (or closing the view) ends what is still announced.
	useEffect(() => endTyping, [roomId, endTyping]);

	return useCallback(
		(isCleared: boolean, targetRoomId: string | null = roomId ?? null) => {
			if (!targetRoomId) {
				return;
			}
			clearTimer();
			if (isCleared) {
				timeoutRef.current = window.setTimeout(
					endTyping,
					CLEARED_TYPING_DELAY_MS
				);
				return;
			}
			const now = Date.now();
			if (
				typingInRoomRef.current !== targetRoomId ||
				lastTriggerRef.current + MATRIX_TYPING_TRIGGER_MS < now
			) {
				typingInRoomRef.current = targetRoomId;
				lastTriggerRef.current = now;
				send(targetRoomId, true);
			}
			timeoutRef.current = window.setTimeout(
				endTyping,
				MATRIX_TYPING_TIMEOUT_MS
			);
		},
		[roomId, endTyping]
	);
};
