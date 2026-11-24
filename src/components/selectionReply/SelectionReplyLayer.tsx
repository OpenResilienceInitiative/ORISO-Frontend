import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

import { SelectionReplyToolbar, ToolbarAction } from './SelectionReplyToolbar';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ReplyBubbleIcon } from '../../resources/img/icons/reply-bubble.svg';
import { ReactComponent as ThreadEntryIcon } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as BlurIcon } from '../../resources/img/icons/blur_400.svg';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as TeamChatIcon } from '../../resources/img/icons/team-chat-3p.svg';
import { PassageBlurBar } from './PassageBlurBar';
import { passageBlurFromRange, type PassageBlur } from './passageBlur';
import {
	SelectionReplyPopover,
	type SelectionReplyVoice
} from './SelectionReplyPopover';
import {
	anchorFor,
	useMessageSelection,
	type PassageAnchor,
	type MarkedPassage,
	type MessageSelection
} from './useMessageSelection';
import {
	findMessageBubble,
	ACTIVE_HIGHLIGHT,
	livePassageRange,
	paintLivePassage
} from './passageRange';
import './selectionReply.styles.scss';

export type SideRoomTarget = 'supervision' | 'team';

/**
 * FE#2494 *7: "In Supervision antworten" opens the answer field for that
 * side chat; stacking puts the answer into the side chat's composer, send
 * posts it there at once. Never into the chat the passage came from.
 */
export interface SideRoomReply {
	onCollect: (answer: SelectionAnswer) => void;
	onSend: (answer: SelectionAnswer) => void;
}

/** An answer to one marked passage. */
export interface SelectionAnswer {
	passage: MarkedPassage;
	text: string;
	voice: { src: string; durationSec: number } | null;
}

/**
 * The microphone behind the answer field. The composer owns the real
 * MediaRecorder today; stories pass a stand-in.
 */
export interface SelectionVoiceRecorder {
	/** Resolves with the live microphone, for the level dots. */
	start: () => Promise<MediaStream | void> | void;
	stop: () => Promise<{ src: string; durationSec: number }>;
	/** FE#2494: hold the take without ending it (optional for stand-ins). */
	pause?: () => void;
	resume?: () => void;
	cancel: () => void;
}

export interface SelectionReplyLayerProps {
	children: React.ReactNode;
	authorFor: (eventId: string) => string;
	/** Enter in the answer field: collect the answer in the composer. */
	onAddToComposer: (answer: SelectionAnswer) => void;
	/** Cmd/Ctrl + Enter or the send button: send the answer now. */
	onSendNow: (answer: SelectionAnswer) => void;
	/** Last toolbar option: open a thread on the marked passage. */
	onStartThread?: (passage: MarkedPassage) => void;
	/**
	 * FE#2494 *7: "In Supervision antworten" / "Im Team-Chat antworten".
	 * Each handler receives the marked passage; the side chat collects it
	 * in its own reply field. Missing handler = the entry is not offered.
	 */
	onReplyInSideRoom?: Partial<Record<SideRoomTarget, SideRoomReply>>;
	/**
	 * How many answers already wait in the composer the answer would go
	 * to (null = this chat's own), shown as the stack's number.
	 */
	collectedCount?: (target: SideRoomTarget | null) => number;
	/**
	 * FE#2494 *8: the microphone sits inside the reply field; the bar can
	 * drop its own voice entry. Default keeps today's bar.
	 */
	voiceInToolbar?: boolean;
	/**
	 * FE#2494 *7 (review): false when this person may not write in this
	 * chat (supervisor, read-only co-access) but may answer in a side room.
	 * Then only the side-room entries are offered, and nothing is ever
	 * handed to `onAddToComposer` / `onSendNow`.
	 */
	canReplyHere?: boolean;
	/**
	 * FE#2494 *7 variant: 'bubble' shows a small reply handle at the top
	 * right of the marked passage instead of the bar; the handle opens one
	 * speech-bubble menu with the field and every other action.
	 */
	menu?: 'toolbar' | 'bubble';
	/** FE#2494 variant: the side-chat badge hangs on the quote. */
	badgeOn?: 'bubble' | 'quote' | 'bottom';
	/** Stack button icon: numbered cards (default) or reply-all. */
	stackIcon?: 'count' | 'replyAll';
	/** Focus the composer once an answer was collected or sent. */
	focusComposer?: () => void;
	recorder?: SelectionVoiceRecorder;
	/**
	 * Moderators only: "Blur" in the toolbar hides the marked passage for
	 * everyone. Receives the passage's position, never its text.
	 */
	onBlurPassage?: (
		passage: MarkedPassage,
		blur: Pick<PassageBlur, 'start' | 'length'>
	) => void;
	/**
	 * Moderators only: clicking a blurred passage offers "Remove blur".
	 * Messages must render their blurs removable (`removeLabel`).
	 */
	onRemoveBlur?: (eventId: string, blurId: string) => void;
	/** Who blurred a passage, for the moderator's bar. */
	blurredByFor?: (eventId: string, blurId: string) => string | undefined;
	enabled?: boolean;
	className?: string;
	/** Story hook: open with this selection already made. */
	initialSelection?: MessageSelection | null;
	initialMode?: 'toolbar' | 'popover';
	/** Story hook: the answer field opens for this side chat. */
	initialTarget?: SideRoomTarget | null;
	/** Story hook: the answer field opens in this voice state. */
	initialVoice?: SelectionReplyVoice;
	/** Story hook: open with the bar of this blurred passage. */
	initialBlurTarget?: { eventId: string; blurId: string } | null;
}

type BlurTarget = {
	eventId: string;
	blurId: string;
	anchor: PassageAnchor;
};

type Mode = 'none' | 'toolbar' | 'popover';

const TOOLBAR_GAP = 8;
const TOOLBAR_HEIGHT = 48;
const POPOVER_WIDTH = 400;
const EDGE = 12;

const clamp = (value: number, min: number, max: number) =>
	max < min ? min : Math.min(max, Math.max(min, value));

/**
 * Wraps a message timeline. Marking text in one message opens a small bar
 * (reply · voice · thread); "reply" opens an answer field anchored under the
 * passage. The passage stays painted while the field is open, because the
 * native selection goes away as soon as the field takes focus.
 */
export const SelectionReplyLayer = ({
	children,
	authorFor,
	onAddToComposer,
	onSendNow,
	onStartThread,
	onReplyInSideRoom,
	collectedCount,
	voiceInToolbar = true,
	canReplyHere = true,
	menu = 'toolbar',
	badgeOn = 'bubble',
	stackIcon = 'count',
	focusComposer,
	recorder,
	onBlurPassage,
	onRemoveBlur,
	blurredByFor,
	enabled = true,
	className,
	initialSelection = null,
	initialMode,
	initialVoice,
	initialTarget = null,
	initialBlurTarget = null
}: SelectionReplyLayerProps) => {
	const layerRef = useRef<HTMLDivElement | null>(null);
	const toolbarRef = useRef<HTMLDivElement | null>(null);
	const handleRef = useRef<HTMLButtonElement | null>(null);
	const blurBarRef = useRef<HTMLDivElement | null>(null);
	const [blurTarget, setBlurTarget] = useState<BlurTarget | null>(null);
	// Half the bar's real width, so a wider bar (with "Blur") stays inside.
	const [toolbarHalf, setToolbarHalf] = useState(160);
	const [blurBarHalf, setBlurBarHalf] = useState(140);
	const popoverRef = useRef<HTMLDivElement | null>(null);
	const timerRef = useRef<number | null>(null);
	const [mode, setMode] = useState<Mode>(
		initialSelection ? initialMode || 'toolbar' : 'none'
	);
	const [draft, setDraft] = useState('');
	// The stop of a running take is async: the delivery after it must read
	// what is in the field THEN (edits made while it stopped included) and
	// which side chats are still open THEN, not the values of the click.
	const draftRef = useRef(draft);
	draftRef.current = draft;
	const finishingRef = useRef(false);
	const sideRoomsRef = useRef(onReplyInSideRoom);
	sideRoomsRef.current = onReplyInSideRoom;
	const [voice, setVoice] = useState<SelectionReplyVoice>(
		initialVoice || { mode: 'idle' }
	);
	const [startWithVoice, setStartWithVoice] = useState(false);
	const [target, setTarget] = useState<SideRoomTarget | null>(initialTarget);
	const [voiceError, setVoiceError] = useState(false);
	// Each start/stop/discard/close bumps this; a recorder call that finishes
	// after a newer one (or after the reply closed) is ignored.
	const voiceOpRef = useRef(0);
	const startPendingRef = useRef(false);
	// The last start's whole run, clean-up included. A start from a reply
	// that was closed meanwhile still cancels the recorder when it settles,
	// so the next take waits for that instead of being cancelled by it.
	const startSettlingRef = useRef<Promise<void> | null>(null);
	const voiceModeRef = useRef(voice.mode);
	voiceModeRef.current = voice.mode;
	const [popoverHeight, setPopoverHeight] = useState(160);
	const { selection, setSelection, clear } = useMessageSelection(layerRef, {
		enabled: enabled && mode !== 'popover',
		authorFor
	});
	const active = selection || initialSelection;

	// A selection handed in after mount (story presets) opens like a real one.
	useEffect(() => {
		if (initialSelection) {
			setMode(initialMode || 'toolbar');
			setTarget(initialTarget);
			if (initialVoice) {
				setVoice(initialVoice);
			}
		}
		// Only a new hand-in selection resets the mode.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialSelection]);

	useEffect(() => {
		if (selection) {
			// A scroll update of the open field keeps the field.
			setMode((current) => (current === 'popover' ? current : 'toolbar'));
		}
	}, [selection]);

	const stopTimer = () => {
		if (timerRef.current !== null) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
	};

	/** Ends any recording, also one whose start has not finished yet. */
	const abandonVoice = useCallback(() => {
		voiceOpRef.current += 1;
		stopTimer();
		if (voiceModeRef.current === 'recording' || startPendingRef.current) {
			recorder?.cancel();
		}
		startPendingRef.current = false;
	}, [recorder]);

	const reset = useCallback(() => {
		abandonVoice();
		setMode('none');
		setDraft('');
		setVoice({ mode: 'idle' });
		setVoiceError(false);
		setStartWithVoice(false);
		setTarget(null);
		clear();
	}, [clear, abandonVoice]);

	// Keep the passage painted while answering. A selection handed in
	// (no native selection behind it) is painted under the bar as well.
	useEffect(() => {
		const layer = layerRef.current;
		const paints =
			mode === 'popover' ||
			(mode === 'toolbar' && Boolean(initialSelection));
		if (!paints || !active || !layer) {
			return undefined;
		}
		if (mode === 'popover') {
			window.getSelection()?.removeAllRanges();
		}
		return paintLivePassage(
			ACTIVE_HIGHLIGHT,
			layer,
			active.passage,
			active.range
		);
	}, [mode, active, initialSelection]);

	// The bar belongs to the native selection: it goes when that goes.
	useEffect(() => {
		if (mode !== 'toolbar' || initialSelection) {
			return undefined;
		}
		const onSelectionChange = () => {
			if (window.getSelection()?.isCollapsed) {
				setMode('none');
				clear();
			}
		};
		document.addEventListener('selectionchange', onSelectionChange);
		return () =>
			document.removeEventListener('selectionchange', onSelectionChange);
	}, [mode, clear, initialSelection]);

	// Scrolling the timeline: the bar and the field follow the passage. The
	// bar closes once its passage leaves the visible band. It must not close
	// on any scroll: the real chat scrolls by itself right after a selection
	// (new rows, receipts keep it pinned to the newest message), which made
	// the bar flash and vanish.
	useEffect(() => {
		const layer = layerRef.current;
		if (!layer || mode === 'none' || !active) {
			return undefined;
		}
		const onScroll = () => {
			const range =
				livePassageRange(layer, active.passage, active.range) ||
				active.range;
			const anchor = anchorFor(range.getBoundingClientRect(), layer);
			if (
				mode === 'toolbar' &&
				!initialSelection &&
				(anchor.bottom < anchor.visibleTop ||
					anchor.top > anchor.visibleBottom)
			) {
				setMode('none');
				clear();
				return;
			}
			setSelection({ ...active, range, anchor });
		};
		// Captured on the document: the timeline may scroll in the layer or
		// in an ancestor (anchorFor measures against scrollParentOf(layer)).
		document.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		return () => {
			document.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onScroll);
		};
	}, [mode, active, clear, setSelection, initialSelection]);

	// Pointer down elsewhere: the bar closes; an empty field closes too.
	useEffect(() => {
		if (mode === 'none') {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				toolbarRef.current?.contains(target) ||
				handleRef.current?.contains(target) ||
				popoverRef.current?.contains(target)
			) {
				return;
			}
			if (
				mode === 'toolbar' ||
				(!draft.trim() && voice.mode === 'idle')
			) {
				reset();
			}
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		return () =>
			document.removeEventListener('pointerdown', onPointerDown, true);
	}, [mode, draft, voice.mode, reset]);

	// Leaving the chat ends a recording, also one still starting.
	const abandonVoiceRef = useRef(abandonVoice);
	abandonVoiceRef.current = abandonVoice;
	useEffect(() => () => abandonVoiceRef.current(), []);

	// The field grows with a voice note; measure it to place it.
	useLayoutEffect(() => {
		const element = popoverRef.current;
		if (mode !== 'popover' || !element) {
			return undefined;
		}
		const measure = () => setPopoverHeight(element.offsetHeight);
		measure();
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [mode]);

	const startVoice = useCallback(async () => {
		// A second press while the microphone starts would race the first.
		if (!recorder || startPendingRef.current) {
			return;
		}
		voiceOpRef.current += 1;
		const op = voiceOpRef.current;
		setVoiceError(false);
		startPendingRef.current = true;
		const previous = startSettlingRef.current;
		let stream: MediaStream | null = null;
		const run = (async () => {
			if (previous) {
				await previous;
				if (op !== voiceOpRef.current) {
					// Closed again while the earlier start settled.
					return false;
				}
			}
			try {
				stream = (await recorder.start()) || null;
			} catch {
				if (op === voiceOpRef.current) {
					startPendingRef.current = false;
					setVoice({ mode: 'idle' });
					setVoiceError(true);
				}
				return false;
			}
			if (op !== voiceOpRef.current) {
				// Closed or discarded while the microphone was starting.
				recorder.cancel();
				return false;
			}
			return true;
		})();
		const settling = run.then(() => {
			if (startSettlingRef.current === settling) {
				startSettlingRef.current = null;
			}
		});
		startSettlingRef.current = settling;
		if (!(await run)) {
			return;
		}
		startPendingRef.current = false;
		setVoice({ mode: 'recording', durationSec: 0, stream });
		stopTimer();
		timerRef.current = window.setInterval(() => {
			setVoice((current) =>
				current.mode === 'recording' && !current.paused
					? {
							...current,
							durationSec: current.durationSec + 1
						}
					: current
			);
		}, 1000);
	}, [recorder]);

	const stopVoice = useCallback(async (): Promise<{
		src: string;
		durationSec: number;
	} | null> => {
		if (!recorder) {
			return null;
		}
		stopTimer();
		voiceOpRef.current += 1;
		const op = voiceOpRef.current;
		let take: { src: string; durationSec: number };
		try {
			take = await recorder.stop();
		} catch {
			if (op === voiceOpRef.current) {
				recorder.cancel();
				setVoice({ mode: 'idle' });
				setVoiceError(true);
			}
			return null;
		}
		// A take that arrives after a discard or close stays discarded.
		if (op === voiceOpRef.current) {
			setVoice({ mode: 'review', ...take });
			return take;
		}
		return null;
	}, [recorder]);

	// FE#2494: Pause holds the take; the same button records on.
	const togglePauseVoice = useCallback(() => {
		setVoice((current) => {
			if (current.mode !== 'recording') {
				return current;
			}
			if (current.paused) {
				recorder?.resume?.();
			} else {
				recorder?.pause?.();
			}
			return { ...current, paused: !current.paused };
		});
	}, [recorder]);

	const discardVoice = useCallback(() => {
		abandonVoice();
		setVoice({ mode: 'idle' });
		setVoiceError(false);
	}, [abandonVoice]);

	const openPopover = (withVoice: boolean) => {
		setMode('popover');
		setStartWithVoice(withVoice);
		if (withVoice) {
			void startVoice();
		}
	};

	const answer = (
		take?: { src: string; durationSec: number } | null
	): SelectionAnswer | null =>
		active
			? {
					passage: active.passage,
					text: draftRef.current.trim(),
					voice:
						take ??
						(voice.mode === 'review'
							? { src: voice.src, durationSec: voice.durationSec }
							: null)
				}
			: null;

	/**
	 * FE#2494 (Frank, 24 Nov): stacking or sending while recording first
	 * stops the take cleanly, then goes on with it — no extra Stop click.
	 */
	const withFinishedTake = async (
		deliver: (next: SelectionAnswer) => void
	) => {
		if (voice.mode === 'recording') {
			// A second Send/Stack while the take still stops would stop it
			// twice and could deliver an empty take: one delivery at a time.
			if (finishingRef.current) {
				return;
			}
			finishingRef.current = true;
			let take: Awaited<ReturnType<typeof stopVoice>>;
			try {
				take = await stopVoice();
			} finally {
				finishingRef.current = false;
			}
			if (!take) {
				// Finishing the take failed (or it was discarded meanwhile):
				// keep the draft and the error, never send text alone.
				return;
			}
			const next = answer(take);
			if (next && (next.text || next.voice)) {
				deliver(next);
			}
			return;
		}
		const next = answer();
		if (next) {
			deliver(next);
		}
	};

	// Leaving the answer field unmounts it; focus must not fall to the
	// page. It goes back to the marked message, a stable place in the
	// conversation for keyboard and screen-reader users.
	const focusMessage = useCallback((eventId: string | undefined) => {
		const layer = layerRef.current;
		const bubble =
			eventId && layer ? findMessageBubble(layer, eventId) : null;
		if (!bubble) {
			return;
		}
		if (!bubble.hasAttribute('tabindex')) {
			bubble.setAttribute('tabindex', '-1');
		}
		bubble.focus({ preventScroll: true });
	}, []);

	const focusSourceMessage = () => focusMessage(active?.passage.eventId);

	const closeAnswer = () => {
		focusSourceMessage();
		reset();
	};

	const addToComposer = () =>
		withFinishedTake((next) => {
			const side = target && sideRoomsRef.current?.[target];
			if (side) {
				side.onCollect(next);
			} else if (!target && canReplyHere) {
				// A side chat that closed while the answer was drafted
				// (Team-Chat closed) is no reason to send it to the advice
				// seeker: the draft stays.
				onAddToComposer(next);
			} else {
				return;
			}
			focusComposer?.();
			reset();
		});

	const sendNow = () =>
		withFinishedTake((next) => {
			if (!next.text && !next.voice) {
				return;
			}
			const side = target && sideRoomsRef.current?.[target];
			if (side) {
				side.onSend(next);
			} else if (!target && canReplyHere) {
				// A side chat that closed while the answer was drafted
				// (Team-Chat closed) is no reason to send it to the advice
				// seeker: the draft stays.
				onSendNow(next);
			} else {
				return;
			}
			focusComposer?.();
			reset();
		});

	const blurPassage = () => {
		const layer = layerRef.current;
		if (!active || !layer || !onBlurPassage) {
			return;
		}
		const bubble = findMessageBubble(layer, active.passage.eventId);
		// The kept range dies when the bubble re-renders; find it again.
		const range =
			livePassageRange(layer, active.passage, active.range) ||
			active.range;
		const position = bubble && passageBlurFromRange(bubble, range);
		if (position) {
			onBlurPassage(active.passage, position);
		}
		window.getSelection()?.removeAllRanges();
		reset();
	};

	// Where the pieces of blur `blurId` sit now, or null when they are gone.
	const measureBlur = useCallback((eventId: string, blurId: string) => {
		const layer = layerRef.current;
		if (!layer) {
			return null;
		}
		// Several pieces of one blur: anchor on all of them.
		const pieces = Array.from(
			layer.querySelectorAll<HTMLElement>(
				`[data-message-id="${CSS.escape(eventId)}"] [data-passage-blur-id="${CSS.escape(blurId)}"]`
			)
		);
		if (!pieces.length) {
			return null;
		}
		const rects = pieces.map((piece) => piece.getBoundingClientRect());
		const left = Math.min(...rects.map((rect) => rect.left));
		const top = Math.min(...rects.map((rect) => rect.top));
		const box = new DOMRect(
			left,
			top,
			Math.max(...rects.map((rect) => rect.right)) - left,
			Math.max(...rects.map((rect) => rect.bottom)) - top
		);
		return anchorFor(box, layer);
	}, []);

	const openBlurBar = useCallback(
		(span: HTMLElement) => {
			const eventId =
				span.closest<HTMLElement>('[data-message-id]')?.dataset
					.messageId;
			const blurId = span.dataset.passageBlurId;
			const anchor = eventId && blurId && measureBlur(eventId, blurId);
			if (eventId && blurId && anchor) {
				setBlurTarget({ eventId, blurId, anchor });
			}
		},
		[measureBlur]
	);

	// Story hook: open on a blurred passage once the rows have settled.
	useEffect(() => {
		if (!initialBlurTarget) {
			return undefined;
		}
		const timer = window.setTimeout(() => {
			const span = layerRef.current?.querySelector<HTMLElement>(
				`[data-message-id="${CSS.escape(initialBlurTarget.eventId)}"] [data-passage-blur-id="${CSS.escape(initialBlurTarget.blurId)}"]`
			);
			if (span) {
				span.scrollIntoView({ block: 'center' });
				openBlurBar(span);
			}
		}, 1000);
		return () => window.clearTimeout(timer);
	}, [initialBlurTarget, openBlurBar]);

	// The moderator's bar closes on a pointer down elsewhere or Esc. On a
	// scroll it follows its passage, and closes once the passage leaves the
	// visible band: the timeline also scrolls by itself (focus, new rows).
	const blurEventId = blurTarget?.eventId;
	const blurId = blurTarget?.blurId;
	useEffect(() => {
		if (!blurEventId || !blurId) {
			return undefined;
		}
		const close = () => setBlurTarget(null);
		const follow = () => {
			const anchor = measureBlur(blurEventId, blurId);
			if (
				!anchor ||
				anchor.bottom < anchor.visibleTop ||
				anchor.top > anchor.visibleBottom
			) {
				close();
				return;
			}
			setBlurTarget((current) =>
				current?.eventId === blurEventId && current.blurId === blurId
					? { ...current, anchor }
					: current
			);
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element;
			if (
				blurBarRef.current?.contains(target) ||
				target.closest?.('.passageBlur--removable')
			) {
				return;
			}
			close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') {
				return;
			}
			// Leaving from inside the bar: back to the blurred passage it
			// opened on, so the keyboard keeps its place.
			if (blurBarRef.current?.contains(document.activeElement)) {
				const span = layerRef.current?.querySelector<HTMLElement>(
					`[data-message-id="${CSS.escape(blurEventId)}"] [data-passage-blur-id="${CSS.escape(blurId)}"]`
				);
				if (span) {
					span.focus({ preventScroll: true });
				} else {
					focusMessage(blurEventId);
				}
			}
			close();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		// Captured on the document, like the selection bar's scroll above.
		document.addEventListener('scroll', follow, true);
		window.addEventListener('resize', follow);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('scroll', follow, true);
			window.removeEventListener('resize', follow);
		};
	}, [blurEventId, blurId, measureBlur, focusMessage]);

	const blurSpanOf = (target: EventTarget | null) =>
		onRemoveBlur && target instanceof Element
			? target.closest<HTMLElement>('.passageBlur--removable')
			: null;

	const onLayerClick = (event: React.MouseEvent) => {
		const span = blurSpanOf(event.target);
		if (span) {
			event.preventDefault();
			openBlurBar(span);
		}
	};

	const onLayerKeyDown = (event: React.KeyboardEvent) => {
		const span = blurSpanOf(event.target);
		if (span && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			openBlurBar(span);
		}
	};

	const removeBlur = () => {
		if (blurTarget && onRemoveBlur) {
			// The blurred passage goes with the blur: focus its message.
			focusMessage(blurTarget.eventId);
			onRemoveBlur(blurTarget.eventId, blurTarget.blurId);
		}
		setBlurTarget(null);
	};

	const replyInSideRoom = (room: SideRoomTarget) => {
		if (active && onReplyInSideRoom?.[room]) {
			setTarget(room);
			openPopover(false);
		}
	};

	const startThread = () => {
		if (active && onStartThread) {
			onStartThread(active.passage);
			window.getSelection()?.removeAllRanges();
			reset();
		}
	};

	useLayoutEffect(() => {
		const width = blurBarRef.current?.offsetWidth;
		if (blurTarget && width) {
			setBlurBarHalf(Math.ceil(width / 2));
		}
	}, [blurTarget]);

	useLayoutEffect(() => {
		const width = toolbarRef.current?.offsetWidth;
		if (mode === 'toolbar' && width) {
			setToolbarHalf(Math.ceil(width / 2));
		}
	}, [mode, active]);

	const { t: translate } = useTranslation();
	const anchor = active?.anchor;
	// The bubble opens this chat's answer field before a destination is
	// chosen; without a right to write here only the bar is offered, which
	// names the side chats only.
	const isBubble = menu === 'bubble' && canReplyHere;
	const HANDLE_SIZE = 32;
	// The handle sits right after the end of the marked text (its last
	// line), so it never covers words.
	const lastLine = (() => {
		const layer = layerRef.current;
		const rects = active?.range?.getClientRects();
		if (!isBubble || !layer || !rects || rects.length === 0) {
			return null;
		}
		const box = layer.getBoundingClientRect();
		const last = rects[rects.length - 1];
		return {
			right: last.right - box.left,
			middle: last.top - box.top + last.height / 2
		};
	})();
	const handleLeft = anchor
		? clamp(
				(lastLine?.right ?? anchor.right ?? anchor.centerX) + 4,
				EDGE,
				anchor.layerWidth - HANDLE_SIZE - EDGE
			)
		: 0;
	const handleTop = anchor
		? (lastLine?.middle ?? anchor.top) - HANDLE_SIZE / 2
		: 0;
	const popoverLeft = anchor
		? clamp(
				isBubble
					? handleLeft + HANDLE_SIZE - POPOVER_WIDTH
					: anchor.centerX - POPOVER_WIDTH / 2,
				EDGE,
				anchor.layerWidth - POPOVER_WIDTH - EDGE
			)
		: 0;
	const bubbleActions = isBubble ? (
		<>
			{onReplyInSideRoom?.supervision && (
				<ToolbarAction
					withLabel
					label={translate(
						'message.selectionReply.replyInSupervision'
					)}
					icon={
						<SupervisionIcon
							aria-hidden
							className="selectionReply__sideRoomIcon"
						/>
					}
					onClick={() => replyInSideRoom('supervision')}
					dataCy="selection-reply-supervision"
				/>
			)}
			{onReplyInSideRoom?.team && (
				<ToolbarAction
					withLabel
					label={translate('message.selectionReply.replyInTeam')}
					icon={
						<TeamChatIcon
							aria-hidden
							className="selectionReply__sideRoomIcon"
						/>
					}
					onClick={() => replyInSideRoom('team')}
					dataCy="selection-reply-team"
				/>
			)}
			{onStartThread && (
				<ToolbarAction
					withLabel
					label={translate('message.selectionReply.startThread')}
					icon={
						<ThreadEntryIcon
							aria-hidden
							className="selectionReply__threadIcon"
						/>
					}
					onClick={startThread}
				/>
			)}
			{onBlurPassage && (
				<ToolbarAction
					withLabel
					label={translate('message.selectionReply.blur')}
					icon={
						<BlurIcon
							aria-hidden
							className="selectionReply__blurIcon"
						/>
					}
					onClick={blurPassage}
					dataCy="selection-blur"
				/>
			)}
		</>
	) : undefined;
	// Above the passage when it fits in the visible band, else below it.
	const toolbarTop = anchor
		? anchor.top - TOOLBAR_HEIGHT - TOOLBAR_GAP < anchor.visibleTop
			? anchor.bottom + TOOLBAR_GAP
			: anchor.top - TOOLBAR_HEIGHT - TOOLBAR_GAP
		: 0;
	// Below the passage when it fits above the composer, else above it.
	const popoverTop = anchor
		? anchor.bottom + TOOLBAR_GAP + popoverHeight <=
				anchor.visibleBottom - EDGE ||
			anchor.top - TOOLBAR_GAP - popoverHeight < anchor.visibleTop
			? anchor.bottom + TOOLBAR_GAP
			: anchor.top - TOOLBAR_GAP - popoverHeight
		: 0;

	return (
		<div
			ref={layerRef}
			className={['selectionReply', className].filter(Boolean).join(' ')}
			data-cy="selection-reply-layer"
			onClick={onLayerClick}
			onKeyDown={onLayerKeyDown}
		>
			{children}
			{anchor && mode === 'toolbar' && isBubble && (
				<button
					type="button"
					className="selectionReply__handle"
					ref={handleRef}
					data-cy="selection-reply-handle"
					style={{
						top: handleTop,
						left: handleLeft
					}}
					aria-label={translate('message.selectionReply.toolbar')}
					title={translate('message.selectionReply.reply')}
					// Keep the native selection while it is pressed.
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => openPopover(false)}
				>
					<ReplyBubbleIcon aria-hidden />
				</button>
			)}
			{anchor && mode === 'toolbar' && !isBubble && (
				<SelectionReplyToolbar
					ref={toolbarRef}
					style={{
						top: toolbarTop,
						left: clamp(
							anchor.centerX,
							EDGE + toolbarHalf,
							anchor.layerWidth - EDGE - toolbarHalf
						)
					}}
					showVoice={Boolean(recorder) && voiceInToolbar}
					showThread={Boolean(onStartThread)}
					onReplyInSupervision={
						onReplyInSideRoom?.supervision
							? () => replyInSideRoom('supervision')
							: undefined
					}
					onReplyInTeam={
						onReplyInSideRoom?.team
							? () => replyInSideRoom('team')
							: undefined
					}
					onReply={
						canReplyHere ? () => openPopover(false) : undefined
					}
					onReplyWithVoice={() => openPopover(true)}
					onStartThread={startThread}
					onBlur={onBlurPassage ? blurPassage : undefined}
				/>
			)}
			{blurTarget && onRemoveBlur && (
				<PassageBlurBar
					ref={blurBarRef}
					style={{
						top:
							blurTarget.anchor.top -
								TOOLBAR_HEIGHT -
								TOOLBAR_GAP <
							blurTarget.anchor.visibleTop
								? blurTarget.anchor.bottom + TOOLBAR_GAP
								: blurTarget.anchor.top -
									TOOLBAR_HEIGHT -
									TOOLBAR_GAP,
						left: clamp(
							blurTarget.anchor.centerX,
							EDGE + blurBarHalf,
							blurTarget.anchor.layerWidth - EDGE - blurBarHalf
						)
					}}
					blurredBy={blurredByFor?.(
						blurTarget.eventId,
						blurTarget.blurId
					)}
					onRemove={removeBlur}
				/>
			)}
			{anchor && active && mode === 'popover' && (
				<SelectionReplyPopover
					ref={popoverRef}
					passage={active.passage}
					style={
						{
							'top': popoverTop,
							'left': popoverLeft,
							'--bubble-tail-x': `${Math.max(
								16,
								Math.min(
									POPOVER_WIDTH - 28,
									handleLeft +
										HANDLE_SIZE / 2 -
										popoverLeft -
										6
								)
							)}px`
						} as React.CSSProperties
					}
					bubble={
						isBubble
							? anchor && popoverTop < anchor.top
								? 'above'
								: 'below'
							: false
					}
					// Choosing a side chat already happened: the bubble then
					// shows only the field for that chat.
					actions={target ? undefined : bubbleActions}
					badgeOn={badgeOn}
					stackIcon={stackIcon}
					targetBadge={
						target === 'supervision'
							? {
									label: translate(
										'message.selectionReply.replyInSupervision'
									),
									short: translate('supervision.panel.title'),
									icon: <SupervisionIcon />,
									kind: 'supervision'
								}
							: target === 'team'
								? {
										label: translate(
											'message.selectionReply.replyInTeam'
										),
										short: translate(
											'chatStage.panel.team.title'
										),
										icon: <TeamChatIcon />,
										kind: 'team'
									}
								: undefined
					}
					collectedCount={collectedCount?.(target) ?? 0}
					draft={draft}
					onDraftChange={setDraft}
					voice={voice}
					voiceError={voiceError}
					showVoice={Boolean(recorder)}
					onStartVoice={() => void startVoice()}
					onStopVoice={() => void stopVoice()}
					onPauseVoice={
						recorder?.pause ? togglePauseVoice : undefined
					}
					onDiscardVoice={discardVoice}
					onAddToComposer={addToComposer}
					onSendNow={sendNow}
					onClose={closeAnswer}
					autoFocus={!startWithVoice}
				/>
			)}
		</div>
	);
};
