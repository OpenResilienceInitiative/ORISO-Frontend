import * as React from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MicIcon from '@mui/icons-material/Mic';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

import { VoiceNoteRow } from '../voicePlayer/VoiceNoteRow';
import { SendButton } from '../messageSubmitInterface/inputField/SendButton';
import { ReplyArrowIcon } from './ReplyArrowIcon';
import type { MarkedPassage } from './useMessageSelection';

export type SelectionReplyVoice =
	| { mode: 'idle' }
	| { mode: 'recording'; durationSec: number }
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
	onDiscardVoice: () => void;
	/** Enter: the answer goes into the composer as its own reply bar. */
	onAddToComposer: () => void;
	/** Cmd/Ctrl + Enter: the answer is sent right away. */
	onSendNow: () => void;
	onClose: () => void;
	/** Focus the text field on open (off when the take starts with voice). */
	autoFocus?: boolean;
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
			onDiscardVoice,
			onAddToComposer,
			onSendNow,
			onClose,
			autoFocus = true
		},
		ref
	) => {
		const { t: translate } = useTranslation();
		const inputRef = useRef<HTMLInputElement | null>(null);
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
		const sendKey = isMacLike() ? '⌘' : 'Strg';
		const hasAnswer = Boolean(draft.trim()) || voice.mode === 'review';
		const isRecording = voice.mode === 'recording';

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

		const addLabel = translate('message.selectionReply.addToComposer');

		return (
			<div
				ref={setRoot}
				role="dialog"
				tabIndex={-1}
				aria-label={translate('message.selectionReply.dialog', {
					author: passage.author
				})}
				className="selectionReply__popover"
				data-cy="selection-reply-popover"
				style={style}
				onKeyDown={handleKeyDown}
			>
				<div className="selectionReply__quote">
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
				{voice.mode === 'recording' && (
					<VoiceNoteRow
						mode="recording"
						durationSec={voice.durationSec}
						onStop={onStopVoice}
						onDiscard={onDiscardVoice}
					/>
				)}
				{voice.mode === 'review' && (
					<VoiceNoteRow
						mode="review"
						src={voice.src}
						durationSec={voice.durationSec}
						onDiscard={onDiscardVoice}
					/>
				)}

				<div className="selectionReply__inputRow">
					<input
						ref={inputRef}
						type="text"
						className="selectionReply__input"
						value={draft}
						onChange={(event) => onDraftChange(event.target.value)}
						placeholder={translate(
							voice.mode === 'review'
								? 'message.selectionReply.placeholderWithVoice'
								: 'message.selectionReply.placeholder'
						)}
						aria-label={translate(
							'message.selectionReply.inputLabel'
						)}
						disabled={isRecording}
						autoComplete="off"
					/>
					{showVoice && voice.mode === 'idle' && (
						<button
							type="button"
							className="selectionReply__iconButton"
							onClick={onStartVoice}
							aria-label={translate(
								'message.selectionReply.replyVoice'
							)}
							title={translate(
								'message.selectionReply.replyVoice'
							)}
						>
							<MicIcon fontSize="inherit" aria-hidden />
						</button>
					)}
					<span className="selectionReply__hintWrap">
						<button
							type="button"
							className="selectionReply__collect"
							data-cy="selection-reply-collect"
							onClick={onAddToComposer}
							disabled={isRecording}
							aria-label={addLabel}
							aria-describedby="selection-reply-keys"
							onMouseEnter={() => setHint('add')}
							onMouseLeave={() => setHint(null)}
							onFocus={() => setHint('add')}
							onBlur={() => setHint(null)}
						>
							<AddIcon fontSize="inherit" aria-hidden />
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
								isRecording
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
				</div>

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
