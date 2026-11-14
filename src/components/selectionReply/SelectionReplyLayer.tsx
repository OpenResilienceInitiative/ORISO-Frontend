import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

import { SelectionReplyToolbar } from './SelectionReplyToolbar';
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
	start: () => Promise<void> | void;
	stop: () => Promise<{ src: string; durationSec: number }>;
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
	recorder,
	onBlurPassage,
	onRemoveBlur,
	blurredByFor,
	enabled = true,
	className,
	initialSelection = null,
	initialMode,
	initialVoice,
	initialBlurTarget = null
}: SelectionReplyLayerProps) => {
	const layerRef = useRef<HTMLDivElement | null>(null);
	const toolbarRef = useRef<HTMLDivElement | null>(null);
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
	const [voice, setVoice] = useState<SelectionReplyVoice>(
		initialVoice || { mode: 'idle' }
	);
	const [startWithVoice, setStartWithVoice] = useState(false);
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

	// Scrolling the timeline: the bar closes, the field follows the passage.
	useEffect(() => {
		const layer = layerRef.current;
		if (!layer || mode === 'none' || !active) {
			return undefined;
		}
		const onScroll = () => {
			if (mode === 'toolbar' && !initialSelection) {
				setMode('none');
				clear();
				return;
			}
			const range =
				livePassageRange(layer, active.passage, active.range) ||
				active.range;
			setSelection({
				...active,
				range,
				anchor: anchorFor(range.getBoundingClientRect(), layer)
			});
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
		const run = (async () => {
			if (previous) {
				await previous;
				if (op !== voiceOpRef.current) {
					// Closed again while the earlier start settled.
					return false;
				}
			}
			try {
				await recorder.start();
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
		setVoice({ mode: 'recording', durationSec: 0 });
		stopTimer();
		timerRef.current = window.setInterval(() => {
			setVoice((current) =>
				current.mode === 'recording'
					? {
							mode: 'recording',
							durationSec: current.durationSec + 1
						}
					: current
			);
		}, 1000);
	}, [recorder]);

	const stopVoice = useCallback(async () => {
		if (!recorder) {
			return;
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
			return;
		}
		// A take that arrives after a discard or close stays discarded.
		if (op === voiceOpRef.current) {
			setVoice({ mode: 'review', ...take });
		}
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

	const answer = (): SelectionAnswer | null =>
		active
			? {
					passage: active.passage,
					text: draft.trim(),
					voice:
						voice.mode === 'review'
							? { src: voice.src, durationSec: voice.durationSec }
							: null
				}
			: null;

	const addToComposer = () => {
		const next = answer();
		if (next) {
			onAddToComposer(next);
			reset();
		}
	};

	const sendNow = () => {
		const next = answer();
		if (next && (next.text || next.voice)) {
			onSendNow(next);
			reset();
		}
	};

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

	const openBlurBar = useCallback((span: HTMLElement) => {
		const layer = layerRef.current;
		const eventId =
			span.closest<HTMLElement>('[data-message-id]')?.dataset.messageId;
		const blurId = span.dataset.passageBlurId;
		if (!layer || !eventId || !blurId) {
			return;
		}
		// Several pieces of one blur: anchor on all of them.
		const pieces = Array.from(
			layer.querySelectorAll<HTMLElement>(
				`[data-message-id="${CSS.escape(eventId)}"] [data-passage-blur-id="${CSS.escape(blurId)}"]`
			)
		);
		const rects = (pieces.length ? pieces : [span]).map((piece) =>
			piece.getBoundingClientRect()
		);
		const box = new DOMRect(
			Math.min(...rects.map((rect) => rect.left)),
			Math.min(...rects.map((rect) => rect.top)),
			Math.max(...rects.map((rect) => rect.right)) -
				Math.min(...rects.map((rect) => rect.left)),
			Math.max(...rects.map((rect) => rect.bottom)) -
				Math.min(...rects.map((rect) => rect.top))
		);
		setBlurTarget({ eventId, blurId, anchor: anchorFor(box, layer) });
	}, []);

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

	// The moderator's bar closes on a pointer down elsewhere, Esc or scroll.
	useEffect(() => {
		if (!blurTarget) {
			return undefined;
		}
		const close = () => setBlurTarget(null);
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
			if (event.key === 'Escape') close();
		};
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		// Captured on the document, like the selection bar's scroll above.
		document.addEventListener('scroll', close, true);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('scroll', close, true);
		};
	}, [blurTarget]);

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
			onRemoveBlur(blurTarget.eventId, blurTarget.blurId);
		}
		setBlurTarget(null);
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

	const anchor = active?.anchor;
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
			{anchor && mode === 'toolbar' && (
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
					showVoice={Boolean(recorder)}
					showThread={Boolean(onStartThread)}
					onReply={() => openPopover(false)}
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
					style={{
						top: popoverTop,
						left: clamp(
							anchor.centerX - POPOVER_WIDTH / 2,
							EDGE,
							anchor.layerWidth - POPOVER_WIDTH - EDGE
						)
					}}
					draft={draft}
					onDraftChange={setDraft}
					voice={voice}
					voiceError={voiceError}
					showVoice={Boolean(recorder)}
					onStartVoice={() => void startVoice()}
					onStopVoice={() => void stopVoice()}
					onDiscardVoice={discardVoice}
					onAddToComposer={addToComposer}
					onSendNow={sendNow}
					onClose={reset}
					autoFocus={!startWithVoice}
				/>
			)}
		</div>
	);
};
