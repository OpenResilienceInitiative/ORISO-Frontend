/**
 * Header molecule for a side panel — the Figma "Room Header All"
 * (1320:38281 → Chat Room Desktop) in the panel: the participant avatar
 * stack of the room (same `MessageAvatar` atom as the chat, T1/T4), the
 * counterpart name as the title, the actions on the right and the
 * `primary-fixed` hairline. Same paddings as the session header so both
 * hairlines end on the same y (T3).
 *
 * T26: the line under the hairline — where the main chat shows its topic
 * tag — says what this room is and nothing more: "Supervision" or the
 * thread's name ("Thread #2", the same stable number as in the channel
 * card). That line IS the menu button (T19): icon, word, a chevron right
 * after it that turns while the menu is open. It opens the channel card
 * (`ChannelMenu`, T20) with *every* secondary channel of the session —
 * supervision first, threads by recency — anchored below the line. The
 * explanatory sentence ("Antworten auf eine Nachricht …") is gone. The
 * FAB hides while a panel is open (T1, T15). When the line is tight the
 * channel word gives way to the participant count (`panelHeaderState.ts`).
 */
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { ReactComponent as ChevronIcon } from '../../resources/img/icons/keyboard_arrow_down.svg';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as SupervisionGlyph } from '../../resources/img/icons/supervision_circ_400_24px.svg';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
import type { StackParticipant } from '../message/participantStack';
import { ChannelMenu } from './ChannelMenu';
import {
	boundsAboveComposer,
	useChannelMenuPlacement
} from './useChannelMenuPlacement';
import type {
	SecondaryChannel,
	SecondaryChannelKind
} from './channelSwitcherState';
import {
	derivePanelChannelMenu,
	resolveActiveThreadNumber,
	resolvePanelKindLabel
} from './panelHeaderState';
import './sidePanel.styles.scss';

export interface PanelHeaderProps {
	/** Which kind of side room — picks the icon next to the section word. */
	'kind': SecondaryChannelKind;
	/**
	 * Channel word: "Supervision" / "Thread". A shown thread is named with
	 * its stable number ("Thread #2", T26) when `channels` lists it.
	 */
	'title': string;
	/** Counterpart shown as the main line: "Bettina B.". */
	'name'?: string;
	/** People in the side room, rendered as the avatar stack. */
	'participants'?: StackParticipant[];
	/** Role chip text ("Supervision" / "Beratung"). */
	'chip'?: string;
	'unreadCount'?: number;
	/**
	 * All secondary channels of the conversation (T15/T20). The channel
	 * button lists them in the channel card, the shown one
	 * (`activeChannelId`) marked; with nothing else to switch to the button
	 * is disabled (house rule: disable, never hide).
	 */
	'channels'?: SecondaryChannel[];
	/** Id of the channel this panel shows. */
	'activeChannelId'?: string;
	'onSelectChannel'?: (channelId: string) => void;
	/** T27: supervision on/off switch in the card (presentational until B2). */
	'supervisionActive'?: boolean;
	'onToggleSupervision'?: (active: boolean) => void;
	/**
	 * Review v6: the host sets it when this panel was opened from the FAB —
	 * the FAB unmounts with the pick (the header replaces it), so focus
	 * would otherwise drop to <body>. The channel button takes it whenever
	 * the shown channel changes while this is on.
	 */
	'autoFocusChannelButton'?: boolean;
	/** Phone: back to the main chat. Rendered before the title. */
	'onBack'?: () => void;
	/** Desktop: close the panel. Rendered at the end of the row. */
	'onClose'?: () => void;
	/** Extra actions before the close button. */
	'actions'?: React.ReactNode;
	'data-cy'?: string;
}

const kindGlyph = (kind: SecondaryChannelKind) =>
	kind === 'thread' ? ThreadGlyph : SupervisionGlyph;

export const PanelHeader = ({
	kind,
	title,
	name,
	participants = [],
	chip,
	unreadCount = 0,
	channels = [],
	activeChannelId,
	onSelectChannel,
	supervisionActive,
	onToggleSupervision,
	autoFocusChannelButton = false,
	onBack,
	onClose,
	actions,
	'data-cy': dataCy = 'panel-header'
}: PanelHeaderProps) => {
	const { t: translate } = useTranslation();
	const [optionsOpen, setOptionsOpen] = useState(false);
	const optionsRef = useRef<HTMLDivElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const optionsButtonRef = useRef<HTMLButtonElement | null>(null);
	const headerRef = useRef<HTMLElement | null>(null);
	const menuId = useId();
	const Glyph = kindGlyph(kind);
	const menu = derivePanelChannelMenu(channels, activeChannelId);
	const hasOptions = menu.switchable;

	// T26: the channel word names the shown thread with its card number.
	const threadNumber =
		kind === 'thread'
			? resolveActiveThreadNumber(channels, activeChannelId)
			: null;
	const channelWord =
		threadNumber !== null
			? translate('chatStage.menu.thread', { n: threadNumber })
			: title;

	// T15: measure the channel line; below the minimum the label becomes
	// the participant count (like the room header's "+N").
	const titleRef = useRef<HTMLDivElement | null>(null);
	const [titleWidth, setTitleWidth] = useState<number | null>(null);
	useLayoutEffect(() => {
		const element = titleRef.current;
		if (!element || typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const measure = () =>
			setTitleWidth(element.getBoundingClientRect().width);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const kindLabel = resolvePanelKindLabel({
		titleWidth,
		label: channelWord,
		participantCount: participants.length
	});
	const participantCountLabel = translate(
		'chatStage.panel.participantCount',
		{ count: participants.length }
	);

	// Review v6: the card ends above the room's docked composer — with many
	// threads the list scrolls inside instead of sliding behind it.
	const resolveBounds = useCallback(
		() =>
			boundsAboveComposer(
				menuRef.current?.closest<HTMLElement>('.sidePanel, .session') ??
					null
			),
		[]
	);
	const placement = useChannelMenuPlacement({
		open: optionsOpen && hasOptions,
		// The card hangs from the whole header (hairline included).
		anchorRef: headerRef,
		menuRef,
		resolveBounds,
		prefer: 'down',
		flip: false
	});

	useEffect(() => {
		if (autoFocusChannelButton) {
			optionsButtonRef.current?.focus();
		}
	}, [autoFocusChannelButton, activeChannelId]);

	const closeOptions = useCallback(() => setOptionsOpen(false), []);
	const closeAndRefocus = useCallback(() => {
		setOptionsOpen(false);
		optionsButtonRef.current?.focus();
	}, []);

	useEffect(() => {
		if (!optionsOpen) {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				!optionsRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				closeOptions();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeAndRefocus();
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [optionsOpen, closeOptions, closeAndRefocus]);

	const unreadLabel =
		unreadCount > 0
			? translate('supervision.panel.unread', { count: unreadCount })
			: '';
	const optionsLabel = translate(
		hasOptions
			? 'chatStage.panel.channelOptions'
			: 'chatStage.panel.channelOptionsEmpty'
	);

	return (
		// `data-keeps-focus`: the composer's autofocus must not pull focus
		// off these buttons (review v6, `focusGuards.ts`).
		<header
			className="panelHeader"
			data-cy={dataCy}
			data-keeps-focus=""
			ref={headerRef}
		>
			<div className="panelHeader__row">
				{onBack && (
					<button
						type="button"
						className="panelHeader__backButton"
						onClick={onBack}
						aria-label={translate('chatStage.panel.back')}
						title={translate('chatStage.panel.back')}
						data-cy="panel-header-back"
					>
						<BackIcon aria-hidden="true" />
					</button>
				)}
				{participants.length > 0 && (
					<ParticipantAvatarStack
						participants={participants}
						className="panelHeader__participants"
						data-cy="panel-header-participants"
					/>
				)}
				<div
					className="panelHeader__title"
					data-cy="panel-header-title"
				>
					<h2 className="panelHeader__name">
						<span
							className="panelHeader__titleName"
							data-cy="panel-header-name"
						>
							{name || title}
						</span>
					</h2>
				</div>
				{chip && (
					<span
						className="panelHeader__chip"
						data-cy="panel-header-chip"
					>
						{chip}
					</span>
				)}
				{unreadCount > 0 && (
					<span
						className="panelHeader__unread"
						data-cy="panel-header-unread"
						aria-label={unreadLabel}
						title={unreadLabel}
					>
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
				<div className="panelHeader__actions">
					{actions}
					{onClose && (
						<button
							type="button"
							className="panelHeader__iconButton"
							onClick={onClose}
							aria-label={translate('chatStage.panel.close')}
							title={translate('chatStage.panel.close')}
							data-cy="panel-header-close"
						>
							<CloseIcon aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
			{/* T26: the line under the hairline — the room's own name and
			    the menu button in one; no explanatory sentence any more. */}
			<div
				className="panelHeader__divider"
				data-kind-label={kindLabel.mode}
				ref={titleRef}
			>
				<div
					className="panelHeader__kind"
					ref={optionsRef}
					data-cy="panel-header-kind"
				>
					<button
						ref={optionsButtonRef}
						type="button"
						className={[
							'panelHeader__kindButton',
							optionsOpen && 'panelHeader__kindButton--open'
						]
							.filter(Boolean)
							.join(' ')}
						data-cy="panel-header-channel-options"
						aria-label={[
							channelWord,
							kindLabel.mode === 'count'
								? participantCountLabel
								: '',
							optionsLabel
						]
							.filter(Boolean)
							.join(' – ')}
						title={
							kindLabel.mode === 'count'
								? `${channelWord} · ${participantCountLabel}`
								: optionsLabel
						}
						aria-haspopup="menu"
						aria-expanded={optionsOpen}
						aria-controls={optionsOpen ? menuId : undefined}
						disabled={!hasOptions}
						onClick={() => setOptionsOpen((value) => !value)}
					>
						<Glyph
							className="panelHeader__kindIcon"
							aria-hidden="true"
						/>
						<span
							className={`panelHeader__titleLabel panelHeader__titleLabel--${kindLabel.mode}`}
							data-cy="panel-header-kind-label"
							data-mode={kindLabel.mode}
						>
							{kindLabel.text}
						</span>
						{/* T19/T26: the word opens a menu — the chevron right
						    after it says so. */}
						<ChevronIcon
							className="panelHeader__kindChevron"
							data-cy="panel-header-kind-chevron"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>
			{optionsOpen && hasOptions && (
				// T20: the channel card hangs below the whole header (hairline
				// and channel line included), never over the title.
				<div
					className="panelHeader__menu"
					ref={menuRef}
					data-cy="panel-header-channel-menu"
				>
					<ChannelMenu
						id={menuId}
						channels={channels}
						activeChannelId={activeChannelId}
						supervisionActive={supervisionActive}
						onToggleSupervision={onToggleSupervision}
						maxHeight={placement?.maxHeight}
						onSelect={(channelId) => {
							if (channelId !== activeChannelId) {
								onSelectChannel?.(channelId);
							}
						}}
						onClose={closeAndRefocus}
					/>
				</div>
			)}
		</header>
	);
};

export default PanelHeader;
