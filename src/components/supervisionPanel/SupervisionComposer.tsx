/**
 * WP-B2 — the side-room composer. Deliberately small: one text field, one
 * send button, Enter sends, Shift+Enter breaks the line. It owns no
 * transport; `onSend` is the owner's promise (SessionItemComponent routes it
 * through `chatTransportService.sendTextMessage`, the same path as the main
 * composer, so Megolm encryption is the SDK's job — nothing is bypassed).
 */
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './supervisionPanel.styles.scss';

export interface SupervisionComposerProps {
	'counterpartName': string;
	'onSend': (text: string) => Promise<unknown> | unknown;
	'disabled'?: boolean;
	/** Give the field focus when the panel opens. */
	'autoFocus'?: boolean;
	'data-cy'?: string;
}

export const SupervisionComposer = ({
	counterpartName,
	onSend,
	disabled = false,
	autoFocus = false,
	'data-cy': dataCy = 'supervision-composer'
}: SupervisionComposerProps) => {
	const { t: translate } = useTranslation();
	const [text, setText] = useState('');
	const [sending, setSending] = useState(false);
	const [failed, setFailed] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);

	const canSend = !disabled && !sending && text.trim().length > 0;

	const submit = useCallback(async () => {
		const body = text.trim();
		if (!body || disabled || sending) {
			return;
		}
		setSending(true);
		setFailed(false);
		try {
			await onSend(body);
			setText('');
			inputRef.current?.focus();
		} catch {
			// Keep the text so the user can simply retry.
			setFailed(true);
		} finally {
			setSending(false);
		}
	}, [text, disabled, sending, onSend]);

	const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submit();
		}
	};

	const placeholder = translate('supervision.panel.composer.placeholder', {
		name: counterpartName
	});

	return (
		<form
			className="supervisionComposer"
			data-cy={dataCy}
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<textarea
				ref={inputRef}
				className="supervisionComposer__input"
				value={text}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				aria-label={placeholder}
				aria-invalid={failed || undefined}
				disabled={disabled}
				autoFocus={autoFocus}
				rows={1}
				data-cy="supervision-composer-input"
			/>
			<button
				type="submit"
				className="supervisionComposer__send"
				disabled={!canSend}
				data-cy="supervision-composer-send"
			>
				{translate('supervision.panel.composer.send')}
			</button>
			{failed && (
				<span
					className="supervisionComposer__error"
					role="alert"
					data-cy="supervision-composer-error"
				>
					{translate('supervision.panel.composer.failed')}
				</span>
			)}
		</form>
	);
};

export default SupervisionComposer;
