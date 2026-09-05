/**
 * Header molecule for a side panel — the Figma "Room Header All"
 * (1320:38281 → Chat Room Desktop) in the panel: the participant avatar
 * stack of the room (same `MessageAvatar` atom as the chat, T1/T4), a
 * two-line title — the channel word "Thread"/"Supervision" with its icon
 * as a small subsection label above the counterpart name (T7) — the
 * actions on the right, the `primary-fixed` hairline and the tag slot
 * under it. Same paddings as the session header so both hairlines end on
 * the same y (T3).
 *
 * The channel icon is a button: it opens the same channel options as the
 * FAB speed dial (`ChannelSwitcherMenu`), so the FAB can hide while a panel
 * is open (T1).
 */
import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as SupervisionGlyph } from '../../resources/img/icons/supervision_circ_400_24px.svg';
import { ParticipantAvatarStack } from '../message/ParticipantAvatarStack';
import type { StackParticipant } from '../message/participantStack';
import { ChannelSwitcherMenu } from './ChannelSwitcherFab';
import {
	deriveChannelSwitcherState,
	type SecondaryChannel,
	type SecondaryChannelKind
} from './channelSwitcherState';
import './sidePanel.styles.scss';

export interface PanelHeaderProps {
	/** Which kind of side room — picks the icon next to the section word. */
	'kind': SecondaryChannelKind;
	/** Section word: "Supervision" / "Thread". */
	'title': string;
	/** Counterpart shown as the main line: "Bettina B.". */
	'name'?: string;
	/** People in the side room, rendered as the avatar stack. */
	'participants'?: StackParticipant[];
	/** Role chip text ("Supervision" / "Beratung"). */
	'chip'?: string;
	'unreadCount'?: number;
	/** Tag under the hairline — topic or a subtitle. */
	'tag'?: string;
	/**
	 * Other secondary channels of the conversation. The channel icon opens
	 * them as the FAB menu would; without any the icon is a disabled button
	 * (house rule: disable, never hide).
	 */
	'channels'?: SecondaryChannel[];
	'onSelectChannel'?: (channelId: string) => void;
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
	tag,
	channels = [],
	onSelectChannel,
	onBack,
	onClose,
	actions,
	'data-cy': dataCy = 'panel-header'
}: PanelHeaderProps) => {
	const { t: translate } = useTranslation();
	const [optionsOpen, setOptionsOpen] = useState(false);
	const optionsRef = useRef<HTMLDivElement | null>(null);
	const optionsButtonRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();
	const Glyph = kindGlyph(kind);
	const options = deriveChannelSwitcherState(channels);
	const hasOptions = options.items.length > 0;

	const closeOptions = useCallback(() => setOptionsOpen(false), []);

	useEffect(() => {
		if (!optionsOpen) {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent) => {
			if (!optionsRef.current?.contains(event.target as Node)) {
				closeOptions();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeOptions();
				optionsButtonRef.current?.focus();
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [optionsOpen, closeOptions]);

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
		<header className="panelHeader" data-cy={dataCy}>
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
					<div
						className="panelHeader__kind"
						ref={optionsRef}
						data-cy="panel-header-kind"
					>
						<button
							ref={optionsButtonRef}
							type="button"
							className="panelHeader__kindButton"
							data-cy="panel-header-channel-options"
							aria-label={`${title} – ${optionsLabel}`}
							title={optionsLabel}
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
								className="panelHeader__titleLabel"
								data-cy="panel-header-kind-label"
							>
								{title}
							</span>
						</button>
						{optionsOpen && hasOptions && (
							<div
								className="channelSwitcher channelSwitcher--anchored"
								data-cy="panel-header-channel-menu"
							>
								<ChannelSwitcherMenu
									id={menuId}
									items={options.items}
									onSelect={(item) => {
										closeOptions();
										onSelectChannel?.(item.id);
									}}
								/>
							</div>
						)}
					</div>
					<h2 className="panelHeader__name">
						{name ? (
							<span
								className="panelHeader__titleName"
								data-cy="panel-header-name"
							>
								{name}
							</span>
						) : (
							<span className="panelHeader__titleName">
								{title}
							</span>
						)}
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
			<div className="panelHeader__divider">
				{tag && (
					<span
						className="panelHeader__tag"
						data-cy="panel-header-tag"
					>
						{tag}
					</span>
				)}
			</div>
		</header>
	);
};

export default PanelHeader;
