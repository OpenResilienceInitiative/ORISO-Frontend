import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { useDismissOnOutside } from './useDismissOnOutside';

/** The "Erstellen" chip of the conversation list: where focus returns to. */
export const CREATE_TRIGGER_SELECTOR =
	'[data-tour-target="groupchat-create-button"]';

interface CreateViewExitOptions {
	/** Input held outside the DOM fields (e.g. picked colleagues). */
	hasExtraInput?: () => boolean;
	/** True while a request is running: the view must not be left meanwhile. */
	isBlocked?: () => boolean;
	/** Closes the view (navigates away); called once the person has agreed. */
	onLeave: () => void;
	triggerSelector?: string;
}

const fieldHasInput = (field: HTMLElement) => {
	if (!field.isConnected) {
		return false;
	}
	const input = field as HTMLInputElement;
	return input.type === 'checkbox' || input.type === 'radio'
		? input.checked
		: (input.value ?? '').trim() !== '';
};

/**
 * Leaving the create view by a click into empty space or Escape (WCAG 2.1.2,
 * no keyboard trap). Typed input is never dropped silently: it asks first,
 * like the notification settings do. After leaving, focus returns to the
 * "Erstellen" chip that opened the view (WCAG 2.4.3).
 */
export const useCreateViewExit = ({
	hasExtraInput,
	isBlocked,
	onLeave,
	triggerSelector = CREATE_TRIGGER_SELECTOR
}: CreateViewExitOptions) => {
	const surfaceRef = useRef<HTMLDivElement | null>(null);
	const touchedFieldsRef = useRef(new Set<HTMLElement>());
	const focusReturnRef = useRef(false);
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const leave = () => {
		if (isBlocked?.()) {
			return;
		}
		focusReturnRef.current = true;
		onLeave();
	};
	const requestClose = () => {
		// A running create request cannot be cancelled: leaving now would
		// still create the room after the person chose to discard.
		if (isBlocked?.()) {
			return;
		}
		const dirty =
			Boolean(hasExtraInput?.()) ||
			Array.from(touchedFieldsRef.current).some(fieldHasInput);
		if (dirty) {
			setConfirmDiscard(true);
			return;
		}
		leave();
	};
	useDismissOnOutside(surfaceRef, requestClose);

	useEffect(
		() => () => {
			if (!focusReturnRef.current) {
				return;
			}
			let attempts = 0;
			const restore = () => {
				const trigger =
					document.querySelector<HTMLElement>(triggerSelector);
				if (trigger) {
					trigger.focus();
				} else if (attempts++ < 20) {
					requestAnimationFrame(restore);
				}
			};
			requestAnimationFrame(restore);
		},
		[triggerSelector]
	);

	return {
		surfaceRef,
		onInput: (event: React.FormEvent<HTMLElement>) => {
			touchedFieldsRef.current.add(event.target as HTMLElement);
		},
		discardDialog: (
			<CreateViewDiscardDialog
				open={confirmDiscard}
				onKeepEditing={() => setConfirmDiscard(false)}
				onDiscard={() => {
					setConfirmDiscard(false);
					leave();
				}}
			/>
		)
	};
};

interface CreateViewDiscardDialogProps {
	open: boolean;
	onKeepEditing: () => void;
	onDiscard: () => void;
}

export const CreateViewDiscardDialog = ({
	open,
	onKeepEditing,
	onDiscard
}: CreateViewDiscardDialogProps) => {
	const { t } = useTranslation();
	return (
		<M3Dialog
			open={open}
			onClose={onKeepEditing}
			title={t('groupChat.format.discard.title')}
			description={t('groupChat.format.discard.description')}
			closeLabel={t('app.close')}
			actions={[
				{
					label: t('groupChat.format.discard.keepEditing'),
					onClick: onKeepEditing,
					testId: 'create-keep-editing'
				},
				{
					label: t('groupChat.format.discard.confirm'),
					onClick: onDiscard,
					primary: true,
					testId: 'create-discard-input'
				}
			]}
		/>
	);
};
