import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { ReactComponent as BellIcon } from '../../resources/img/icons/notification_bell.svg';
import {
	NOTIFICATION_TONE_IDS,
	SoundId
} from '../../utils/notificationSettings/model';
import { previewNotificationSound } from '../../utils/notificationSettings/soundPlayback';
import { DEFAULT_VOLUME } from '../../utils/notificationSettings/notificationConfig';
import './NotificationBrowserDialog.styles.scss';

/** Tone that is pre-selected when the account has none yet. */
export const DEFAULT_FIRST_TONE: SoundId = 'ton-3';

export interface NotificationBrowserDialogProps {
	/** The address was just saved: say so, then name the one step left. */
	emailJustSaved?: boolean;
	/** The browser has blocked this site, so no prompt can open any more. */
	blocked?: boolean;
	busy?: boolean;
	initialTone?: SoundId;
	onClose: () => void;
	/** Called inside the click, so the browser still sees a user gesture. */
	onConfirm: (tone: SoundId) => void;
}

/**
 * The browser step of the first-answer notification setup, as a house dialog:
 * what the permission is for, which tone the person will hear (with a play
 * button, because a tone cannot be judged by its name) and the one button
 * that asks the browser. The confirm click must reach `requestPermission`
 * without an `await` in between, otherwise the browser drops the prompt.
 */
export const NotificationBrowserDialog: React.FC<
	NotificationBrowserDialogProps
> = ({
	emailJustSaved = false,
	blocked = false,
	busy = false,
	initialTone = DEFAULT_FIRST_TONE,
	onClose,
	onConfirm
}) => {
	const { t } = useTranslation();
	const [tone, setTone] = useState<SoundId>(initialTone);
	const options: SoundId[] = [...NOTIFICATION_TONE_IDS, 'none'];

	const pick = (id: SoundId) => {
		setTone(id);
		previewNotificationSound(id, DEFAULT_VOLUME);
	};

	const move = (event: React.KeyboardEvent, index: number) => {
		const step =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? -1
					: 0;
		if (!step) return;
		event.preventDefault();
		const next = (index + step + options.length) % options.length;
		pick(options[next]);
		(
			event.currentTarget.parentElement?.children[next] as
				| HTMLElement
				| undefined
		)?.focus();
	};

	return (
		<M3Dialog
			open
			onClose={onClose}
			icon={<BellIcon />}
			closeLabel={t('app.close')}
			title={t('erstantwort.notificationChoice.dialog.title')}
			description={
				blocked
					? undefined
					: emailJustSaved
						? t('erstantwort.notificationChoice.emailSavedNext')
						: t('erstantwort.notificationChoice.dialog.description')
			}
			actions={[
				{
					label: t('furtherSteps.email.overlay.button2.label'),
					onClick: onClose
				},
				{
					label: t('erstantwort.notificationChoice.enableBrowser'),
					onClick: () => onConfirm(tone),
					disabled: busy || blocked,
					primary: true
				}
			]}
		>
			{blocked ? (
				<p role="alert" className="notificationBrowserDialog__blocked">
					{t('erstantwort.notificationChoice.browserBlockedHelp')}
				</p>
			) : (
				<>
					<p className="notificationBrowserDialog__stay">
						{t(
							'erstantwort.notificationChoice.dialog.stayInBrowser'
						)}
					</p>
					<div
						role="radiogroup"
						aria-label={t(
							'erstantwort.notificationChoice.dialog.toneLabel'
						)}
						className="notificationBrowserDialog__tones"
					>
						{options.map((id, index) => (
							<button
								key={id}
								type="button"
								role="radio"
								aria-checked={tone === id}
								tabIndex={tone === id ? 0 : -1}
								onKeyDown={(event) => move(event, index)}
								data-testid={`notificationTone-${id}`}
								className="notificationBrowserDialog__tone"
								onClick={() => pick(id)}
							>
								{id === 'none'
									? t(
											'erstantwort.notificationChoice.dialog.noTone'
										)
									: t(
											'erstantwort.notificationChoice.dialog.tone',
											{ number: index + 1 }
										)}
							</button>
						))}
					</div>
				</>
			)}
		</M3Dialog>
	);
};
