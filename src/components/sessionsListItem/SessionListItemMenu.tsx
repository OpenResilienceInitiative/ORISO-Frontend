import { MenuBackdrop } from '../chatMenuDropdown/MenuBackdrop';
import {
	CARD_MENU_BACKDROP_LAYER,
	CARD_MENU_LAYER
} from '../chatMenuDropdown/menuLayers';
import { useChatMenuPosition } from '../chatMenuDropdown/useChatMenuPosition';
import * as React from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ReactComponent as TrashIcon } from '../../resources/img/icons/trash.svg';
import { ReactComponent as HelpIcon } from '../../resources/img/icons/i.svg';
import { ReactComponent as EditGroupChatIcon } from '../../resources/img/icons/gear.svg';
import { LegalLinkMenuIcon } from '../legalLinks/LegalLinkMenuIcon';
import LegalLinks from '../legalLinks/LegalLinks';
import { ChatroomSettingsMenuVisibility } from './chatroomSettingsMenu';
import { TProvidedLegalLink } from '../../globalState/provider/LegalLinksProvider';

export interface SessionListItemMenuProps {
	flyoutOpen: boolean;
	menuIconRef: React.RefObject<HTMLButtonElement>;
	/** The card the trigger sits in; the menu opens beside it, not on it. */
	surfaceRef?: React.RefObject<HTMLElement | null>;
	dropdownRef: React.RefObject<HTMLDivElement>;
	dropdownId: string;
	dropdownLabel: string;
	translate: TFunction<['common'], undefined>;
	onClose: () => void;
	onMenuClick: (e: React.MouseEvent) => void;
	onMenuKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
	onDropdownKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	isAsker: boolean;
	visibility: ChatroomSettingsMenuVisibility;
	onChatSettings: () => void;
	onArchive: () => void;
	onDearchive: () => void;
	onDelete: () => void;
	onRequestHelp: () => void;
	legalLinks: TProvidedLegalLink[];
	agencyId: number | undefined;
	onLegalLinkClick: (title: string, url: string) => void;
}

/**
 * The session card's chat-room menu (Figma 7086-57413); while open, only the menu carries
 * the red ring and the veil spares the card.
 * Storybook: https://dev.oriso.org/storybook-frontend/?path=/story/components-session-list-sessionlistitem--menu-beside-the-card
 */
export const SessionListItemMenu = ({
	flyoutOpen,
	menuIconRef,
	surfaceRef,
	dropdownRef,
	dropdownId,
	dropdownLabel,
	translate,
	onMenuClick,
	onClose,
	onMenuKeyDown,
	onDropdownKeyDown,
	isAsker,
	visibility,
	onChatSettings,
	onArchive,
	onDearchive,
	onDelete,
	onRequestHelp,
	legalLinks,
	agencyId,
	onLegalLinkClick
}: SessionListItemMenuProps) => {
	const menuPosition = useChatMenuPosition({
		open: flyoutOpen,
		anchorRef: menuIconRef,
		menuRef: dropdownRef,
		surfaceRef,
		hugTrigger: true
	});
	const placement = menuPosition['--chat-menu-placement'];
	return (
		<>
			<MenuBackdrop
				open={flyoutOpen}
				spotlightRef={surfaceRef}
				onClose={() => {
					onClose();
					menuIconRef.current?.focus();
				}}
				zIndex={CARD_MENU_BACKDROP_LAYER}
			/>
			<button
				type="button"
				ref={menuIconRef}
				className={clsx(
					'sessionsListItem__menuIcon',
					flyoutOpen && 'sessionsListItem__menuIcon--open'
				)}
				onClick={onMenuClick}
				onKeyDown={onMenuKeyDown}
				aria-label={dropdownLabel}
				aria-haspopup="dialog"
				aria-expanded={flyoutOpen}
				aria-controls={flyoutOpen ? dropdownId : undefined}
			>
				<MenuVerticalIcon />
			</button>
			{flyoutOpen &&
				createPortal(
					<div
						id={dropdownId}
						ref={dropdownRef}
						className="sessionsListItem__dropdown"
						data-placement={placement}
						onKeyDown={onDropdownKeyDown}
						role="dialog"
						aria-label={dropdownLabel}
						style={{ ...menuPosition, zIndex: CARD_MENU_LAYER }}
					>
						<div className="sessionsListItem__dropdownHeader">
							<p className="sessionsListItem__dropdownSubtitle">
								{translate('groupChat.info.settings.subtitle')}
							</p>
							<h1 className="sessionsListItem__dropdownTitle">
								{translate('groupChat.info.settings.headline')}
							</h1>
						</div>
						<div className="sessionsListItem__dropdownDivider" />
						{isAsker ? (
							<>
								<div className="sessionsListItem__dropdownContent">
									<LegalLinks
										legalLinks={legalLinks}
										params={{ aid: agencyId }}
										filter={(link) =>
											link.label ===
											'login.legal.infoText.dataprotection'
										}
									>
										{(label, url, rawLabel) => (
											<button
												type="button"
												className="sessionsListItem__dropdownOption"
												onClick={() => {
													onLegalLinkClick(
														translate(
															'chatFlyout.privacyPolicy'
														),
														url
													);
												}}
											>
												<LegalLinkMenuIcon
													className="sessionsListItem__dropdownOptionIcon"
													title={label}
													url={url}
													rawLabel={rawLabel}
												/>
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle">
															{translate(
																'chatFlyout.privacyPolicy'
															)}
														</span>
													</div>
													<p className="sessionsListItem__dropdownOptionDescription">
														{translate(
															'chatFlyout.privacyPolicyDescription'
														)}
													</p>
												</div>
											</button>
										)}
									</LegalLinks>
									<LegalLinks
										legalLinks={legalLinks}
										params={{ aid: agencyId }}
										filter={(link) =>
											link.label ===
											'login.legal.infoText.impressum'
										}
									>
										{(label, url, rawLabel) => (
											<button
												type="button"
												className="sessionsListItem__dropdownOption"
												onClick={() => {
													onLegalLinkClick(
														translate(
															'chatFlyout.imprint'
														),
														url
													);
												}}
											>
												<LegalLinkMenuIcon
													className="sessionsListItem__dropdownOptionIcon"
													title={label}
													url={url}
													rawLabel={rawLabel}
												/>
												<div className="sessionsListItem__dropdownOptionCenter">
													<div className="sessionsListItem__dropdownOptionTitleRow">
														<span className="sessionsListItem__dropdownOptionTitle">
															{translate(
																'chatFlyout.imprint'
															)}
														</span>
													</div>
												</div>
											</button>
										)}
									</LegalLinks>
								</div>
							</>
						) : (
							<>
								<div className="sessionsListItem__dropdownContent">
									{visibility.showChatSettings && (
										<button
											onClick={onChatSettings}
											className="sessionsListItem__dropdownOption"
											type="button"
											data-cy="session-list-menu-chat-settings"
										>
											<EditGroupChatIcon className="sessionsListItem__dropdownOptionIcon" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle">
														{translate(
															'chatFlyout.editGroupChat'
														)}
													</span>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription">
													{translate(
														'chatFlyout.editGroupChatDescription'
													)}
												</p>
											</div>
										</button>
									)}
									{visibility.showArchive && (
										<button
											onClick={onArchive}
											className="sessionsListItem__dropdownOption"
											type="button"
											data-cy="session-list-menu-archive"
										>
											<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle">
														{translate(
															'chatFlyout.archive'
														)}
													</span>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription">
													{translate(
														'chatFlyout.archiveDescription'
													)}
												</p>
											</div>
										</button>
									)}
									{visibility.showDearchive && (
										<button
											onClick={onDearchive}
											className="sessionsListItem__dropdownOption"
											type="button"
											data-cy="session-list-menu-dearchive"
										>
											<ArchiveIcon className="sessionsListItem__dropdownOptionIcon" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle">
														{translate(
															'chatFlyout.dearchive'
														)}
													</span>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription">
													{translate(
														'chatFlyout.dearchiveDescription'
													)}
												</p>
											</div>
										</button>
									)}
									{visibility.showDelete && (
										<button
											onClick={onDelete}
											className="sessionsListItem__dropdownOption"
											type="button"
											data-cy="session-list-menu-delete"
										>
											<TrashIcon className="sessionsListItem__dropdownOptionIcon" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle">
														{translate(
															'chatFlyout.remove'
														)}
													</span>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription">
													{translate(
														'chatFlyout.removeDescription'
													)}
												</p>
											</div>
										</button>
									)}
									{visibility.showRequestHelp && (
										<button
											onClick={onRequestHelp}
											className="sessionsListItem__dropdownOption"
											type="button"
											data-cy="session-list-menu-request-help"
										>
											<HelpIcon className="sessionsListItem__dropdownOptionIcon" />
											<div className="sessionsListItem__dropdownOptionCenter">
												<div className="sessionsListItem__dropdownOptionTitleRow">
													<span className="sessionsListItem__dropdownOptionTitle">
														{translate(
															'chatFlyout.help'
														)}
													</span>
												</div>
												<p className="sessionsListItem__dropdownOptionDescription">
													{translate(
														'chatFlyout.helpDescription'
													)}
												</p>
											</div>
										</button>
									)}
								</div>
							</>
						)}
					</div>,
					document.body
				)}
		</>
	);
};
