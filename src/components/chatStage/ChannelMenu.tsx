/**
 * Channel menu card — Figma "Menu" 9763:62964 / Frank's mockup (T20):
 *
 *   Abzweigungen zu diesem Gespräch      ← eyebrow, body/small, secondary
 *   Ableitende Gespräche                 ← title, body/strong
 *   ──────────────────────────────────   ← hairline
 *   [icon] Supervisionschat        ⇧S    ← always first
 *          Elena P.: ich kann nicht …    ← last message, one line
 *   [icon] Thread #1               ⇧1    ← threads by most recent message
 *          baer-mika-343: wissen sie …
 *
 * One list for both hosts: the side-panel header (anchored below the
 * header) and the FAB (anchored above it). The order, numbering,
 * shortcuts and previews come from `channelMenuModel.ts`; this file only
 * renders and moves focus: arrow keys, Home/End, Escape, ⇧S / ⇧1 … and
 * `aria-current` on the channel that is on screen.
 */
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as SupervisionGlyph } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as MainChatGlyph } from '../../resources/img/icons/speech-bubble.svg';
import {
	buildChannelMenu,
	moveMenuFocus,
	resolveMenuShortcut,
	type ChannelMenuRow
} from './channelMenuModel';
import type { SecondaryChannel } from './channelSwitcherState';
import './channelMenu.styles.scss';

export interface ChannelMenuProps {
	'id'?: string;
	/** Every channel to list (the host decides whether the shown one is in). */
	'channels': SecondaryChannel[];
	/** The channel on screen — marked with `aria-current`. */
	'activeChannelId'?: string;
	'onSelect': (channelId: string) => void;
	/** Escape (and after a pick) — the host closes and restores focus. */
	'onClose': () => void;
	/** Phone: an extra last row that leads back to the main chat. */
	'onBack'?: () => void;
	/** Focus the current (else first) row on mount. Default true. */
	'autoFocus'?: boolean;
	'className'?: string;
	'data-cy'?: string;
}

const UnreadBadge = ({ count }: { count: number }) =>
	count > 0 ? (
		<span className="channelMenu__badge" aria-hidden="true">
			{count > 99 ? '99+' : count}
		</span>
	) : null;

export const ChannelMenu = ({
	id,
	channels,
	activeChannelId,
	onSelect,
	onClose,
	onBack,
	autoFocus = true,
	className,
	'data-cy': dataCy = 'channel-menu'
}: ChannelMenuProps) => {
	const { t: translate } = useTranslation();
	const rows = useMemo(
		() => buildChannelMenu(channels, activeChannelId),
		[channels, activeChannelId]
	);
	// Rows plus the optional "main chat" row share one roving focus.
	const focusCount = rows.length + (onBack ? 1 : 0);
	const [focused, setFocused] = useState(() => {
		const active = rows.findIndex((row) => row.active);
		return active >= 0 ? active : 0;
	});
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const rootRef = useRef<HTMLDivElement | null>(null);
	// Mirrors `focused` for the deferred focus check below.
	const focusedRef = useRef(focused);
	focusedRef.current = focused;
	// Set the moment the host is told to close: from then on focus may
	// leave — the host puts it on its button (or wherever it likes).
	const closingRef = useRef(false);
	const mountedRef = useRef(false);

	useEffect(() => {
		mountedRef.current = true;
		if (autoFocus) {
			buttonRefs.current[focused]?.focus();
		}
		return () => {
			mountedRef.current = false;
		};
		// Only on mount: later focus moves are driven by the keyboard.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const focusIndex = useCallback((index: number) => {
		setFocused(index);
		buttonRefs.current[index]?.focus();
	}, []);

	const close = useCallback(() => {
		closingRef.current = true;
		onClose();
	}, [onClose]);

	/**
	 * Review v6: the card owns focus while it is open. The composer's
	 * deferred autofocus (a `setTimeout(0)` after the draft loads) used to
	 * pull focus off the card a tick after it opened, leaving ↓/↑ dead. When
	 * focus leaves for somewhere outside the card, wait a tick — the host
	 * may be closing us (Escape, a pick, a click elsewhere) — and, if the
	 * card is still open, take the current row back.
	 */
	const onFocusOut = (event: React.FocusEvent<HTMLDivElement>) => {
		const next = event.relatedTarget as Node | null;
		if (next && rootRef.current?.contains(next)) {
			return;
		}
		window.setTimeout(() => {
			if (!mountedRef.current || closingRef.current) {
				return;
			}
			const active = document.activeElement;
			if (active && rootRef.current?.contains(active)) {
				return;
			}
			buttonRefs.current[focusedRef.current]?.focus();
		}, 0);
	};

	const pick = useCallback(
		(row: ChannelMenuRow) => {
			onSelect(row.id);
			close();
		},
		[onSelect, close]
	);

	const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
			return;
		}
		const shortcut = resolveMenuShortcut(event, rows);
		if (shortcut) {
			event.preventDefault();
			pick(shortcut);
			return;
		}
		const next = moveMenuFocus(focused, event.key, focusCount);
		if (next !== focused || ['Home', 'End'].includes(event.key)) {
			event.preventDefault();
			focusIndex(next);
		}
	};

	const rowLabel = (row: ChannelMenuRow) =>
		row.kind === 'supervision'
			? translate('chatStage.menu.supervisionChat')
			: translate('chatStage.menu.thread', { n: row.threadNumber });
	const unreadLabel = (count: number) =>
		count > 0 ? translate('supervision.panel.unread', { count }) : '';
	const keyshortcuts = (row: ChannelMenuRow) =>
		row.shortcut
			? `Shift+${row.kind === 'supervision' ? 'S' : row.threadNumber}`
			: undefined;

	return (
		<div
			ref={rootRef}
			className={['channelMenu', className].filter(Boolean).join(' ')}
			data-cy={dataCy}
			onBlur={onFocusOut}
		>
			<div className="channelMenu__header">
				<p
					className="channelMenu__eyebrow"
					data-cy="channel-menu-eyebrow"
				>
					{translate('chatStage.menu.eyebrow')}
				</p>
				<p className="channelMenu__title" data-cy="channel-menu-title">
					{translate('chatStage.menu.title')}
				</p>
			</div>
			<hr className="channelMenu__separator" aria-hidden="true" />
			<ul
				className="channelMenu__list"
				role="menu"
				id={id}
				aria-label={translate('chatStage.menu.title')}
				onKeyDown={onKeyDown}
			>
				{rows.map((row, index) => {
					const Glyph =
						row.kind === 'thread' ? ThreadGlyph : SupervisionGlyph;
					const label = rowLabel(row);
					return (
						<li key={row.id} role="none">
							<button
								ref={(element) => {
									buttonRefs.current[index] = element;
								}}
								type="button"
								role="menuitem"
								tabIndex={index === focused ? 0 : -1}
								className={[
									'channelMenu__item',
									`channelMenu__item--${row.kind}`,
									row.active && 'channelMenu__item--active'
								]
									.filter(Boolean)
									.join(' ')}
								data-cy={`channel-switcher-item-${row.kind}`}
								data-channel-id={row.id}
								data-active={row.active ? 'true' : 'false'}
								data-shortcut={row.shortcut}
								aria-current={row.active ? 'true' : undefined}
								aria-keyshortcuts={keyshortcuts(row)}
								aria-label={[
									translate(
										'chatStage.switcher.openChannel',
										{
											label
										}
									),
									row.preview
										? `${row.preview.author}: ${row.preview.text}`
										: '',
									unreadLabel(row.unread)
								]
									.filter(Boolean)
									.join(' – ')}
								onFocus={() => setFocused(index)}
								onClick={() => pick(row)}
							>
								<Glyph
									className="channelMenu__icon"
									aria-hidden="true"
								/>
								<span className="channelMenu__body">
									<span className="channelMenu__row">
										<span className="channelMenu__label">
											{label}
										</span>
										<UnreadBadge count={row.unread} />
										{row.shortcut && (
											<kbd
												className="channelMenu__shortcut"
												aria-hidden="true"
											>
												{row.shortcut}
											</kbd>
										)}
									</span>
									{row.preview && (
										<span
											className="channelMenu__preview"
											data-cy="channel-menu-preview"
										>
											{row.preview.author && (
												<strong className="channelMenu__author">
													{row.preview.author}:
												</strong>
											)}{' '}
											{row.preview.text}
										</span>
									)}
								</span>
							</button>
						</li>
					);
				})}
				{onBack && (
					<li role="none">
						<button
							ref={(element) => {
								buttonRefs.current[rows.length] = element;
							}}
							type="button"
							role="menuitem"
							tabIndex={rows.length === focused ? 0 : -1}
							className="channelMenu__item channelMenu__item--main"
							data-cy="channel-switcher-item-main"
							aria-label={translate(
								'chatStage.switcher.backToMain'
							)}
							onFocus={() => setFocused(rows.length)}
							onClick={() => {
								onBack();
								close();
							}}
						>
							<MainChatGlyph
								className="channelMenu__icon"
								aria-hidden="true"
							/>
							<span className="channelMenu__body">
								<span className="channelMenu__row">
									<span className="channelMenu__label">
										{translate(
											'chatStage.switcher.mainChat'
										)}
									</span>
								</span>
							</span>
						</button>
					</li>
				)}
			</ul>
		</div>
	);
};

export default ChannelMenu;
