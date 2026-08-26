import * as React from 'react';
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
	dropdownPosition: { top: number; left: number };
	menuIconRef: React.RefObject<HTMLButtonElement>;
	dropdownRef: React.RefObject<HTMLDivElement>;
	dropdownId: string;
	dropdownLabel: string;
	translate: TFunction<['common'], undefined>;
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

export const SessionListItemMenu = ({
	flyoutOpen,
	dropdownPosition,
	menuIconRef,
	dropdownRef,
	dropdownId,
	dropdownLabel,
	translate,
	onMenuClick,
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
	return (
		<>
			<button
				type="button"
				ref={menuIconRef}
				className="sessionsListItem__menuIcon"
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
						onKeyDown={onDropdownKeyDown}
						role="dialog"
						aria-label={dropdownLabel}
						style={{
							top:
								dropdownPosition.top > 0
									? `${dropdownPosition.top}px`
									: '40px',
							left:
								dropdownPosition.left > 0
									? `${dropdownPosition.left}px`
									: 'auto',
							right: 'auto',
							zIndex: 999999
						}}
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
