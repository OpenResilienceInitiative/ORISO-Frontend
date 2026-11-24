import * as React from 'react';
import {
	forwardRef,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';

import { VoiceNoteRow } from '../voicePlayer/VoiceNoteRow';
import { SendButton } from '../messageSubmitInterface/inputField/SendButton';
import { ReplyArrowIcon } from './ReplyArrowIcon';
import { ReactComponent as MicIcon } from '../../resources/img/icons/modality-audio-filled.svg';
import { ReactComponent as CollectIcon } from '../../resources/img/icons/reply-stack.svg';
import type { MarkedPassage } from './useMessageSelection';

export type SelectionReplyVoice =
	| { mode: 'idle' }
	| { mode: 'recording'; durationSec: number; paused?: boolean }
	| { mode: 'review'; src: string; durationSec: number };

export interface SelectionReplyPopoverProps {
	passage: MarkedPassage;
	style?: React.CSSProperties;
	draft: string;
	onDraftChange: (value: string) => void;
	voice: SelectionReplyVoice;
	/** The microphone could not start or the take could not be saved. */
	voiceError?: boolean;
	/** Hide the microphone where voice notes are off. */
	showVoice?: boolean;
	onStartVoice: () => void;
	onStopVoice: () => void;
	/** FE#2494: when given, the take is paused/resumed instead of stopped. */
	onPauseVoice?: () => void;
	onDiscardVoice: () => void;
	/** Enter: the answer goes into the composer as its own reply bar. */
	onAddToComposer: () => void;
	/** Cmd/Ctrl + Enter: the answer is sent right away. */
	onSendNow: () => void;
	onClose: () => void;
	/** Focus the text field on open (off when the take starts with voice). */
	autoFocus?: boolean;
	/**
	 * FE#2494 *7 bubble variant: the passage's other actions (side chats,
	 * thread, blur) as one row under the field.
	 */
	actions?: React.ReactNode;
	/**
	 * FE#2494 *7 bubble variant: drawn as a speech bubble from the handle,
	 * its tail on the side facing the passage.
	 */
	bubble?: false | 'below' | 'above';
	/**
	 * FE#2494 *7: the side chat this answer goes to — a badge attached on top
	 * of the bubble (icon + room), the full sentence as its accessible name.
	 */
	targetBadge?: {
		label: string;
		short: string;
		icon: React.ReactNode;
		/** Colours of that side room's own chip (Supervision / Team). */
		kind?: 'supervision' | 'team';
	};
	/**
	 * Where the badge hangs: on the bubble's edge, or (variant, Frank
	 * 24 Nov) on the grey quote, which saves the bubble's top spacing.
	 */
	badgeOn?: 'bubble' | 'quote' | 'bottom';
	/** Answers already stacked for that message; the stack shows the next number. */
	collectedCount?: number;
}

const isMacLike = () =>
	typeof navigator !== 'undefined' &&
	/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Answering one marked passage, right where it was marked: the passage as
 * the bubble quotes it, a one-line field, a voice note (no transcript), and
 * two ways out — into the composer (Enter) or straight to the chat
 * (Cmd/Ctrl + Enter).
 */
export const SelectionReplyPopover = forwardRef<
	HTMLDivElement,
	SelectionReplyPopoverProps
>(
	(
		{
			passage,
			style,
			draft,
			onDraftChange,
			voice,
			voiceError = false,
			showVoice = true,
			onStartVoice,
			onStopVoice,
			onPauseVoice,
			onDiscardVoice,
			onAddToComposer,
			onSendNow,
			onClose,
			autoFocus = true,
			actions,
			bubble = false,
			targetBadge,
			badgeOn = 'bubble',
			collectedCount = 0
		},
		ref
	) => {
		const { t: translate } = useTranslation();
		const inputRef = useRef<HTMLTextAreaElement | null>(null);
		const rootRef = useRef<HTMLDivElement | null>(null);
		const setRoot = (element: HTMLDivElement | null) => {
			rootRef.current = element;
			if (typeof ref === 'function') {
				ref(element);
			} else if (ref) {
				ref.current = element;
			}
		};
		const [hint, setHint] = useState<'add' | 'send' | null>(null);
		// FE#2494 (Frank): from the second line on, Stack sits above Send.
		const [multiline, setMultiline] = useState(false);
		const sendKey = isMacLike() ? '⌘' : 'Strg';
		const isRecording = voice.mode === 'recording';
		// FE#2494: stacking or sending a running take stops it first, so a
		// take counts as an answer once it has a second in it.
		const hasAnswer =
			Boolean(draft.trim()) ||
			voice.mode === 'review' ||
			(isRecording && voice.durationSec > 0);
		// A stand-in without pause keeps the old Stop; it must stay usable.
		const blockWhileRecording = isRecording && !onPauseVoice;
		const stacked = multiline;

		// The field grows with the answer, like the composer (up to 10 lines);
		// measured before paint so the text never flickers.
		useLayoutEffect(() => {
			const field = inputRef.current;
			if (!field) {
				return;
			}
			// Resetting the height to measure it throws away the scroll
			// position; keep it, or the caret falls out of view (Frank,
			// Shift+Enter on line 10).
			const scrollTop = field.scrollTop;
			field.style.height = 'auto';
			// FE#2494 (Frank): more room when writing — up to 10 lines, then
			// the field scrolls inside and keeps the caret in view.
			field.style.height = `${Math.min(field.scrollHeight, 10 * 20 + 16)}px`;
			field.scrollTop = scrollTop;
			// Typing at the end keeps the newest line in view.
			if (
				document.activeElement === field &&
				field.selectionEnd >= field.value.length
			) {
				field.scrollTop = field.scrollHeight;
			}
			// Hysteresis: once the answer wraps, Stack stays under Send until
			// the field is empty again. Otherwise the wider field unwraps the
			// line, the buttons move back, it wraps again — and words jump.
			if (!draft) {
				setMultiline(false);
			} else if (field.scrollHeight > 44) {
				setMultiline(true);
			}
		}, [draft, multiline]);

		useEffect(() => {
			if (autoFocus) {
				inputRef.current?.focus({ preventScroll: true });
			} else {
				// Opened for a voice reply: the bar that had focus is gone.
				// Keep focus in the dialog (so Escape still closes it)
				// without opening the phone keyboard on the text field.
				rootRef.current?.focus({ preventScroll: true });
			}
		}, [autoFocus]);

		// Each voice step unmounts the control that had focus (the mic,
		// Stop, Discard). Hand focus to what replaces it, as the composer
		// does: Stop while recording, the take under review, the mic again
		// after a discard. Never steal focus from outside the dialog.
		const lastVoiceModeRef = useRef<SelectionReplyVoice['mode'] | null>(
			null
		);
		useEffect(() => {
			const previous = lastVoiceModeRef.current;
			lastVoiceModeRef.current = voice.mode;
			const root = rootRef.current;
			if (!root || previous === voice.mode) {
				return;
			}
			// On first render only a running take needs it (autoFocus
			// covers the rest).
			if (previous === null && voice.mode !== 'recording') {
				return;
			}
			const active = document.activeElement;
			if (active && active !== document.body && !root.contains(active)) {
				return;
			}
			const target =
				voice.mode === 'recording'
					? root.querySelector<HTMLElement>('.voicePlayer__toggle')
					: voice.mode === 'review'
						? root.querySelector<HTMLElement>(
								'.voiceNoteRow[role="group"]'
							)
						: root.querySelector<HTMLElement>(
								'.selectionReply__iconButton'
							);
			(target ?? root).focus({ preventScroll: true });
		}, [voice.mode]);

		const handleKeyDown = (event: React.KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}
			// Enter shortcuts belong to the answer field only: on a button
			// (send, close, stop, voice player) Enter must keep activating it.
			if (
				event.key !== 'Enter' ||
				event.shiftKey ||
				event.target !== inputRef.current ||
				// Enter that confirms an input-method composition (IME) is
				// part of typing, not a reply action.
				event.nativeEvent.isComposing
			) {
				return;
			}
			event.preventDefault();
			if (isRecording) {
				return;
			}
			if (event.metaKey || event.ctrlKey) {
				if (hasAnswer) {
					onSendNow();
				}
				return;
			}
			onAddToComposer();
		};

		const badge = targetBadge ? (
			<p
				className={`selectionReply__target selectionReply__target--${
					targetBadge.kind ?? 'supervision'
				}`}
				data-cy="selection-reply-target"
				title={targetBadge.label}
			>
				<span className="selectionReply__targetIcon" aria-hidden="true">
					{targetBadge.icon}
				</span>
				<span aria-hidden="true">{targetBadge.short}</span>
				<span className="sr-only">{targetBadge.label}</span>
			</p>
		) : null;

		const addLabel = translate('message.selectionReply.addToComposer');

		return (
			<div
				ref={setRoot}
				role="dialog"
				tabIndex={-1}
				aria-label={translate('message.selectionReply.dialog', {
					author: passage.author
				})}
				className={[
					'selectionReply__popover',
					bubble && 'selectionReply__popover--bubble',
					bubble === 'above' && 'selectionReply__popover--above',
					targetBadge &&
						badgeOn === 'bubble' &&
						'selectionReply__popover--targeted',
					targetBadge &&
						badgeOn === 'quote' &&
						'selectionReply__popover--targetedQuote',
					targetBadge &&
						badgeOn === 'bottom' &&
						'selectionReply__popover--targetedBottom'
				]
					.filter(Boolean)
					.join(' ')}
				data-cy="selection-reply-popover"
				style={style}
				onKeyDown={handleKeyDown}
			>
				{(badgeOn === 'bubble' || badgeOn === 'bottom') && badge}
				<div className="selectionReply__quote">
					{badgeOn === 'quote' && badge}
					<ReplyArrowIcon className="selectionReply__quoteIcon" />
					<span className="selectionReply__quoteBody">
						<span className="selectionReply__quoteAuthor">
							{passage.author}
						</span>
						<span className="selectionReply__quoteText">
							{`„${passage.text}“`}
						</span>
					</span>
					<button
						type="button"
						className="selectionReply__close"
						onClick={onClose}
						aria-label={translate('message.selectionReply.cancel')}
						title={translate('message.selectionReply.cancel')}
					>
						<CloseIcon fontSize="inherit" />
					</button>
				</div>

				{voiceError && (
					<p role="alert" className="selectionReply__voiceError">
						{translate('voice.recording.error.headline')}.{' '}
						{translate('voice.recording.error.message')}
					</p>
				)}
				{/* FE#2494 (Frank, 24 Nov): one box like the chat's own composer —
				    accent frame, Send docked in the top-right corner; from the
				    second line on, Stack sits under Send. */}
				<div
					className={[
						'selectionReply__box',
						stacked ? 'selectionReply__box--stacked' : null,
						voice.mode !== 'idle'
							? 'selectionReply__box--withVoice'
							: null
					]
						.filter(Boolean)
						.join(' ')}
				>
					<textarea
						ref={inputRef}
						rows={1}
						className="selectionReply__input"
						value={draft}
						onChange={(event) => onDraftChange(event.target.value)}
						placeholder={translate(
							voice.mode === 'idle'
								? 'message.selectionReply.placeholder'
								: 'message.selectionReply.placeholderWithVoice'
						)}
						aria-label={translate(
							'message.selectionReply.inputLabel'
						)}
						autoComplete="off"
					/>
					{/* Writing already: the mic would only take the field's room. */}
					{showVoice && voice.mode === 'idle' && !draft.trim() && (
						<button
							type="button"
							className="selectionReply__iconButton selectionReply__fieldMic"
							onClick={onStartVoice}
							aria-label={translate(
								'message.selectionReply.replyVoice'
							)}
							title={translate(
								'message.selectionReply.replyVoice'
							)}
						>
							<MicIcon
								aria-hidden
								className="selectionReply__micIcon"
							/>
						</button>
					)}
					<span className="selectionReply__hintWrap">
						<button
							type="button"
							className="selectionReply__collect"
							data-cy="selection-reply-collect"
							onClick={onAddToComposer}
							disabled={blockWhileRecording}
							aria-label={addLabel}
							aria-describedby="selection-reply-keys"
							onMouseEnter={() => setHint('add')}
							onMouseLeave={() => setHint(null)}
							onFocus={() => setHint('add')}
							onBlur={() => setHint(null)}
						>
							<CollectIcon
								aria-hidden
								className="selectionReply__collectIcon"
							/>
							{collectedCount > 0 && (
								<span
									className="selectionReply__stackCount"
									data-cy="selection-reply-stack-count"
								>
									{collectedCount + 1}
								</span>
							)}
						</button>
						{hint === 'add' && (
							<span
								role="tooltip"
								className="selectionReply__keyHint"
							>
								<span>{addLabel}</span>
								<kbd>↵</kbd>
							</span>
						)}
					</span>
					<span
						className="selectionReply__hintWrap selectionReply__send"
						onMouseEnter={() => setHint('send')}
						onMouseLeave={() => setHint(null)}
						onFocus={() => setHint('send')}
						onBlur={() => setHint(null)}
					>
						<SendButton
							type="button"
							state={
								blockWhileRecording
									? 'disabled'
									: hasAnswer
										? 'ready'
										: 'empty'
							}
							onSend={onSendNow}
						/>
						{hint === 'send' && (
							<span
								role="tooltip"
								className="selectionReply__keyHint"
							>
								<span>
									{translate(
										'message.selectionReply.sendNow'
									)}
								</span>
								<kbd>{`${sendKey} ↵`}</kbd>
							</span>
						)}
					</span>
					{/* FE#2494 (Frank, 24 Nov): the voice note gets its own second
					    row across the box; the text field stays above it. */}
					{voice.mode === 'recording' ? (
						<VoiceNoteRow
							className="selectionReply__voiceField"
							mode="recording"
							durationSec={voice.durationSec}
							onStop={onStopVoice}
							onPause={onPauseVoice}
							paused={voice.paused}
							onDiscard={onDiscardVoice}
						/>
					) : voice.mode === 'review' ? (
						<VoiceNoteRow
							className="selectionReply__voiceField"
							mode="review"
							src={voice.src}
							durationSec={voice.durationSec}
							onDiscard={onDiscardVoice}
						/>
					) : null}
				</div>

				{actions && (
					<div
						className="selectionReply__bubbleActions"
						role="group"
						aria-label={translate('message.selectionReply.toolbar')}
					>
						{actions}
					</div>
				)}

				{/* Keys and Esc for screen readers; sighted users get them as
				    tooltips, and clicking beside the field closes it. */}
				<p className="sr-only" id="selection-reply-keys">
					{translate('message.selectionReply.keys', { sendKey })}
				</p>
			</div>
		);
	}
);

SelectionReplyPopover.displayName = 'SelectionReplyPopover';
