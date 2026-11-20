import { useCallback, useEffect, useRef, useState } from 'react';

import type { ComposerPendingQuote } from '../messageSubmitInterface/ComposerPendingQuotes';
import type { SelectionAnswer } from './SelectionReplyLayer';

/** One answer ready to leave: what was marked, and the text or the clip. */
export interface PassageReplyToSend {
	eventId: string;
	author: string;
	excerpt: string;
	start?: number | null;
	text?: string;
	/** The answer field's take, as `{ src }` of the recorder. */
	voice?: { src: string; durationSec: number } | null;
}

export interface UsePassageRepliesOptions {
	/**
	 * Sends the answers and the typed text as ONE message. Rejects when
	 * nothing was sent; the answers then stay collected.
	 */
	send: (replies: PassageReplyToSend[], typedText: string) => Promise<void>;
	/** Called when a send failed; the answers are still collected. */
	onSendFailed?: (error: unknown) => void;
	/** A clip is no longer needed: it was sent, or its answer removed. */
	releaseVoice?: (src: string) => void;
	/** The conversation: collected answers never cross into another one. */
	conversationKey: string;
	/** Answers already collected when the chat opens (stories). */
	initialPending?: CollectedPassageReply[];
}

/** A collected answer: the composer's bar plus the take that plays. */
export type CollectedPassageReply = ComposerPendingQuote & {
	voice?: { src: string; durationSec: number } | null;
};

type Collected = CollectedPassageReply;

const toSend = (quote: Collected): PassageReplyToSend => ({
	eventId: quote.eventId,
	author: quote.author,
	excerpt: quote.excerpt,
	start: quote.excerptStart,
	text: quote.replyText,
	voice: quote.voice || null
});

let nextId = 0;

const collectedOf = (answer: SelectionAnswer): Collected => ({
	id: `passage-${Date.now()}-${(nextId += 1)}`,
	eventId: answer.passage.eventId,
	author: answer.passage.author,
	excerpt: answer.passage.text,
	excerptStart: answer.passage.start,
	replyText: answer.text || undefined,
	voiceDurationSec: answer.voice?.durationSec ?? null,
	voice: answer.voice
});

/**
 * Selection reply in the real chat: answers to marked passages are collected
 * in the composer and leave together as one message (ADR-022). A failed send
 * keeps every answer collected, including one sent straight from the answer
 * field, and remembers the typed text so the next send carries it.
 */
export const usePassageReplies = ({
	send,
	onSendFailed,
	releaseVoice,
	conversationKey,
	initialPending
}: UsePassageRepliesOptions) => {
	const [pending, setPending] = useState<Collected[]>(
		() => initialPending || []
	);
	const pendingRef = useRef(pending);
	pendingRef.current = pending;
	// Typed text of a send that failed: the composer had already cleared it.
	const carriedTextRef = useRef('');
	const sendingRef = useRef(false);
	const keyRef = useRef(conversationKey);

	useEffect(() => {
		if (keyRef.current === conversationKey) {
			return;
		}
		keyRef.current = conversationKey;
		setPending([]);
		carriedTextRef.current = '';
	}, [conversationKey]);

	const dispatch = useCallback(
		async (rows: Collected[], typedText: string) => {
			if (!rows.length || sendingRef.current) {
				return;
			}
			const key = keyRef.current;
			const text = [carriedTextRef.current, typedText]
				.filter((part) => part.trim())
				.join('\n\n');
			sendingRef.current = true;
			// Shown as sent at once; put back if the send fails.
			setPending([]);
			carriedTextRef.current = '';
			try {
				await send(rows.map(toSend), text);
				rows.forEach(
					(row) => row.voice && releaseVoice?.(row.voice.src)
				);
			} catch (error) {
				if (keyRef.current === key) {
					setPending((current) => [...rows, ...current]);
					carriedTextRef.current = text;
				}
				onSendFailed?.(error);
			} finally {
				sendingRef.current = false;
			}
		},
		[send, onSendFailed, releaseVoice]
	);

	const collect = useCallback((answer: SelectionAnswer) => {
		setPending((rows) => [...rows, collectedOf(answer)]);
	}, []);

	/** From the answer field: everything collected goes along with it. */
	const sendNow = useCallback(
		(answer: SelectionAnswer) =>
			dispatch([...pendingRef.current, collectedOf(answer)], ''),
		[dispatch]
	);

	/** The composer's send while answers are collected. */
	const sendCollected = useCallback(
		(typedText: string) => dispatch(pendingRef.current, typedText),
		[dispatch]
	);

	const remove = useCallback(
		(id: string) => {
			const removed = pendingRef.current.find((row) => row.id === id);
			if (removed?.voice) {
				releaseVoice?.(removed.voice.src);
			}
			setPending((rows) => rows.filter((row) => row.id !== id));
		},
		[releaseVoice]
	);

	return {
		pending: pending as ComposerPendingQuote[],
		collect,
		sendNow,
		sendCollected,
		remove
	};
};
