import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CircleIcon } from '../../resources/img/icons/self-help-group.svg';
import { ReactComponent as InternalIcon } from '../../resources/img/icons/internal-conversation.svg';
import { ReactComponent as CategorySearchIcon } from '../../resources/img/icons/category-search.svg';
import { ReactComponent as MoreIcon } from '../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as AddCircleIcon } from '../../resources/img/icons/add-circle.svg';
import internalTeamImage from '../../resources/img/illustrations/conversation/internal-team.png';
import { getTopicCardImage } from '../../resources/img/topics';
import { GroupChatAuthorContentFields } from '../groupChat/GroupChatAuthorContentFields';
import { GroupChatAuthorContentDraft } from '../groupChat/groupChatAuthorContent';
import { GroupChatSeriesFieldsValue } from '../groupChat/GroupChatSeriesFields';
import { SplitButton } from '../splitButton/SplitButton';
import { BackPill } from './BackPill';
import { CompactFormatRow } from './CompactFormatRow';
import { FormatCard } from './FormatCard';
import { PanelHeader } from './PanelHeader';
import { RowMenu } from './RowMenu';
import { ScreenIntro } from './ScreenIntro';
import { TopicMedia } from './TopicMedia';
import { ScheduleRows } from './circle/ScheduleRows';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './internal/InternalChatCreateCard';
import './conversationCreate.styles.scss';
import '../groupChat/createChat.styles.scss';

/**
 * The assembled screens of the create-conversation flow.
 *
 * - Screen 1 "Gesprächsformat wählen" — Figma 8482-30551 (desktop) and
 *   8482-30552 (mobile column).
 * - Screen 2 "Gesprächskreis Einstellungen" — Figma 8482-30552. Mobile shows
 *   the same card, tightly stacked into one scrolling column and carrying the
 *   artwork, the name field and the topic row.
 * - The Interna card completes without a second screen (Figma 8480-27986).
 */

const meta = {
	title: 'ConversationCreate/Screens',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Screen-level compositions for both breakpoints. The mobile stories are rendered in a 390px shell, the desktop stories in the flow container.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PEOPLE = [
	'Sabine Leutheuser-Schnarrenberger',
	'Siegfried Beutmer',
	'Angela Labisslere',
	'Karl Jung',
	'Siegmund Freud',
	'Charlotte Rausch'
].map((label, index) => ({ id: `person-${index}`, label }));

const TOPICS = [
	'Schulden',
	'Sozialberatung',
	'Kinder und Jugendliche',
	'U25 Suizidprävention',
	'Rechtliche Betreuung & Vorsorge'
].map((name) => ({ value: name, label: name }));

const DesktopShell = ({ children }: { children: React.ReactNode }) => (
	<div style={{ background: '#e9e6e6', padding: 24 }}>
		<div
			style={{
				background: '#fcf9f9',
				borderRadius: 28,
				margin: '0 auto',
				maxWidth: 1100,
				overflow: 'hidden'
			}}
		>
			{children}
		</div>
	</div>
);

const MobileShell = ({ children }: { children: React.ReactNode }) => (
	<div style={{ background: '#e9e6e6', padding: 16 }}>
		<div
			style={{
				background: '#fcf9f9',
				borderRadius: 28,
				margin: '0 auto',
				maxWidth: 390,
				overflow: 'hidden'
			}}
		>
			{children}
		</div>
	</div>
);

const CardOverflow = () => {
	const { t } = useTranslation();
	return (
		<button
			type="button"
			className="formatCard__menuButton"
			aria-label={t('groupChat.format.cardMenu')}
			disabled
		>
			<MoreIcon aria-hidden />
		</button>
	);
};

const CircleCard = ({ menuOpen = false }: { menuOpen?: boolean }) => {
	const { t } = useTranslation();
	const anchorRef = useRef<HTMLDivElement | null>(null);
	const [topic, setTopic] = useState('');
	const [open, setOpen] = useState(menuOpen);
	return (
		<FormatCard
			className="conversationCreate__formatCard"
			title={t('groupChat.circle.title')}
			subtitle={t('groupChat.circle.subtitle')}
			avatar={<CircleIcon />}
			media={
				<TopicMedia topic={topic} alt={t('groupChat.circle.title')} />
			}
			headerAction={<CardOverflow />}
		>
			<p className="conversationCreate__cardText">
				<strong>{t('groupChat.circle.cardHeadline')}</strong>
				<br />
				{t('groupChat.circle.cardText')}
			</p>
			<div className="conversationCreate__cardActions">
				<SplitButton
					ref={anchorRef}
					id="storyTopicButton"
					fullWidth
					icon={<CategorySearchIcon />}
					label={topic || t('groupChat.circle.topicLabel')}
					variant={open ? 'elevated' : topic ? 'primary' : 'outlined'}
					open={open}
					mainOpensMenu={!topic}
					onClick={() => setOpen((prev) => !prev)}
					onToggleMenu={() => setOpen((prev) => !prev)}
					menuLabel={t('groupChat.circle.toggleTopicList')}
				/>
				{open && (
					<RowMenu
						options={TOPICS}
						value={topic}
						onSelect={(next) => {
							setTopic(next);
							setOpen(false);
						}}
						anchorRef={anchorRef}
						onClose={() => setOpen(false)}
						labelledBy="storyTopicButton"
					/>
				)}
			</div>
		</FormatCard>
	);
};

const InternaCard = ({ preset }: { preset: 'empty' | 'filled' }) => {
	const [draft, setDraft] = useState<InternalChatDraft>(
		preset === 'filled'
			? {
					name: 'Wochenplanungsgruppe',
					selectedIds: [PEOPLE[0].id, PEOPLE[1].id, PEOPLE[2].id]
				}
			: { name: '', selectedIds: [] }
	);
	return (
		<InternalChatCreateCard
			people={PEOPLE}
			draft={draft}
			onDraftChange={setDraft}
			onCreate={() => undefined}
		/>
	);
};

const FormatPicker = ({
	compact,
	menuOpen = false
}: {
	compact: boolean;
	menuOpen?: boolean;
}) => {
	const { t } = useTranslation();
	return (
		<div className="conversationCreate">
			<PanelHeader
				title={t('groupChat.format.panelTitle')}
				menuLabel={t('groupChat.format.panelMenu')}
			/>
			<div
				className={`conversationCreate__picker${
					compact ? ' conversationCreate__picker--compact' : ''
				}`}
			>
				<ScreenIntro
					title={t('groupChat.format.title')}
					subtitle={t('groupChat.format.subtitle')}
				/>
				<div
					className={`conversationCreate__selection${
						compact ? ' conversationCreate__selection--rows' : ''
					}`}
				>
					{compact ? (
						<div className="conversationCreate__rows">
							<CompactFormatRow
								icon={<InternalIcon />}
								title={t('groupChat.internal.title')}
								subtitle={t('groupChat.internal.subtitle')}
								image={internalTeamImage}
								onSelect={() => undefined}
							/>
							<CompactFormatRow
								icon={<CircleIcon />}
								title={t('groupChat.circle.title')}
								subtitle={t('groupChat.circle.subtitle')}
								image={getTopicCardImage(null)}
								onSelect={() => undefined}
							/>
						</div>
					) : (
						<div className="conversationCreate__cards">
							<CircleCard menuOpen={menuOpen} />
							<InternaCard preset="empty" />
						</div>
					)}
				</div>
			</div>
			{compact && (
				<BackPill
					label={t('groupChat.format.back')}
					onClick={() => undefined}
				/>
			)}
		</div>
	);
};

export const FormatPickerDesktop: Story = {
	render: () => (
		<DesktopShell>
			<FormatPicker compact={false} />
		</DesktopShell>
	)
};

export const FormatPickerDesktopTopicMenu: Story = {
	parameters: {
		docs: {
			description: {
				story: 'The topic list floats above the card exactly like the person list on the right, and the split button switches to the elevated state while its menu is open. Both use the same RowMenu / SplitButton components.'
			}
		}
	},
	render: () => (
		<DesktopShell>
			<FormatPicker compact={false} menuOpen />
		</DesktopShell>
	)
};

export const FormatPickerMobile: Story = {
	render: () => (
		<MobileShell>
			<FormatPicker compact />
		</MobileShell>
	)
};

export const InternaCardStates: Story = {
	parameters: {
		docs: {
			description: {
				story: 'States 1 and 5 of Figma 8480-27986: resting, and name + people filled with the media dimmed behind the chips.'
			}
		}
	},
	render: () => (
		<div
			style={{
				background: '#e9e6e6',
				display: 'flex',
				gap: 24,
				padding: 24
			}}
		>
			<InternaCard preset="empty" />
			<InternaCard preset="filled" />
		</div>
	)
};

const CircleSettings = ({ compact }: { compact: boolean }) => {
	const { t } = useTranslation();
	const [topic, setTopic] = useState('Schulden');
	const topicRef = useRef<HTMLDivElement | null>(null);
	const [series, setSeries] = useState<GroupChatSeriesFieldsValue>({
		startDate: '2026-08-23',
		startTime: '19:00',
		duration: 240,
		repeatCount: 34,
		interval: 'WEEKLY',
		modality: 'VIDEO'
	});
	const [authorContent, setAuthorContent] =
		useState<GroupChatAuthorContentDraft>({
			sourceLanguage: 'de',
			hintMessageTranslations: { de: '', en: '' },
			groupChatRulesTranslations: {
				de: [
					'Sprich von dir selbst, nicht über andere.',
					'Was hier geteilt wird, bleibt hier.'
				],
				en: [
					'Speak about yourself, not about others.',
					'What is shared here stays here.'
				]
			}
		});

	const rows = (
		<ScheduleRows
			value={series}
			onChange={setSeries}
			language={authorContent.sourceLanguage}
			onLanguageChange={(language) =>
				setAuthorContent((current) => ({
					...current,
					sourceLanguage: language
				}))
			}
			languageOptions={[
				{ value: 'de', label: 'Deutsch' },
				{ value: 'en', label: 'English' }
			]}
		/>
	);

	return (
		<div className="conversationCreate">
			<PanelHeader
				title={t('groupChat.format.panelTitle')}
				menuLabel={t('groupChat.format.panelMenu')}
				menuDisabled
			/>
			<div
				className={`circleSettings${
					compact ? ' circleSettings--compact' : ''
				}`}
			>
				<ScreenIntro
					title={t('groupChat.circle.settingsTitle')}
					subtitle={t('groupChat.circle.settingsSubtitle')}
				/>
				<div className="circleSettings__columns">
					<FormatCard
						className="circleSettings__card"
						title={t('groupChat.circle.title')}
						subtitle={t('groupChat.circle.subtitle')}
						avatar={<CircleIcon />}
						media={
							compact ? (
								<TopicMedia
									topic={topic}
									alt={t('groupChat.circle.title')}
								/>
							) : undefined
						}
						headerAction={<CardOverflow />}
					>
						{compact && (
							<SplitButton
								ref={topicRef}
								fullWidth
								icon={<CategorySearchIcon />}
								label={
									topic || t('groupChat.circle.topicLabel')
								}
								variant={topic ? 'tonal' : 'outlined'}
								onClick={() =>
									setTopic(topic ? '' : TOPICS[0].value)
								}
								onToggleMenu={() =>
									setTopic(topic ? '' : TOPICS[0].value)
								}
								menuLabel={t(
									'groupChat.circle.toggleTopicList'
								)}
							/>
						)}
						{rows}
					</FormatCard>
					<div className="circleSettings__authorColumn">
						<GroupChatAuthorContentFields
							activeLanguages={['de', 'en']}
							value={authorContent}
							onChange={setAuthorContent}
							translationAvailable
						/>
						<button
							type="button"
							className="circleSettings__createButton circleSettings__createButton--primary"
						>
							<AddCircleIcon aria-hidden />
							{t('groupChat.circle.createLabel')}
						</button>
					</div>
				</div>
			</div>
			{compact && (
				<BackPill
					label={t('groupChat.format.back')}
					onClick={() => undefined}
				/>
			)}
		</div>
	);
};

export const CircleSettingsDesktop: Story = {
	render: () => (
		<DesktopShell>
			<CircleSettings compact={false} />
		</DesktopShell>
	)
};

export const CircleSettingsMobile: Story = {
	render: () => (
		<MobileShell>
			<CircleSettings compact />
		</MobileShell>
	)
};
