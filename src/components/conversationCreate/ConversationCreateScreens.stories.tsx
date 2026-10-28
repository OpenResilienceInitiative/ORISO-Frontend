import * as React from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddCircleIcon } from '../../resources/img/icons/add-circle.svg';
import { ReactComponent as CircleIcon } from '../../resources/img/icons/self-help-group.svg';
import { ReactComponent as InternalIcon } from '../../resources/img/icons/internal-conversation.svg';
import {
	getTopicCardArtwork,
	INTERNAL_CHAT_ARTWORK
} from '../../resources/img/topics';
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
import { TopicIcon } from './TopicIcon';
import { TopicMedia } from './TopicMedia';
import { ScheduleRows } from './circle/ScheduleRows';
import {
	InternalChatCreateCard,
	InternalChatDraft
} from './internal/InternalChatCreateCard';
import { DirectLinkCard, DirectLinkDraft } from './directLink/DirectLinkCard';
import { DirectLinkShareDialog } from './directLink/DirectLinkShareDialog';
import {
	CounsellorDashboard,
	DashboardCircle,
	DashboardStats
} from '../counsellorDashboard/CounsellorDashboard';
import { DirectLink } from './directLink/directLink';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { FORMAT_ARTWORK } from '../../resources/img/formats';
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

/**
 * Both stacked cards must read as one pair: same width, same height. They
 * drifted by two pixels once because the columns did not stretch, which is
 * exactly the kind of thing nobody sees in a diff.
 */
const expectCardsMatch = async (canvasElement: HTMLElement) => {
	/*
	 * Both cards are named, not taken by position: the right-hand column IS the
	 * welcome-and-rules card — it carries the surface, outline and radius, and
	 * the create action sits inside it, as the node draws it.
	 */
	const left = canvasElement.querySelector(
		'.circleSettings__card'
	) as HTMLElement;
	const right = canvasElement.querySelector(
		'.circleSettings__authorColumn'
	) as HTMLElement;
	await expect(left).not.toBeNull();
	await expect(right).not.toBeNull();
	const a = left.getBoundingClientRect();
	const b = right.getBoundingClientRect();
	await expect(Math.round(a.height)).toBe(Math.round(b.height));
	await expect(Math.round(a.width)).toBe(Math.round(b.width));
};

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
				borderRadius: 32,
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
				borderRadius: 32,
				margin: '0 auto',
				maxWidth: 390,
				overflow: 'hidden'
			}}
		>
			{children}
		</div>
	</div>
);

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
					icon={<TopicIcon filled={Boolean(topic)} />}
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

type PickerStep = 'picker' | 'directLink' | 'links';

/** Sample figures; `archivedSessions` needs a field in the statistics service. */
const DASHBOARD_STATS: DashboardStats = {
	assignedSessions: 3,
	activeSessions: 18,
	sentMessages: 124,
	archivedSessions: 7
};

/** A counsellor who has just started: few figures, one link, no circles. */
const SPARSE_STATS: DashboardStats = {
	assignedSessions: 1,
	activeSessions: 2,
	sentMessages: 9
};

const UPCOMING_CIRCLES: DashboardCircle[] = [
	{
		id: 'c1',
		topic: 'Schulden',
		when: 'Do., 30. Okt · 19:00',
		medium: 'VIDEO',
		participants: 6
	},
	{
		id: 'c2',
		topic: 'Trauer',
		when: 'Mo., 3. Nov · 18:00',
		medium: 'AUDIO',
		participants: 4
	},
	{
		id: 'c3',
		topic: 'Sozialberatung',
		when: 'Mi., 5. Nov · 17:30',
		medium: 'CHAT',
		participants: 8
	}
];

/** #1795: what the backend will hand back; story-only. */
const toDirectLink = (draft: DirectLinkDraft, index: number): DirectLink => ({
	id: `link-${index}`,
	name: draft.topic,
	topic: draft.topic,
	medium: draft.medium,
	temporary: draft.temporary,
	active: true,
	url: `https://app.oriso.org/l/${['k7m2qx', 'p4tz9a', 'w3nd8r'][index % 3]}`
});

/**
 * Clickable: pick "Direktlink", choose topic and medium, create. The share
 * dialog opens; "Fertig" leads to "Gespräche" with nothing selected, where
 * the overview lists the link. Its round button leads back here.
 */
const FormatPicker = ({
	compact,
	menuOpen = false,
	initialLinks = []
}: {
	compact: boolean;
	menuOpen?: boolean;
	initialLinks?: DirectLink[];
}) => {
	const { t } = useTranslation();
	const [step, setStep] = useState<PickerStep>('picker');
	const [links, setLinks] = useState<DirectLink[]>(initialLinks);
	const [shared, setShared] = useState<DirectLink>();

	const create = (draft: DirectLinkDraft) => {
		const link = toDirectLink(draft, links.length);
		setLinks((current) => [link, ...current]);
		setShared(link);
	};

	const directLinkCard = <DirectLinkCard topics={TOPICS} onCreate={create} />;

	return (
		// The overview sits on the grey background, outside the white panel.
		<div
			className={step === 'links' ? undefined : 'conversationCreate'}
			style={step === 'links' ? { height: '100vh' } : undefined}
		>
			{step !== 'links' && (
				<PanelHeader
					title={t('groupChat.format.panelTitle')}
					menuLabel={t('groupChat.format.panelMenu')}
				/>
			)}
			{step === 'links' ? (
				<CounsellorDashboard
					stats={DASHBOARD_STATS}
					links={links}
					upcomingCircles={UPCOMING_CIRCLES}
					onCreateLink={() => setStep('picker')}
					onToggleLink={(id, active) =>
						setLinks((current) =>
							current.map((link) =>
								link.id === id ? { ...link, active } : link
							)
						)
					}
					onShowQr={setShared}
					onCopy={() => undefined}
				/>
			) : step === 'directLink' ? (
				<div className="conversationCreate__single conversationCreate__single--compact">
					{directLinkCard}
				</div>
			) : (
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
							compact
								? ' conversationCreate__selection--rows'
								: ''
						}`}
					>
						{compact ? (
							<div className="conversationCreate__rows">
								<CompactFormatRow
									icon={<InternalIcon />}
									title={t('groupChat.internal.title')}
									subtitle={t('groupChat.internal.subtitle')}
									image={INTERNAL_CHAT_ARTWORK}
									onSelect={() => undefined}
								/>
								<CompactFormatRow
									icon={<CircleIcon />}
									title={t('groupChat.circle.title')}
									subtitle={t('groupChat.circle.subtitle')}
									image={getTopicCardArtwork(null)}
									onSelect={() => undefined}
								/>
								<CompactFormatRow
									icon={<LinkOutlinedIcon />}
									title={t('directLink.card.title')}
									subtitle={t('directLink.card.subtitle')}
									image={FORMAT_ARTWORK.VIDEO}
									onSelect={() => setStep('directLink')}
								/>
							</div>
						) : (
							<div className="conversationCreate__cards">
								<CircleCard menuOpen={menuOpen} />
								<InternaCard preset="empty" />
								{directLinkCard}
							</div>
						)}
					</div>
				</div>
			)}
			{compact && step !== 'links' && (
				<BackPill
					label={t('groupChat.format.back')}
					onClick={() => setStep('picker')}
				/>
			)}
			{shared && (
				<DirectLinkShareDialog
					open
					link={shared}
					fullScreen={compact}
					onCopy={() => undefined}
					onClose={() => {
						setShared(undefined);
						setStep('links');
					}}
				/>
			)}
		</div>
	);
};

/** "Gespräche" with nothing selected: the session card holds the overview. */
const SessionCardShell = ({ children }: { children: React.ReactNode }) => (
	<div style={{ background: '#e9e6e6', padding: 24 }}>
		<div
			style={{
				background: '#fff',
				border: '1px solid #ffb4aa',
				borderRadius: 28,
				margin: '0 auto',
				maxWidth: 960,
				minHeight: 640
			}}
		>
			{children}
		</div>
	</div>
);

const DashboardStory = ({
	initial,
	circles,
	stats = DASHBOARD_STATS
}: {
	initial: DirectLink[];
	circles: DashboardCircle[];
	stats?: DashboardStats;
}) => {
	const [links, setLinks] = useState(initial);
	const [shared, setShared] = useState<DirectLink>();
	return (
		<div style={{ height: '100vh' }}>
			<CounsellorDashboard
				stats={stats}
				links={links}
				upcomingCircles={circles}
				onCreateLink={() => undefined}
				onToggleLink={(id, active) =>
					setLinks((current) =>
						current.map((link) =>
							link.id === id ? { ...link, active } : link
						)
					)
				}
				onShowQr={setShared}
				onCopy={() => undefined}
			/>
			{shared && (
				<DirectLinkShareDialog
					open
					link={shared}
					onCopy={() => undefined}
					onClose={() => setShared(undefined)}
				/>
			)}
		</div>
	);
};

const SAMPLE_LINKS: DirectLink[] = [
	{
		id: 'a',
		name: 'Flyer Schule',
		topic: 'Schulden',
		medium: 'VIDEO',
		temporary: true,
		active: true,
		url: 'https://app.oriso.org/l/k7m2qx'
	},
	{
		id: 'b',
		name: 'Website Beratungsstelle',
		topic: 'Sozialberatung',
		medium: 'CHAT',
		temporary: false,
		active: true,
		url: 'https://app.oriso.org/l/p4tz9a'
	},
	{
		id: 'c',
		name: 'Telefonsprechstunde',
		topic: 'Kinder und Jugendliche',
		medium: 'AUDIO',
		temporary: true,
		active: false,
		url: 'https://app.oriso.org/l/w3nd8r'
	}
];

/** Creates a video link end to end and lands in the overview. */
const createVideoLink = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const body = within(document.body);
	const heading = await canvas.findByRole('heading', { name: 'Direktlink' });
	const card = within(heading.closest('section') as HTMLElement);
	// The split button carries the label on both of its halves.
	await userEvent.click(
		card.getAllByRole('button', { name: 'Thema wählen' })[0]
	);
	await userEvent.click(
		await body.findByRole('option', { name: 'Schulden' })
	);
	await userEvent.click(card.getByRole('radio', { name: /Videoanruf/ }));
	// Calls default to a temporary account.
	await expect(
		card.getByRole('switch', { name: 'Temporäres Konto' })
	).toBeChecked();
	await userEvent.click(card.getByRole('button', { name: 'Link erstellen' }));
	const dialog = await body.findByTestId('direct-link-share-dialog');
	await expect(
		await within(dialog).findByAltText('QR-Code zum Direktlink')
	).toBeInTheDocument();
	await userEvent.click(
		within(dialog).getByRole('button', { name: 'Fertig' })
	);
	const list = await canvas.findByRole('region', {
		name: 'Meine Direktlinks'
	});
	await expect(within(list).getAllByText('Schulden')[0]).toBeInTheDocument();
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

export const DirectLinkFlowDesktop: Story = {
	name: 'Direct link — create, share, my links (desktop)',
	parameters: {
		docs: {
			description: {
				story: '#1795, clickable. Choose a topic and a medium, create the link, share it, then land in "Gespräche", where the overview lists the new link under "Meine Direktlinks". The temporary-account switch follows the medium (chat off, calls on) and can be changed.'
			}
		}
	},
	render: () => (
		<DesktopShell>
			<FormatPicker compact={false} />
		</DesktopShell>
	),
	play: async ({ canvasElement }) => createVideoLink(canvasElement)
};

export const DirectLinkFlowMobile: Story = {
	name: 'Direct link — create, share, my links (phone 390)',
	render: () => (
		<MobileShell>
			<FormatPicker compact />
		</MobileShell>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			await within(canvasElement).findByRole('button', {
				name: /Direktlink/
			})
		);
		await createVideoLink(canvasElement);
	}
};

export const DashboardWithLinks: Story = {
	name: 'Gespräche — overview with direct links and circles',
	parameters: {
		docs: {
			description: {
				story: 'What "Gespräche" shows while no conversation is selected, once the counsellor has a direct link or an upcoming circle. Tiles on the grey app background, no empty conversation room. Figures come from the counsellor statistics service; "Archiviert" needs a new field there. Figures and circles are sample data.'
			}
		}
	},
	render: () => (
		<DashboardStory initial={SAMPLE_LINKS} circles={UPCOMING_CIRCLES} />
	)
};

export const DashboardSparse: Story = {
	name: 'Gespräche — overview, just started: one link',
	parameters: {
		docs: {
			description: {
				story: 'Little has happened yet: two figures, one direct link, no circles (most counsellors run none). The dashed tile leads to "Create chat".'
			}
		}
	},
	render: () => (
		<DashboardStory
			initial={[SAMPLE_LINKS[0]]}
			circles={[]}
			stats={SPARSE_STATS}
		/>
	)
};

export const DashboardNothingYet: Story = {
	name: 'Gespräche — nothing yet: the turning cup stays',
	render: () => (
		<SessionCardShell>
			<DashboardStory initial={[]} circles={[]} />
		</SessionCardShell>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByTestId('counsellor-dashboard')
		).toBeNull();
	}
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
					>
						{compact && (
							<SplitButton
								ref={topicRef}
								fullWidth
								icon={<TopicIcon filled={Boolean(topic)} />}
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
	),
	play: async ({ canvasElement }) => expectCardsMatch(canvasElement)
};

export const CircleSettingsMobile: Story = {
	render: () => (
		<MobileShell>
			<CircleSettings compact />
		</MobileShell>
	)
};
