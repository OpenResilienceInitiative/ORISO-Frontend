import * as React from 'react';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { ReactComponent as TopicIcon } from '../../resources/img/icons/category-search.svg';
import {
	Audio400Icon,
	Chat400Icon,
	Date400Icon,
	Duration400Icon,
	Language400Icon,
	Repeat400Icon,
	StartTime400Icon,
	Video400Icon
} from '../icons/conversationCreateIcons';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';
import { GroupChatInterval, GroupChatModality } from './createChatHelpers';
import './groupChatShareDialog.styles.scss';

export interface GroupChatShareDetails {
	topic: string;
	/** `yyyy-mm-dd`, as the create form holds it. */
	startDate: string;
	/** `HH:mm`, as the create form holds it. */
	startTime: string;
	/** Minutes. */
	duration: number;
	repeatCount: number;
	interval: GroupChatInterval;
	modality: GroupChatModality;
	/** ISO 639-1 code of the circle's primary language. */
	language: string;
}

export interface GroupChatShareDialogProps {
	open: boolean;
	onClose: () => void;
	/** The invite link (`buildGroupChatInviteLink`, `/login?gcid=<seriesId>`). */
	link: string;
	details: GroupChatShareDetails;
	/**
	 * M3 full-screen presentation for phones. The caller decides the
	 * breakpoint (`useResponsive().untilL` in the app), like `M3Dialog`.
	 */
	fullScreen?: boolean;
	/** Copy hook; defaults to the app's clipboard helper. */
	onCopy?: (link: string) => void | Promise<void>;
}

const formatDate = (isoDate: string, locale: string) => {
	const [year, month, day] = isoDate.split('-').map(Number);
	if (!year || !month || !day) {
		return isoDate;
	}
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(new Date(year, month - 1, day));
};

const formatLanguage = (code: string, locale: string) => {
	try {
		const name = new Intl.DisplayNames([locale], { type: 'language' }).of(
			code
		);
		return name ? `${name} (${code.toUpperCase()})` : code.toUpperCase();
	} catch {
		return code.toUpperCase();
	}
};

/**
 * Confirmation after a self-help circle or call has been created (#1499,
 * item 5): the shareable invite link with a copy action, and every detail the
 * author just chose, so they can pass both on without opening Chat-Info.
 *
 * Design proposal for Frank's approval — not yet wired. The natural seam is
 * `CircleSettingsView.handleCreate` → `useCreateChatSubmit`'s `onSuccess`,
 * which already receives the created series (`chatLinkData`), before the
 * navigation to the session view.
 */
export const GroupChatShareDialog = ({
	open,
	onClose,
	link,
	details,
	fullScreen = false,
	onCopy = (value) => copyTextToClipboard(value)
}: GroupChatShareDialogProps) => {
	const { t: translate, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage || i18n.language || 'de';
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!open) {
			setCopied(false);
		}
	}, [open]);

	const handleCopy = async () => {
		await onCopy(link);
		setCopied(true);
	};

	const MediumIcon =
		details.modality === 'VIDEO'
			? Video400Icon
			: details.modality === 'AUDIO'
				? Audio400Icon
				: Chat400Icon;
	const modalityKey = details.modality.toLowerCase();
	const rows: {
		key: string;
		icon: ReactNode;
		label: string;
		value: string;
	}[] = [
		{
			key: 'topic',
			icon: <TopicIcon />,
			label: translate('groupChat.shareDialog.topic'),
			value: details.topic
		},
		{
			key: 'date',
			icon: <Date400Icon />,
			label: translate('groupChat.shareDialog.date'),
			value: formatDate(details.startDate, locale)
		},
		{
			key: 'start',
			icon: <StartTime400Icon />,
			label: translate('groupChat.shareDialog.start'),
			value: translate('groupChat.shareDialog.timeValue', {
				time: details.startTime
			})
		},
		{
			key: 'duration',
			icon: <Duration400Icon />,
			label: translate('groupChat.shareDialog.duration'),
			value: translate('groupChat.shareDialog.durationValue', {
				value: new Intl.NumberFormat(locale, {
					maximumFractionDigits: 2
				}).format(details.duration / 60)
			})
		},
		{
			key: 'repeats',
			icon: <Repeat400Icon />,
			label: translate('groupChat.shareDialog.repeats'),
			value:
				details.repeatCount > 1
					? translate('groupChat.shareDialog.repeatValue', {
							count: details.repeatCount,
							interval: translate(
								`groupChat.create.interval.options.${details.interval.toLowerCase()}`
							)
						})
					: translate('groupChat.info.settings.repetition.single')
		},
		{
			key: 'format',
			icon: <MediumIcon />,
			label: translate('groupChat.shareDialog.format'),
			value: translate(`groupChat.create.modality.options.${modalityKey}`)
		},
		{
			key: 'language',
			icon: <Language400Icon />,
			label: translate('groupChat.shareDialog.language'),
			value: formatLanguage(details.language, locale)
		}
	];

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			fullScreen={fullScreen}
			width={560}
			closeLabel={translate('app.close')}
			icon={<EventAvailableOutlinedIcon />}
			title={translate(`groupChat.shareDialog.title_${modalityKey}`)}
			description={translate('groupChat.shareDialog.description')}
			className="groupChatShareDialog"
			data-testid="group-chat-share-dialog"
			actions={[
				{
					label: translate('groupChat.shareDialog.done'),
					onClick: onClose,
					primary: true
				}
			]}
		>
			<div className="groupChatShareDialog__link">
				<label
					className="groupChatShareDialog__linkLabel"
					htmlFor="groupChatShareLink"
				>
					{translate('groupChat.shareDialog.linkLabel')}
				</label>
				<div className="groupChatShareDialog__linkRow">
					<input
						id="groupChatShareLink"
						className="groupChatShareDialog__linkField"
						type="text"
						readOnly
						value={link}
						onFocus={(event) => event.currentTarget.select()}
					/>
					<button
						type="button"
						className={`groupChatShareDialog__copy${
							copied ? ' groupChatShareDialog__copy--done' : ''
						}`}
						onClick={handleCopy}
					>
						{copied ? (
							<CheckOutlinedIcon aria-hidden />
						) : (
							<ContentCopyOutlinedIcon aria-hidden />
						)}
						<span>
							{translate(
								copied
									? 'groupChat.shareDialog.copied'
									: 'groupChat.shareDialog.copy'
							)}
						</span>
					</button>
				</div>
				<p className="groupChatShareDialog__status" aria-live="polite">
					{copied
						? translate('groupChat.copy.link.notification.text')
						: ''}
				</p>
			</div>
			<h3 className="groupChatShareDialog__detailsHeadline">
				{translate('groupChat.shareDialog.detailsHeadline')}
			</h3>
			<dl className="groupChatShareDialog__details">
				{rows.map((row) => (
					<div className="groupChatShareDialog__detail" key={row.key}>
						<span
							className="groupChatShareDialog__detailIcon"
							aria-hidden
						>
							{row.icon}
						</span>
						<dt>{row.label}</dt>
						<dd>{row.value}</dd>
					</div>
				))}
			</dl>
		</M3Dialog>
	);
};
