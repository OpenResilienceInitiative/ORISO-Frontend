import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { TopicIcon } from '../TopicIcon';
import { ReactComponent as AddCircleIcon } from '../../../resources/img/icons/add-circle.svg';
import { SplitButton } from '../../splitButton/SplitButton';
import { Switch } from '../../Switch';
import { FormatCard } from '../FormatCard';
import { RowMenu } from '../RowMenu';
import { ArtworkImage } from '../ArtworkImage';
import { FORMAT_ARTWORK } from '../../../resources/img/formats';
import {
	defaultTemporary,
	DIRECT_LINK_MEDIA,
	DirectLinkMedium
} from './directLink';
import { DirectLinkMediumIcon } from './DirectLinkMediumIcon';
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
	temporary: boolean;
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
}

/**
 * #1795: the "Direktlink" format card in "Create chat", next to the
 * self-help circle and the internal chat, in the same card shell.
 * Topic → medium → temporary account → create.
 */
export const DirectLinkCard = ({
	topics,
	onCreate,
	className,
	media = DIRECT_LINK_MEDIA,
	isSubmitting = false,
	errorMessage,
	topicsLoadFailed = false,
	onRetryTopics
}: DirectLinkCardProps) => {
	const { t } = useTranslation();
	const id = useId();
	const topicRef = useRef<HTMLDivElement | null>(null);
	const [pickedTopic, setTopic] = useState('');
	// Topics may arrive after the first render; a single one needs no choice.
	const topic = topics.length === 1 ? topics[0].value : pickedTopic;
	const [topicMenuOpen, setTopicMenuOpen] = useState(false);
	const [medium, setMedium] = useState<DirectLinkMedium>();
	const [temporary, setTemporary] = useState(false);

	const chooseMedium = (next: DirectLinkMedium) => {
		setMedium(next);
		setTemporary(defaultTemporary(next));
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
				{medium && (
					<div className="directLinkCard__temporary">
						<span className="directLinkCard__temporaryText">
							<span id={`${id}-temp`}>
								{t('directLink.card.temporary')}
							</span>
							<span
								id={`${id}-temp-hint`}
								className="directLinkCard__hint"
							>
								{t('directLink.card.temporaryHint')}
							</span>
						</span>
						<Switch
							checked={temporary}
							onChange={setTemporary}
							aria-labelledby={`${id}-temp`}
							aria-describedby={`${id}-temp-hint`}
						/>
					</div>
				)}
				<button
					type="button"
					className={`directLinkCard__create${
						ready ? ' directLinkCard__create--ready' : ''
					}`}
					disabled={!ready}
					aria-busy={isSubmitting || undefined}
					onClick={() =>
						medium && onCreate({ topic, medium, temporary })
					}
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
