import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { TopicIcon } from '../TopicIcon';
import { ReactComponent as AddCircleIcon } from '../../../resources/img/icons/add-circle.svg';
import { SplitButton } from '../../splitButton/SplitButton';
import { FormatCard } from '../FormatCard';
import { RowMenu } from '../RowMenu';
import { ArtworkImage } from '../ArtworkImage';
import { FORMAT_ARTWORK } from '../../../resources/img/formats';
import {
	DIRECT_LINK_MEDIA,
	DIRECT_LINK_NAME_MAX,
	DirectLinkMedium
} from './directLink';
import { DirectLinkMediumIcon } from './DirectLinkMediumIcon';
import { OrisoTextField } from '../../form/OrisoTextField';
import { toScheduledAt } from './directLinkSchedule';
import { GuestAccountModeSelect } from '../../guestAccountMode/GuestAccountModeSelect';
import {
	defaultGuestAccountMode,
	GuestAccountMode
} from '../../guestAccountMode/guestAccountMode';
import './directLink.styles.scss';

/** Short segment labels; the full name is the accessible name. */
const MEDIUM_SHORT: Record<DirectLinkMedium, string> = {
	CHAT: 'directLink.medium.chat',
	AUDIO: 'groupChat.create.modality.options.audio',
	VIDEO: 'groupChat.create.modality.options.video'
};

export interface DirectLinkDraft {
	topic: string;
	medium: DirectLinkMedium;
	/** UserService#1662: which account a new guest gets. */
	guestAccountMode: GuestAccountMode;
	/** #2142: optional; without it the link is named after its topic. */
	name?: string;
	/** #2142: optional, informational date and time (ISO instant). */
	scheduledAt?: string;
}

interface DirectLinkCardProps {
	/** The counsellor's topics. The choice only shows with more than one. */
	topics: { value: string; label: string }[];
	onCreate: (draft: DirectLinkDraft) => void;
	className?: string;
	/** Media "Direkteinladung erlauben" allows here (default: all three). */
	media?: DirectLinkMedium[];
	/** While the link is being created: the button waits. */
	isSubmitting?: boolean;
	/** Why the last attempt failed, shown under the button. */
	errorMessage?: string;
	/** The topics did not load; shown with a retry instead of the picker. */
	topicsLoadFailed?: boolean;
	onRetryTopics?: () => void;
	/**
	 * #2252: the shared Direkteinladung dialog asks for the appointment and
	 * who may come in, so the card leaves out its own date and temporary
	 * switch. Off: the card of #2142 with both (default).
	 */
	settingsInDialog?: boolean;
	/**
	 * Preselected medium, e.g. from the calendar's Art when "Neue Person per
	 * Direkteinladung …" opened "Chat erstellen". Ignored when not allowed.
	 */
	initialMedium?: DirectLinkMedium;
}

/**
 * #1795: the "Direktlink" format card in "Create chat", next to the
 * self-help circle and the internal chat, in the same card shell.
 * Topic → medium → guest account → create.
 */
export const DirectLinkCard = ({
	topics,
	onCreate,
	className,
	media = DIRECT_LINK_MEDIA,
	isSubmitting = false,
	errorMessage,
	topicsLoadFailed = false,
	onRetryTopics,
	settingsInDialog = false,
	initialMedium
}: DirectLinkCardProps) => {
	const { t } = useTranslation();
	const id = useId();
	const topicRef = useRef<HTMLDivElement | null>(null);
	const [pickedTopic, setTopic] = useState('');
	// Topics may arrive after the first render; a single one needs no choice.
	const topic = topics.length === 1 ? topics[0].value : pickedTopic;
	const [topicMenuOpen, setTopicMenuOpen] = useState(false);
	const presetMedium =
		initialMedium && media.includes(initialMedium)
			? initialMedium
			: undefined;
	const [medium, setMedium] = useState<DirectLinkMedium | undefined>(
		presetMedium
	);
	const [guestAccountMode, setGuestAccountMode] = useState<GuestAccountMode>(
		presetMedium ? defaultGuestAccountMode(presetMedium) : 'PERMANENT'
	);
	const [name, setName] = useState('');
	const [scheduledLocal, setScheduledLocal] = useState('');
	/* A half-typed datetime-local reads as '' with `validity.badInput`;
	   it must not silently create the link without its date. */
	const scheduledRef = useRef<HTMLInputElement | null>(null);
	const [scheduledIncomplete, setScheduledIncomplete] = useState(false);

	const chooseMedium = (next: DirectLinkMedium) => {
		setMedium(next);
		setGuestAccountMode(defaultGuestAccountMode(next));
	};

	const ready = Boolean(topic && medium) && !isSubmitting;
	/* `value` may be an id (the wired card); the button names the topic. */
	const topicLabel = topics.find((option) => option.value === topic)?.label;

	return (
		<FormatCard
			className={`conversationCreate__formatCard directLinkCard${
				className ? ` ${className}` : ''
			}`}
			title={t('directLink.card.title')}
			subtitle={t('directLink.card.subtitle')}
			avatar={<LinkOutlinedIcon />}
			media={
				<ArtworkImage
					artwork={FORMAT_ARTWORK[medium ?? 'VIDEO']}
					alt={t('directLink.card.title')}
				/>
			}
		>
			<p className="conversationCreate__cardText">
				<strong>{t('directLink.card.headline')}</strong>
				<br />
				{t('directLink.card.text')}
			</p>
			<div className="conversationCreate__cardActions directLinkCard__fields">
				{topicsLoadFailed && (
					<p role="alert" className="conversationCreate__error">
						{t('groupChat.loadError.topics')}
						<button type="button" onClick={onRetryTopics}>
							{t('groupChat.loadError.retry')}
						</button>
					</p>
				)}
				{topics.length > 1 && (
					<>
						<SplitButton
							ref={topicRef}
							id={`${id}-topic`}
							fullWidth
							icon={<TopicIcon filled={Boolean(topic)} />}
							label={
								topicLabel ||
								topic ||
								t('directLink.card.topicLabel')
							}
							variant={
								topicMenuOpen
									? 'elevated'
									: topic
										? 'tonal'
										: 'outlined'
							}
							open={topicMenuOpen}
							mainOpensMenu
							onClick={() => setTopicMenuOpen((prev) => !prev)}
							onToggleMenu={() =>
								setTopicMenuOpen((prev) => !prev)
							}
							menuLabel={t('directLink.card.topicLabel')}
						/>
						{topicMenuOpen && (
							<RowMenu
								options={topics}
								value={topic}
								onSelect={(next) => {
									setTopic(next);
									setTopicMenuOpen(false);
								}}
								anchorRef={topicRef}
								onClose={() => setTopicMenuOpen(false)}
								labelledBy={`${id}-topic`}
							/>
						)}
					</>
				)}
				{/* Toggle buttons, not radios: Tab, Enter and Space suffice. */}
				<div
					role="group"
					aria-label={t('directLink.card.mediumLabel')}
					className="directLinkCard__media"
				>
					{media.map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={medium === value}
							className={`directLinkCard__medium${
								medium === value
									? ' directLinkCard__medium--selected'
									: ''
							}`}
							aria-label={t(
								`directLink.medium.${value.toLowerCase()}`
							)}
							onClick={() => chooseMedium(value)}
						>
							<DirectLinkMediumIcon
								medium={value}
								filled={medium === value}
							/>
							{t(MEDIUM_SHORT[value])}
						</button>
					))}
				</div>
				{medium && !settingsInDialog && (
					<GuestAccountModeSelect
						value={guestAccountMode}
						onChange={setGuestAccountMode}
					/>
				)}
				{medium && (
					<div className="directLinkCard__details">
						<OrisoTextField
							id={`${id}-name`}
							label={t('directLink.card.name')}
							placeholder={topicLabel}
							value={name}
							onChange={(event) => setName(event.target.value)}
							helperText={t('directLink.card.nameHint')}
							inputProps={{ maxLength: DIRECT_LINK_NAME_MAX }}
							InputLabelProps={{ shrink: true }}
							size="small"
							fullWidth
						/>
						{!settingsInDialog && (
							<OrisoTextField
								id={`${id}-scheduled`}
								type="datetime-local"
								label={t('directLink.card.scheduledAt')}
								value={scheduledLocal}
								inputRef={scheduledRef}
								onChange={(event) => {
									setScheduledLocal(event.target.value);
									setScheduledIncomplete(
										Boolean(event.target.validity?.badInput)
									);
								}}
								error={scheduledIncomplete}
								helperText={t(
									scheduledIncomplete
										? 'directLink.card.scheduledAtIncomplete'
										: 'directLink.card.scheduledAtHint'
								)}
								InputLabelProps={{ shrink: true }}
								size="small"
								fullWidth
							/>
						)}
					</div>
				)}
				<button
					type="button"
					className={`directLinkCard__create${
						ready ? ' directLinkCard__create--ready' : ''
					}`}
					disabled={!ready}
					aria-busy={isSubmitting || undefined}
					onClick={() => {
						if (!medium) return;
						if (scheduledRef.current?.validity?.badInput) {
							setScheduledIncomplete(true);
							scheduledRef.current.focus();
							return;
						}
						const trimmed = name.trim();
						const scheduledAt = toScheduledAt(scheduledLocal);
						onCreate({
							topic,
							medium,
							guestAccountMode,
							...(trimmed ? { name: trimmed } : {}),
							...(scheduledAt ? { scheduledAt } : {})
						});
					}}
				>
					<AddCircleIcon aria-hidden />
					{t('directLink.card.create')}
				</button>
				{errorMessage && (
					<p role="alert" className="conversationCreate__error">
						{errorMessage}
					</p>
				)}
			</div>
		</FormatCard>
	);
};
