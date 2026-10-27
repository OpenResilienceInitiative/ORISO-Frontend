import * as React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMediaQuery } from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { MessageRetention } from './messageRetention';
import './temporaryAccount.styles.scss';

export interface KeepMessagesDialogProps {
	open?: boolean;
	/** Saves the answer for this conversation; the caller then sends. */
	onConfirm: (choice: MessageRetention) => void;
	/** Nothing is sent and nothing is decided; the draft stays. */
	onCancel: () => void;
	/** Bottom sheet instead of a centred dialog. Defaults to phones (< 600px). */
	sheet?: boolean;
}

const CHOICES: MessageRetention[] = ['keep', 'delete'];

/**
 * #1869: asked once per conversation, when a guest with a temporary account
 * first writes, pastes or uploads and the platform lets the guest decide.
 * No preselection: Escape or "Abbrechen" never decides for the person.
 */
export const KeepMessagesDialog = ({
	open = true,
	onConfirm,
	onCancel,
	sheet
}: KeepMessagesDialogProps) => {
	const { t } = useTranslation();
	const phone = useMediaQuery('(max-width: 599.95px)');
	const asSheet = sheet ?? phone;
	const [choice, setChoice] = useState<MessageRetention>();
	const name = useId();
	return (
		<M3Dialog
			open={open}
			onClose={onCancel}
			closeLabel={t('app.close')}
			width={480}
			icon={<ForumOutlinedIcon />}
			title={t('temporaryAccount.keepDialog.title')}
			description={t('temporaryAccount.keepDialog.description')}
			className={clsx(
				'keepMessagesDialog',
				asSheet && 'keepMessagesDialog--sheet'
			)}
			data-testid="keep-messages-dialog"
			actions={[
				{
					label: t('temporaryAccount.keepDialog.cancel'),
					onClick: onCancel
				},
				{
					label: t('temporaryAccount.keepDialog.confirm'),
					onClick: () => choice && onConfirm(choice),
					primary: true,
					disabled: !choice
				}
			]}
		>
			<div
				role="radiogroup"
				aria-label={t('temporaryAccount.keepDialog.title')}
				className="keepMessagesDialog__choices"
			>
				{CHOICES.map((value) => (
					<label
						key={value}
						className={clsx(
							'keepMessagesDialog__choice',
							choice === value &&
								'keepMessagesDialog__choice--selected'
						)}
					>
						<input
							type="radio"
							name={name}
							value={value}
							checked={choice === value}
							onChange={() => setChoice(value)}
						/>
						<span className="keepMessagesDialog__choiceText">
							<span className="keepMessagesDialog__choiceLabel">
								{t(
									`temporaryAccount.keepDialog.${value}.label`
								)}
							</span>
							<span className="keepMessagesDialog__choiceHint">
								{t(`temporaryAccount.keepDialog.${value}.hint`)}
							</span>
						</span>
					</label>
				))}
			</div>
			<p className="keepMessagesDialog__note">
				{t('temporaryAccount.keepDialog.note')}
			</p>
		</M3Dialog>
	);
};
