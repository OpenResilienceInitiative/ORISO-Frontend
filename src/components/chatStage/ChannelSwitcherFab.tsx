/**
 * Channel switcher FAB — Figma "FAB menu" 9748:60084 (button) with the
 * channel card 9763:62964 as its menu (T20).
 *
 * Bottom-right above the composer. One FAB for every *secondary* channel of
 * the open conversation (supervision side room, open threads):
 *
 * - grey (`tertiary`) while everything is read, unread/error role when a
 *   channel has new messages (same role as the existing unread badges);
 * - a single channel → the FAB opens it directly (thread or supervision glyph);
 * - several channels → the FAB opens the channel card (`ChannelMenu`, the
 *   same list the side-panel header shows) above itself and turns into the
 *   close X;
 * - on the phone the same FAB sits inside the secondary chat and switches
 *   back (`activeChannelId` + `onBack`); the card gets a "main chat" row.
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
import { ChannelMenu } from './ChannelMenu';
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
	 * menu and the FAB (or the card's last row) leads back to the main chat.
	 */
	'activeChannelId'?: string;
	'onBack'?: () => void;
	/** `absolute` inside the chat card (default) or `fixed` to the viewport. */
	'positionMode'?: 'absolute' | 'fixed';
	/** Distance from the bottom edge, e.g. above the phone's bottom nav. */
	'bottomOffset'?: number;
	/** Start with the card open (stories / comparisons). */
	'defaultOpen'?: boolean;
	/**
	 * T1: while a side panel is open its header offers the same channel
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

	const otherChannels = channels.filter(
		(channel) => channel.id !== activeChannelId
	);
	const state = deriveChannelSwitcherState(otherChannels);
	const insideSecondary = Boolean(activeChannelId && onBack);
	// With the back row the card has one more row than the state knows.
	const menuRows = state.items.length + (insideSecondary ? 1 : 0);
	const isMenu = menuRows > 1;

	const close = useCallback(() => setOpen(false), []);
	const closeAndRefocus = useCallback(() => {
		setOpen(false);
		fabRef.current?.focus();
	}, []);

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
				closeAndRefocus();
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, close, closeAndRefocus]);

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
				<ChannelMenu
					id={menuId}
					className="channelSwitcher__menu"
					channels={otherChannels}
					onSelect={(channelId) => {
						close();
						onSelect(channelId);
					}}
					onClose={closeAndRefocus}
					onBack={insideSecondary ? onBack : undefined}
					data-cy="channel-switcher-menu"
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
