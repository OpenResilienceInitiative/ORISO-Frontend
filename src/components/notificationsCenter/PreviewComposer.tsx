import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatTransportService } from '../../services/chatTransportService';
import { getPreviewDraft, setPreviewDraft } from './previewDraftStore';

/** What the composer is doing besides writing a new message. */
export type PreviewComposerContext =
	| { kind: 'reply'; eventId: string; author: string; text: string }
	| { kind: 'edit'; eventId: string; text: string }
	| null;

/**
 * #1824: the preview's reply field. Owns the draft, so a keystroke re-renders
 * this component and not the message rows above it. The draft belongs to the
 * conversation (room + thread); an edit works on the message's own transport
 * markup, so formatting survives the round trip. The typing indicator (D3)
 * always ends with the room, the thread or the component.
 */
export const PreviewComposer = ({
	roomId,
	threadRootId,
	context,
	busy,
	failed,
	onCancelContext,
	onSend,
	onEdit
}: {
	roomId: string;
	threadRootId?: string | null;
	context: PreviewComposerContext;
	busy: boolean;
	failed: boolean;
	onCancelContext: () => void;
	onSend: (
		message: string,
		replyToEventId: string | null
	) => Promise<boolean>;
	onEdit: (eventId: string, message: string) => Promise<boolean>;
}) => {
	const { t: translate } = useTranslation();
	const label = (key: string) =>
		translate(`notifications.center.preview.${key}`);
	const [draft, setDraft] = useState(() =>
		getPreviewDraft(roomId, threadRootId)
	);
	const [editText, setEditText] = useState<string | null>(null);
	const typingInRoom = useRef<string | null>(null);
	const editing = context?.kind === 'edit';

	const stopTyping = () => {
		if (typingInRoom.current) {
			void chatTransportService
				.sendTyping(typingInRoom.current, false)
				?.catch?.(() => undefined);
			typingInRoom.current = null;
		}
	};

	// A new conversation is a new composer: load its draft, end typing in the
	// old room.
	useEffect(() => {
		setDraft(getPreviewDraft(roomId, threadRootId));
		return stopTyping;
	}, [roomId, threadRootId]);

	// An edit works on its own text and leaves the draft untouched.
	useEffect(() => {
		setEditText(context?.kind === 'edit' ? context.text : null);
	}, [context]);

	const value = editing ? (editText ?? '') : draft;

	const update = (next: string) => {
		if (editing) {
			setEditText(next);
			return;
		}
		setDraft(next);
		setPreviewDraft(roomId, threadRootId, next);
		const typing = next.trim().length > 0;
		if (typing && typingInRoom.current !== roomId) {
			typingInRoom.current = roomId;
			void chatTransportService
				.sendTyping(roomId, true)
				?.catch?.(() => undefined);
		} else if (!typing) {
			stopTyping();
		}
	};

	const submit = async () => {
		const message = value.trim();
		if (!message || busy) {
			return;
		}
		if (context?.kind === 'edit') {
			if (await onEdit(context.eventId, message)) {
				onCancelContext();
			}
			return;
		}
		const sent = await onSend(
			message,
			context?.kind === 'reply' ? context.eventId : null
		);
		if (sent) {
			setPreviewDraft(roomId, threadRootId, '');
			setDraft('');
			stopTyping();
			onCancelContext();
		}
	};

	return (
		<form
			className="conversationPreview__composer"
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			{context && (
				<div className="conversationPreview__context">
					<span className="conversationPreview__contextLabel">
						{context.kind === 'edit'
							? label('editLabel')
							: context.author}
					</span>
					{context.kind === 'reply' && (
						<span className="conversationPreview__contextText">
							{context.text}
						</span>
					)}
					<button
						type="button"
						className="conversationPreview__button"
						onClick={onCancelContext}
					>
						{label('cancelEdit')}
					</button>
				</div>
			)}
			<textarea
				className="conversationPreview__input"
				rows={2}
				value={value}
				aria-label={label('inputLabel')}
				onChange={(event) => update(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						void submit();
					}
				}}
			/>
			<button
				type="submit"
				className="conversationPreview__button conversationPreview__send"
				disabled={busy || value.trim().length === 0}
			>
				{label(editing ? 'saveEdit' : 'send')}
			</button>
			{failed && (
				<p role="alert" className="conversationPreview__error">
					{label('sendFailed')}
				</p>
			)}
		</form>
	);
};
