export type SendButtonState = 'empty' | 'ready' | 'sending' | 'disabled';

export type SendButtonTransition = 'arm' | 'fly-out' | 'settle' | 'none';

export interface SendButtonInputs {
	/** Composer has sendable content (text and/or attachments/chips). */
	hasContent: boolean;
	/** A send request is currently in flight. */
	isSending: boolean;
	/** Sending is blocked (attachment upload, voice recording, …). */
	isDisabled: boolean;
}

/**
 * Figma "Nachricht senden" (node 489:16565): empty shows the plain chevron on
 * the pale container, ready shows the rotated paper plane on primary. The
 * state machine is intentionally pure so the animation classes can be unit
 * tested without a DOM.
 */
export const deriveSendButtonState = ({
	hasContent,
	isSending,
	isDisabled
}: SendButtonInputs): SendButtonState => {
	if (isDisabled) {
		return 'disabled';
	}
	if (isSending) {
		return 'sending';
	}
	return hasContent ? 'ready' : 'empty';
};

/**
 * Maps a state change to its animation: arming rotates the plane in,
 * fly-out launches it on send, settle snaps back to the empty chevron.
 */
export const getSendButtonTransition = (
	previous: SendButtonState,
	next: SendButtonState
): SendButtonTransition => {
	if (previous === 'empty' && next === 'ready') {
		return 'arm';
	}
	if (previous === 'ready' && next === 'sending') {
		return 'fly-out';
	}
	if (previous === 'sending' && (next === 'empty' || next === 'ready')) {
		return 'settle';
	}
	return 'none';
};
