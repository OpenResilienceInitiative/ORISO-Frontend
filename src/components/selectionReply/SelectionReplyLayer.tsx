import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

import { SelectionReplyToolbar } from './SelectionReplyToolbar';
import {
	SelectionReplyPopover,
	type SelectionReplyVoice
} from './SelectionReplyPopover';
import {
	anchorFor,
	useMessageSelection,
	type MarkedPassage,
	type MessageSelection
} from './useMessageSelection';
import {
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
	enabled?: boolean;
	className?: string;
	/** Story hook: open with this selection already made. */
	initialSelection?: MessageSelection | null;
	initialMode?: 'toolbar' | 'popover';
	/** Story hook: the answer field opens in this voice state. */
	initialVoice?: SelectionReplyVoice;
}

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
	enabled = true,
	className,
	initialSelection = null,
	initialMode,
	initialVoice
}: SelectionReplyLayerProps) => {
	const layerRef = useRef<HTMLDivElement | null>(null);
	const toolbarRef = useRef<HTMLDivElement | null>(null);
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

	const reset = useCallback(() => {
		stopTimer();
		if (voice.mode === 'recording') {
			recorder?.cancel();
		}
		setMode('none');
		setDraft('');
		setVoice({ mode: 'idle' });
		setStartWithVoice(false);
		clear();
	}, [clear, recorder, voice.mode]);

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
		layer.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		return () => {
			layer.removeEventListener('scroll', onScroll, true);
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

	useEffect(() => () => stopTimer(), []);

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
		if (!recorder) {
			return;
		}
		await recorder.start();
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
		const take = await recorder.stop();
		setVoice({ mode: 'review', ...take });
	}, [recorder]);

	const discardVoice = useCallback(() => {
		stopTimer();
		if (voice.mode === 'recording') {
			recorder?.cancel();
		}
		setVoice({ mode: 'idle' });
	}, [recorder, voice.mode]);

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

	const startThread = () => {
		if (active && onStartThread) {
			onStartThread(active.passage);
			window.getSelection()?.removeAllRanges();
			reset();
		}
	};

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
		>
			{children}
			{anchor && mode === 'toolbar' && (
				<SelectionReplyToolbar
					ref={toolbarRef}
					style={{
						top: toolbarTop,
						left: clamp(
							anchor.centerX,
							EDGE + 160,
							anchor.layerWidth - EDGE - 160
						)
					}}
					showVoice={Boolean(recorder)}
					showThread={Boolean(onStartThread)}
					onReply={() => openPopover(false)}
					onReplyWithVoice={() => openPopover(true)}
					onStartThread={startThread}
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
