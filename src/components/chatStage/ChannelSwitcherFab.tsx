/**
 * Channel switcher FAB — Figma "FAB menu" 9748:60084.
 *
 * Bottom-right above the composer. One FAB for every *secondary* channel of
 * the open conversation (supervision side room, open threads):
 *
 * - grey (`tertiary`) while everything is read, unread/error role when a
 *   channel has new messages (same role as the existing unread badges);
 * - a single channel → the FAB opens it directly (thread or supervision glyph);
 * - several channels → speed dial: one segment per channel, threads on top,
 *   supervision right above the FAB, the FAB turns into the close X;
 * - on the phone the same FAB sits inside the secondary chat and switches
 *   back (`activeChannelId` + `onBack`).
 *
 * Pure state comes from `channelSwitcherState.ts`; this file only renders.
 */
import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as SupervisionGlyph } from '../../resources/img/icons/supervision_circ_400_24px.svg';
import { ReactComponent as SupervisionAttentionGlyph } from '../../resources/img/icons/supervision_on_400_24px.svg';
import { ReactComponent as CloseGlyph } from '../../resources/img/icons/fab-menu-close.svg';
import { ReactComponent as BackGlyph } from '../../resources/img/icons/close.svg';
import { ReactComponent as MainChatGlyph } from '../../resources/img/icons/speech-bubble.svg';
import {
	deriveChannelSwitcherState,
	type ChannelSwitcherItem,
	type SecondaryChannel,
	type SecondaryChannelKind
} from './channelSwitcherState';
import './channelSwitcherFab.styles.scss';

export interface ChannelSwitcherFabProps {
	'channels': SecondaryChannel[];
	'onSelect': (channelId: string) => void;
	/**
	 * Phone: the channel currently filling the screen. It is left out of the
	 * menu and the FAB (or the bottom segment) leads back to the main chat.
	 */
	'activeChannelId'?: string;
	'onBack'?: () => void;
	/** `absolute` inside the chat card (default) or `fixed` to the viewport. */
	'positionMode'?: 'absolute' | 'fixed';
	/** Distance from the bottom edge, e.g. above the phone's bottom nav. */
	'bottomOffset'?: number;
	/** Start with the speed dial open (stories / comparisons). */
	'defaultOpen'?: boolean;
	/**
	 * T1: while a side panel is open its header icon offers the same channel
	 * options, so the FAB steps back. Renders nothing (the stage keeps the
	 * prop so the FAB returns the moment the panel closes).
	 */
	'fabHidden'?: boolean;
	'className'?: string;
	'data-cy'?: string;
}

/** T9: `supervision_on` = attention (new message), `supervision_circ` = idle. */
export const glyphFor = (
	kind: SecondaryChannelKind,
	variant: 'idle' | 'attention' = 'idle'
) =>
	kind === 'thread'
		? ThreadGlyph
		: variant === 'attention'
			? SupervisionAttentionGlyph
			: SupervisionGlyph;

const UnreadBadge = ({ count }: { count: number }) =>
	count > 0 ? (
		<span className="channelSwitcher__badge" aria-hidden="true">
			{count > 99 ? '99+' : count}
		</span>
	) : null;

export interface ChannelSwitcherMenuProps {
	id?: string;
	items: ChannelSwitcherItem[];
	onSelect: (item: ChannelSwitcherItem) => void;
	/** Phone: an extra bottom entry that leads back to the main chat. */
	onBack?: () => void;
	className?: string;
}

/**
 * The speed-dial list on its own — the FAB opens it above itself, the
 * side-panel header (T1) opens the same list under its channel icon.
 */
export const ChannelSwitcherMenu = ({
	id,
	items,
	onSelect,
	onBack,
	className
}: ChannelSwitcherMenuProps) => {
	const { t: translate } = useTranslation();
	const kindLabel = (kind: SecondaryChannelKind) =>
		translate(`chatStage.switcher.kind.${kind}`);
	const unreadLabel = (count: number) =>
		count > 0 ? translate('supervision.panel.unread', { count }) : '';
	return (
		<ul
			className={['channelSwitcher__menu', className]
				.filter(Boolean)
				.join(' ')}
			role="menu"
			id={id}
			aria-label={translate('chatStage.switcher.openMenu')}
		>
			{items.map((item) => {
				const Glyph = glyphFor(
					item.kind,
					item.unread > 0 ? 'attention' : 'idle'
				);
				return (
					<li key={item.id} role="none">
						<button
							type="button"
							role="menuitem"
							className={`channelSwitcher__item channelSwitcher__item--${item.kind}`}
							data-cy={`channel-switcher-item-${item.kind}`}
							data-channel-id={item.id}
							aria-label={[
								translate('chatStage.switcher.openChannel', {
									label: `${kindLabel(item.kind)} ${item.label}`
								}),
								unreadLabel(item.unread)
							]
								.filter(Boolean)
								.join(' – ')}
							onClick={() => onSelect(item)}
						>
							<Glyph
								className="channelSwitcher__itemIcon"
								aria-hidden="true"
							/>
							<span className="channelSwitcher__itemLabel">
								{item.label}
							</span>
							<UnreadBadge count={item.unread} />
						</button>
					</li>
				);
			})}
			{onBack && (
				<li role="none">
					<button
						type="button"
						role="menuitem"
						className="channelSwitcher__item channelSwitcher__item--main"
						data-cy="channel-switcher-item-main"
						aria-label={translate('chatStage.switcher.backToMain')}
						onClick={onBack}
					>
						<MainChatGlyph
							className="channelSwitcher__itemIcon"
							aria-hidden="true"
						/>
						<span className="channelSwitcher__itemLabel">
							{translate('chatStage.switcher.mainChat')}
						</span>
					</button>
				</li>
			)}
		</ul>
	);
};

export const ChannelSwitcherFab = ({
	channels,
	onSelect,
	activeChannelId,
	onBack,
	positionMode = 'absolute',
	bottomOffset = 16,
	defaultOpen = false,
	fabHidden = false,
	className,
	'data-cy': dataCy = 'channel-switcher'
}: ChannelSwitcherFabProps) => {
	const { t: translate } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const fabRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();

	const state = deriveChannelSwitcherState(
		channels.filter((channel) => channel.id !== activeChannelId)
	);
	const insideSecondary = Boolean(activeChannelId && onBack);
	// With the back entry the dial has one more row than the state knows.
	const menuRows = state.items.length + (insideSecondary ? 1 : 0);
	const isMenu = menuRows > 1;

	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		if (!open) {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				close();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				close();
				fabRef.current?.focus();
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, close]);

	if (menuRows === 0 || fabHidden) {
		return null;
	}

	const pick = (item: ChannelSwitcherItem) => {
		close();
		onSelect(item.id);
	};
	const back = () => {
		close();
		onBack?.();
	};

	const kindLabel = (kind: SecondaryChannelKind) =>
		translate(`chatStage.switcher.kind.${kind}`);
	const unreadLabel = (count: number) =>
		count > 0 ? translate('supervision.panel.unread', { count }) : '';

	let fabLabel: string;
	let onFabClick: () => void;
	let FabGlyph: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	if (isMenu) {
		fabLabel = [
			translate(
				open
					? 'chatStage.switcher.closeMenu'
					: 'chatStage.switcher.openMenu'
			),
			unreadLabel(state.totalUnread)
		]
			.filter(Boolean)
			.join(' – ');
		onFabClick = () => setOpen((value) => !value);
		FabGlyph = open
			? CloseGlyph
			: state.iconKind
				? glyphFor(state.iconKind, state.variant)
				: MainChatGlyph;
	} else if (state.items.length === 1) {
		const only = state.items[0];
		fabLabel = [
			translate('chatStage.switcher.openChannel', {
				label: `${kindLabel(only.kind)} ${only.label}`
			}),
			unreadLabel(only.unread)
		]
			.filter(Boolean)
			.join(' – ');
		onFabClick = () => pick(only);
		FabGlyph = glyphFor(only.kind, state.variant);
	} else {
		fabLabel = translate('chatStage.switcher.backToMain');
		onFabClick = back;
		FabGlyph = BackGlyph;
	}

	const classes = [
		'channelSwitcher',
		`channelSwitcher--${positionMode}`,
		open && 'channelSwitcher--open',
		className
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			ref={rootRef}
			className={classes}
			style={{ bottom: bottomOffset }}
			data-cy={dataCy}
			data-variant={state.variant}
			data-mode={isMenu ? 'menu' : 'single'}
		>
			{isMenu && open && (
				<ChannelSwitcherMenu
					id={menuId}
					items={state.items}
					onSelect={pick}
					onBack={insideSecondary ? back : undefined}
				/>
			)}
			<button
				ref={fabRef}
				type="button"
				className={`channelSwitcher__fab channelSwitcher__fab--${state.variant}`}
				data-cy="channel-switcher-fab"
				aria-label={fabLabel}
				title={fabLabel}
				aria-haspopup={isMenu ? 'menu' : undefined}
				aria-expanded={isMenu ? open : undefined}
				aria-controls={isMenu && open ? menuId : undefined}
				onClick={onFabClick}
			>
				<FabGlyph
					className="channelSwitcher__fabIcon"
					aria-hidden="true"
				/>
				{!open && <UnreadBadge count={state.totalUnread} />}
			</button>
		</div>
	);
};

export default ChannelSwitcherFab;
