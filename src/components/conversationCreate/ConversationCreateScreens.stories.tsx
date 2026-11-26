import * as React from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
import { FormatPickerCard } from './FormatPickerCard';
import { expectArrowStepsOneCard } from '../hoverScrollArrows/hoverScrollArrowsStoryPlay';
import { FormatCard } from './FormatCard';
import { FormatCardCarousel } from './FormatCardCarousel';
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
import { useCreateViewExit } from './useCreateViewExit';
import {
	CounsellorDashboard,
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

/** Sample figures. */
const DASHBOARD_STATS: DashboardStats = {
	assignedSessions: 3,
	activeSessions: 18
};

/** A counsellor who has just started: few figures, one link, no circles. */
const SPARSE_STATS: DashboardStats = {
	assignedSessions: 1,
	activeSessions: 2
};

/** #1795: what the backend will hand back; story-only. */
const toDirectLink = (draft: DirectLinkDraft, index: number): DirectLink => ({
	id: `link-${index}`,
	name: draft.topic,
	topic: draft.topic,
	medium: draft.medium,
	temporary: draft.guestAccountMode !== 'PERMANENT',
	guestAccountMode: draft.guestAccountMode,
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
				<DesktopFrame
					framed={!compact}
					onCreate={() => setStep('picker')}
				>
					<CounsellorDashboard
						headline={t('session.emptyAllCaughtUp')}
						variant="conversation-nothing-to-do"
						stats={DASHBOARD_STATS}
					/>
				</DesktopFrame>
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
					<div className="conversationCreate__selection">
						{compact ? (
							<FormatCardCarousel className="formatCardCarousel--compact">
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<InternalIcon />}
										title={t('groupChat.internal.title')}
										subtitle={t(
											'groupChat.internal.subtitle'
										)}
										text={t('groupChat.internal.cardShort')}
										image={INTERNAL_CHAT_ARTWORK}
										onSelect={() => undefined}
									/>
								</div>
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<CircleIcon />}
										title={t('groupChat.circle.title')}
										subtitle={t(
											'groupChat.circle.subtitle'
										)}
										text={t(
											'groupChat.circle.cardHeadline'
										)}
										image={getTopicCardArtwork(null)}
										onSelect={() => undefined}
									/>
								</div>
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<LinkOutlinedIcon />}
										title={t('directLink.card.title')}
										subtitle={t('directLink.card.subtitle')}
										text={t('directLink.card.headline')}
										image={FORMAT_ARTWORK.VIDEO}
										onSelect={() => setStep('directLink')}
									/>
								</div>
							</FormatCardCarousel>
						) : (
							<FormatCardCarousel>
								<div className="formatCardCarousel__slide">
									<CircleCard menuOpen={menuOpen} />
								</div>
								<div className="formatCardCarousel__slide">
									<InternaCard preset="empty" />
								</div>
								<div className="formatCardCarousel__slide">
									{directLinkCard}
								</div>
							</FormatCardCarousel>
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

/**
 * Story-only stand-in for the desktop app: navigation rail and the
 * conversation list, whose width can be dragged (bottom-right corner) to see
 * the overview follow its pane. "Erstellen" is the list's create chip.
 */
const DesktopFrame = ({
	children,
	framed = true,
	onCreate
}: {
	children: React.ReactNode;
	framed?: boolean;
	onCreate?: () => void;
}) => {
	const { t } = useTranslation();
	if (!framed) return <>{children}</>;
	const surface = 'var(--m3-surface-container-high, #eae7e8)';
	return (
		<div
			style={{
				background: surface,
				boxSizing: 'border-box',
				display: 'flex',
				gap: 8,
				height: '100vh',
				padding: '8px 0 8px 8px'
			}}
		>
			<nav
				aria-label="Navigation"
				style={{
					alignItems: 'center',
					display: 'flex',
					flex: '0 0 72px',
					flexDirection: 'column',
					gap: 20,
					paddingTop: 16
				}}
			>
				{[0, 1, 2, 3].map((item) => (
					<span
						key={item}
						style={{
							background:
								item === 0
									? 'var(--m3-secondary-container, #646d78)'
									: 'var(--m3-outline-variant, #c4c7c8)',
							borderRadius: 16,
							height: 32,
							width: 56
						}}
					/>
				))}
			</nav>
			<aside
				aria-label={t('notifications.displayFilter.sections.sessions')}
				style={{
					background: 'var(--m3-surface-container-lowest, #ffffff)',
					borderRadius: 24,
					boxSizing: 'border-box',
					display: 'flex',
					flex: '0 0 auto',
					flexDirection: 'column',
					gap: 12,
					maxWidth: 640,
					minWidth: 300,
					overflow: 'auto',
					padding: 16,
					resize: 'horizontal',
					width: 380
				}}
			>
				<button
					type="button"
					onClick={onCreate}
					style={{
						alignSelf: 'flex-start',
						background: 'var(--m3-primary, #a5000a)',
						border: 'none',
						borderRadius: 8,
						color: 'var(--m3-on-primary, #ffffff)',
						cursor: 'pointer',
						fontSize: 14,
						fontWeight: 500,
						padding: '8px 16px'
					}}
				>
					+ {t('sessionList.toolbar.chips.create')}
				</button>
				{[0, 1, 2, 3, 4].map((row) => (
					<span
						key={row}
						style={{
							background: 'var(--m3-surface-container, #f0edee)',
							borderRadius: 16,
							height: 72
						}}
					/>
				))}
			</aside>
			<div style={{ flex: 1, minWidth: 0 }}>{children}</div>
		</div>
	);
};

/** Creates a video link end to end and lands in the overview. */
const DashboardStory = ({
	stats = DASHBOARD_STATS
}: {
	stats?: DashboardStats;
}) => {
	const { t } = useTranslation();
	return (
		<DesktopFrame>
			<CounsellorDashboard
				headline={t('session.emptyAllCaughtUp')}
				variant="conversation-nothing-to-do"
				stats={stats}
			/>
		</DesktopFrame>
	);
};

const createVideoLink = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const body = within(document.body);
	// #2252: "Direktlink" is now called "Direkteinladung".
	const heading = await canvas.findByRole('heading', {
		name: 'Direkteinladung'
	});
	const card = within(heading.closest('section') as HTMLElement);
	// The split button carries the label on both of its halves.
	await userEvent.click(
		card.getAllByRole('button', { name: 'Thema wählen' })[0]
	);
	await userEvent.click(
		await body.findByRole('option', { name: 'Schulden' })
	);
	await userEvent.click(card.getByRole('button', { name: /Videoanruf/ }));
	// Calls default to the guest choosing the account (UserService#1662).
	await expect(
		card.getByRole('button', { name: 'Gast wählt' })
	).toBeInTheDocument();
	await userEvent.click(card.getByRole('button', { name: 'Link erstellen' }));
	const dialog = await body.findByTestId('direct-link-share-dialog');
	await expect(
		await within(dialog).findByAltText('QR-Code zur Direkteinladung')
	).toBeInTheDocument();
	await userEvent.click(
		within(dialog).getByRole('button', { name: 'Fertig' })
	);
	// Variant C (2026-11-25): the overview no longer lists links; it lands on
	// the quiet cup with two figures. Links are managed in "Meine Termine".
	const overview = await canvas.findByTestId('counsellor-dashboard');
	await expect(
		within(overview).getByTestId('counsellor-dashboard-figures')
	).toBeInTheDocument();
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
	globals: { viewport: { value: 'phone390' } },
	render: () => (
		<MobileShell>
			<FormatPicker compact />
		</MobileShell>
	),
	play: async ({ canvasElement }) => {
		// Phone: the rows render (as in the app below 900px) and the intro
		// paragraph above them is dropped; the rows' own subtitles say it.
		const subtitle = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'.conversationCreate__picker--compact .conversationCreate__subtitle'
			);
			expect(found).toBeTruthy();
			return found!;
		});
		await expect(getComputedStyle(subtitle).display).toBe('none');
	}
};

/**
 * The cards keep their size and the row scrolls: in a pane too narrow for all
 * three, the round arrows below move the row one card at a time and are
 * disabled at the ends (Figma 7633-34734).
 */
export const FormatCardsScrollNarrow: Story = {
	name: 'Format cards — edge arrows on hover (narrow pane)',
	render: () => (
		<div style={{ background: '#e9e6e6', padding: 16 }}>
			<div
				style={{
					background: '#fcf9f9',
					borderRadius: 32,
					margin: '0 auto',
					maxWidth: 720,
					overflow: 'hidden'
				}}
			>
				<FormatPicker compact={false} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		// The waiting rooms' edge control: no arrow at the start, the right
		// one fades in near the right edge and moves exactly one card.
		await expectArrowStepsOneCard(
			canvasElement,
			'format-card-carousel-track',
			'format-card-carousel-arrows'
		);
		// The row overflows, so page dots show there is more (touch too).
		await expect(
			canvasElement.querySelector('[data-cy="format-card-carousel-dots"]')
		).toBeTruthy();
		// Every card has the same height, whatever its content.
		const heights = new Set(
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>(
					'.formatCardCarousel__slide'
				)
			).map((slide) => Math.round(slide.getBoundingClientRect().height))
		);
		await expect(heights.size).toBe(1);
		// No label in the cards is cut off.
		const cut = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'.formatCard button, .formatCard [class*="__label"]'
			)
		).filter((el) => el.scrollWidth > el.clientWidth);
		await expect(cut).toHaveLength(0);
	}
};

/** Phone width: one card plus a peek of the next one, arrows underneath. */
export const FormatCardsScrollPhone: Story = {
	name: 'Format cards — scroll row (phone, 390px)',
	render: () => (
		// Edge to edge, like the app on a phone: the panel's own 12px padding
		// leaves 366px, enough for one 360px card.
		<div style={{ background: '#fcf9f9', margin: '0 auto', maxWidth: 390 }}>
			<FormatPicker compact={false} />
		</div>
	)
};

const STORY_TRIGGER = '[data-testid="story-create-trigger"]';

/**
 * The open create view: the same screen as the format picker. Desktop is the
 * three cards; the phone is the column of rows, and choosing Interna opens
 * that card. It owns the exit hook, like the app's route does.
 */
const OpenCreateView = ({
	compact,
	onLeave
}: {
	compact: boolean;
	onLeave: () => void;
}) => {
	const { t } = useTranslation();
	const [phoneStep, setPhoneStep] = useState<'rows' | 'internal'>('rows');
	const { surfaceRef, onInput, discardDialog } = useCreateViewExit({
		onLeave,
		triggerSelector: STORY_TRIGGER
	});
	const showInternal = compact && phoneStep === 'internal';
	return (
		<div className="conversationCreate" ref={surfaceRef} onInput={onInput}>
			<PanelHeader
				title={t('groupChat.format.panelTitle')}
				menuLabel={t('groupChat.format.panelMenu')}
				menuDisabled
			/>
			{showInternal ? (
				<div className="conversationCreate__single conversationCreate__single--compact">
					<InternaCard preset="empty" />
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
					<div className="conversationCreate__selection">
						{compact ? (
							<FormatCardCarousel className="formatCardCarousel--compact">
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<InternalIcon />}
										title={t('groupChat.internal.title')}
										subtitle={t(
											'groupChat.internal.subtitle'
										)}
										text={t('groupChat.internal.cardShort')}
										image={INTERNAL_CHAT_ARTWORK}
										onSelect={() =>
											setPhoneStep('internal')
										}
									/>
								</div>
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<CircleIcon />}
										title={t('groupChat.circle.title')}
										subtitle={t(
											'groupChat.circle.subtitle'
										)}
										text={t(
											'groupChat.circle.cardHeadline'
										)}
										image={getTopicCardArtwork(null)}
										onSelect={() => undefined}
									/>
								</div>
								<div className="formatCardCarousel__slide">
									<FormatPickerCard
										icon={<LinkOutlinedIcon />}
										title={t('directLink.card.title')}
										subtitle={t('directLink.card.subtitle')}
										text={t('directLink.card.headline')}
										image={FORMAT_ARTWORK.VIDEO}
										onSelect={() => undefined}
									/>
								</div>
							</FormatCardCarousel>
						) : (
							<FormatCardCarousel>
								<div className="formatCardCarousel__slide">
									<CircleCard />
								</div>
								<div className="formatCardCarousel__slide">
									<InternaCard preset="empty" />
								</div>
								<div className="formatCardCarousel__slide">
									<DirectLinkCard
										topics={TOPICS}
										onCreate={() => undefined}
									/>
								</div>
							</FormatCardCarousel>
						)}
					</div>
				</div>
			)}
			{/* Empty band under the formats: a click here leaves the view. */}
			<div
				className="conversationCreate__selection"
				data-testid="story-panel-gap"
				style={{ minHeight: 48 }}
			/>
			{compact && (
				<BackPill
					label={t('groupChat.format.back')}
					onClick={() => setPhoneStep('rows')}
				/>
			)}
			{discardDialog}
		</div>
	);
};

/**
 * The create view beside the list: "Erstellen" opens it, a click into empty
 * space or Escape closes it again, typed input asks first, the list and its
 * buttons keep working and focus returns to "Erstellen".
 */
const CloseFromOutsideHarness = ({ compact }: { compact: boolean }) => {
	const { t } = useTranslation();
	const [open, setOpen] = useState(true);
	const [searches, setSearches] = useState(0);
	const createLabel = t('sessionList.toolbar.chips.create');
	const search = (
		<button
			type="button"
			onClick={() => setSearches((n) => n + 1)}
			style={{
				background: 'var(--m3-surface-container, #f0edee)',
				border: 'none',
				borderRadius: 20,
				cursor: 'pointer',
				font: 'inherit',
				padding: '8px 16px',
				whiteSpace: 'nowrap'
			}}
		>
			Suche ({searches})
		</button>
	);
	const trigger = (
		<button
			type="button"
			data-testid="story-create-trigger"
			data-tour-target="groupchat-create-button"
			onClick={() => setOpen(true)}
			style={{
				background: 'var(--m3-primary, #a5000a)',
				border: 'none',
				borderRadius: 20,
				color: 'var(--m3-on-primary, #ffffff)',
				cursor: 'pointer',
				font: 'inherit',
				fontWeight: 500,
				padding: '8px 16px',
				whiteSpace: 'nowrap'
			}}
		>
			+ {createLabel}
		</button>
	);
	const view = open ? (
		<OpenCreateView compact={compact} onLeave={() => setOpen(false)} />
	) : null;
	if (compact) {
		return (
			<MobileShell>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						minHeight: 720
					}}
				>
					<div
						data-testid="story-list"
						style={{
							alignItems: 'center',
							display: 'flex',
							gap: 8,
							padding: 12
						}}
					>
						{search}
						{trigger}
						<span
							data-testid="story-list-gap"
							style={{ flex: 1, minHeight: 36 }}
						/>
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						{view ?? (
							<div
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: 8,
									padding: 12
								}}
							>
								{[0, 1, 2].map((row) => (
									<span
										key={row}
										style={{
											background:
												'var(--m3-surface-container, #f0edee)',
											borderRadius: 16,
											height: 72
										}}
									/>
								))}
							</div>
						)}
					</div>
				</div>
			</MobileShell>
		);
	}
	const surface = 'var(--m3-surface-container-high, #eae7e8)';
	return (
		<div
			style={{
				background: surface,
				boxSizing: 'border-box',
				display: 'flex',
				gap: 8,
				minHeight: '100vh',
				padding: '8px 0 8px 8px'
			}}
		>
			<nav
				aria-label="Navigation"
				style={{
					alignItems: 'center',
					display: 'flex',
					flex: '0 0 72px',
					flexDirection: 'column',
					gap: 20,
					paddingTop: 16
				}}
			>
				{[0, 1, 2, 3].map((item) => (
					<span
						key={item}
						style={{
							background:
								item === 0
									? 'var(--m3-secondary-container, #646d78)'
									: 'var(--m3-outline-variant, #c4c7c8)',
							borderRadius: 16,
							height: 32,
							width: 56
						}}
					/>
				))}
			</nav>
			<aside
				data-testid="story-list"
				aria-label={t('notifications.displayFilter.sections.sessions')}
				style={{
					background: 'var(--m3-surface-container-lowest, #ffffff)',
					borderRadius: 24,
					boxSizing: 'border-box',
					display: 'flex',
					flex: '0 0 380px',
					flexDirection: 'column',
					gap: 12,
					padding: 16
				}}
			>
				{search}
				{trigger}
				{[0, 1, 2, 3].map((row) => (
					<span
						key={row}
						style={{
							background: 'var(--m3-surface-container, #f0edee)',
							borderRadius: 16,
							height: 72
						}}
					/>
				))}
				<span data-testid="story-list-gap" style={{ flex: 1 }} />
			</aside>
			<div
				style={{
					background: '#fcf9f9',
					borderRadius: '32px 0 0 32px',
					flex: 1,
					minWidth: 0,
					overflow: 'hidden'
				}}
			>
				{view}
			</div>
		</div>
	);
};

const playCloseFromOutside = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const body = within(document.body);
	const trigger = await canvas.findByTestId('story-create-trigger');
	const surface = () =>
		canvasElement.querySelector<HTMLElement>('.conversationCreate');
	await waitFor(() => expect(surface()).not.toBeNull());

	// 1. A click into empty space under the formats closes the view and hands
	// focus back to "Erstellen" (WCAG 2.4.3).
	const panelGap = () => canvas.getByTestId('story-panel-gap');
	await userEvent.click(panelGap());
	await waitFor(() => expect(surface()).toBeNull());
	await waitFor(() => expect(trigger).toHaveFocus());

	// 2. The list behind it works: a button there is clicked, not swallowed.
	await userEvent.click(trigger);
	await waitFor(() => expect(surface()).not.toBeNull());
	await userEvent.click(canvas.getByRole('button', { name: /Suche/ }));
	await expect(
		canvas.getByRole('button', { name: /Suche \(1\)/ })
	).toBeVisible();
	await expect(surface()).not.toBeNull();

	// 3. Empty space outside the panel closes it as well.
	await userEvent.click(canvas.getByTestId('story-list-gap'));
	await waitFor(() => expect(surface()).toBeNull());

	// 4. Escape closes it.
	await userEvent.click(trigger);
	await waitFor(() => expect(surface()).not.toBeNull());
	await userEvent.keyboard('{Escape}');
	await waitFor(() => expect(surface()).toBeNull());
	await waitFor(() => expect(trigger).toHaveFocus());

	// 5. Typed input is not lost silently: Escape asks first. On the phone the
	// name field is inside the Interna row, the same place the app opens it.
	await userEvent.click(trigger);
	if (!canvas.queryByRole('textbox', { name: 'Name Interna' })) {
		await userEvent.click(
			canvas.getByRole('button', { name: /Interna besprechen/ })
		);
	}
	const name = await canvas.findByRole('textbox', { name: 'Name Interna' });
	await userEvent.type(name, 'Wochenplanung');
	await userEvent.keyboard('{Escape}');
	const dialog = await body.findByRole('dialog', {
		name: 'Eingaben verwerfen?'
	});
	await expect(surface()).not.toBeNull();
	await userEvent.click(
		within(dialog).getByRole('button', { name: 'Weiter bearbeiten' })
	);
	await waitFor(() =>
		expect(
			body.queryByRole('dialog', { name: 'Eingaben verwerfen?' })
		).toBeNull()
	);
	// Nothing was lost.
	await expect(name).toHaveValue('Wochenplanung');
	await userEvent.click(panelGap());
	const again = await body.findByRole('dialog', {
		name: 'Eingaben verwerfen?'
	});
	await userEvent.click(
		within(again).getByRole('button', { name: 'Verwerfen und schließen' })
	);
	await waitFor(() => expect(surface()).toBeNull());
	await waitFor(() => expect(trigger).toHaveFocus());
};

export const CloseFromOutsideDesktop: Story = {
	name: 'Close view — empty space, Escape, unsaved input (desktop)',
	render: () => <CloseFromOutsideHarness compact={false} />,
	play: ({ canvasElement }) => playCloseFromOutside(canvasElement)
};

export const CloseFromOutsidePhone: Story = {
	name: 'Close view — empty space, Escape, unsaved input (phone, 390px)',
	globals: { viewport: { value: 'phone390' } },
	render: () => <CloseFromOutsideHarness compact />,
	play: ({ canvasElement }) => playCloseFromOutside(canvasElement)
};

/** The same harness at rest, so the open screen can be looked at on its own. */
export const CloseFromOutsideDesktopOpen: Story = {
	name: 'Close view — open (desktop)',
	render: () => <CloseFromOutsideHarness compact={false} />
};

export const CloseFromOutsidePhoneOpen: Story = {
	name: 'Close view — open (phone, 390px)',
	globals: { viewport: { value: 'phone390' } },
	render: () => <CloseFromOutsideHarness compact />
};

export const DirectLinkFlowDesktop: Story = {
	name: 'Direct link — create, share, my links (desktop)',
	parameters: {
		docs: {
			description: {
				story: '#1795, clickable. Choose a topic and a medium, create the link, share it, then land in the quiet "Gespräche" overview (cup and two figures; links are managed in "Meine Termine"). The temporary-account switch follows the medium (chat off, calls on) and can be changed.'
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
				name: /Direkteinladung/
			})
		);
		await createVideoLink(canvasElement);
	}
};

export const DashboardWithLinks: Story = {
	name: 'Gespräche — overview: the cup and two figures',
	parameters: {
		docs: {
			description: {
				story: 'What "Gespräche" shows while no conversation is selected (Frank, 2026-11-25, variant C): the turning cup and two small figures. Direct links are managed in "Meine Termine". Figures are sample data.'
			}
		}
	},
	render: () => <DashboardStory />
};

export const DashboardSparse: Story = {
	name: 'Gespräche — overview, just started',
	render: () => <DashboardStory stats={SPARSE_STATS} />
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
