import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext,
	useTopic
} from '../../globalState';
import { mobileListView } from '../app/navigationHandler';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { SESSION_LIST_TAB } from '../session/sessionHelpers';
import {
	apiGetGroupChatInfo,
	apiPutGroupChat,
	FETCH_ERRORS,
	GROUP_CHAT_API
} from '../../api';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { logout } from '../logout/logout';
import { Navigate } from 'react-router-dom';
import { ReactComponent as WarningIcon } from '../../resources/img/icons/i.svg';
import './joinChat.styles';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { ReactComponent as XIcon } from '../../resources/img/illustrations/x.svg';
import { useWatcher } from '../../hooks/useWatcher';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';
import { useTimeoutOverlay } from '../../hooks/useTimeoutOverlay';
import { OVERLAY_REQUEST } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { FALLBACK_LNG } from '../../i18n';
import { WaitingAreaRules } from './WaitingAreaRules';
import { WaitingAreaCountdown } from './waitingClock/WaitingAreaCountdown';
import { GroupChatCalendarMenu } from './GroupChatCalendarMenu';
import { resolveGroupChatAuthorContent } from './groupChatAuthorContent';
import { getGroupChatPlannedStart } from './groupChatDate';
import { getGroupChatWaitingAreaVisibility } from './groupChatHelpers';
interface JoinGroupChatViewProps {
	forceBannedOverlay?: boolean;
	bannedUsers?: string[];
}

export const JoinGroupChatView = ({
	forceBannedOverlay = false,
	bannedUsers = []
}: JoinGroupChatViewProps) => {
	const { t: translate, i18n } = useTranslation([
		'common',
		'consultingTypes'
	]);
	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [overlayActive, setOverlayActive] = useState(false);
	const [redirectToSessionsList, setRedirectToSessionsList] = useState(false);
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const topic = useTopic(activeSession.item.consultingType);

	const [isButtonDisabled, setIsButtonDisabled] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;

	const { path: listPath } = useContext(SessionTypeContext);

	const { visible: requestOverlayVisible, overlay: requestOverlay } =
		useTimeoutOverlay(
			// Disable the request overlay if upload is in progess because upload progress is shown in the ui already
			isRequestInProgress,
			null,
			null,
			null,
			2500
		);

	const joinButtonItem: ButtonItem = useMemo(
		() => ({
			label: translate('groupChat.join.button.label.join'),
			type: BUTTON_TYPES.PRIMARY
		}),
		[translate]
	);

	const startButtonItem: ButtonItem = useMemo(
		() => ({
			label: translate('groupChat.join.button.label.start'),
			type: BUTTON_TYPES.PRIMARY
		}),
		[translate]
	);

	const [buttonItem, setButtonItem] = useState(joinButtonItem);

	const startJoinGroupChatErrorOverlay: OverlayItem = {
		svg: XIcon,
		illustrationBackground: 'error',
		headline: translate('groupChat.joinError.overlay.headline'),
		buttonSet: [
			{
				label: translate('groupChat.joinError.overlay.buttonLabel'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		]
	};

	const joinGroupChatClosedErrorOverlay: OverlayItem = useMemo(
		() => ({
			svg: XIcon,
			illustrationBackground: 'error',
			headline: translate('groupChat.join.chatClosedOverlay.headline'),
			buttonSet: [
				{
					label: translate(
						'groupChat.join.chatClosedOverlay.button1Label'
					),
					function: OVERLAY_FUNCTIONS.REDIRECT,
					type: BUTTON_TYPES.PRIMARY
				},
				{
					label: translate(
						'groupChat.join.chatClosedOverlay.button2Label'
					),
					function: OVERLAY_FUNCTIONS.LOGOUT,
					type: BUTTON_TYPES.SECONDARY
				}
			]
		}),
		[translate]
	);

	const bannedUserOverlay: OverlayItem = useMemo(
		() => ({
			svg: XIcon,
			illustrationBackground: 'large',
			headline: translate('banUser.banned.headline'),
			copy: translate('banUser.banned.info')
		}),
		[translate]
	);

	const updateGroupChatInfo = useCallback(() => {
		return apiGetGroupChatInfo(activeSession.item.id)
			.then((res) => {
				if (activeSession.item.active !== res.active) {
					reloadActiveSession();
				}
			})
			.catch((error) => {
				if (error.message === FETCH_ERRORS.NO_MATCH) {
					setOverlayItem(joinGroupChatClosedErrorOverlay);
					setOverlayActive(true);
				}
			});
	}, [
		activeSession.item.active,
		activeSession.item.id,
		reloadActiveSession,
		joinGroupChatClosedErrorOverlay
	]);

	const [startWatcher, stopWatcher, isWatcherRunning] = useWatcher(
		updateGroupChatInfo,
		5000
	);

	useEffect(() => {
		if (!isWatcherRunning) {
			startWatcher();
		}

		return () => {
			if (isWatcherRunning) {
				stopWatcher();
			}
		};
	}, [
		consultingType?.groupChat.isGroupChat,
		isWatcherRunning,
		startWatcher,
		stopWatcher
	]);

	useEffect(() => {
		if (
			hasUserAuthority(AUTHORITIES.CREATE_NEW_CHAT, userData) &&
			!activeSession.item.active
		) {
			setButtonItem(startButtonItem);
		} else {
			setButtonItem(joinButtonItem);
		}
	}, [activeSession.item.active, userData, startButtonItem, joinButtonItem]);

	useEffect(() => {
		if (
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
			!hasUserAuthority(AUTHORITIES.CREATE_NEW_CHAT, userData)
		) {
			setIsButtonDisabled(
				!activeSession.item.active ||
					bannedUsers.includes(userData.userName)
			);
		}
	}, [activeSession.item.active, bannedUsers, userData]);

	const handleOverlayClose = () => {
		setOverlayActive(false);
	};

	const handleButtonClick = () => {
		if (bannedUsers.includes(userData.userName)) {
			setOverlayItem(bannedUserOverlay);
			setOverlayActive(true);
			return;
		}
		if (isRequestInProgress) {
			return;
		}
		setIsRequestInProgress(true);
		const groupChatApiCall =
			hasUserAuthority(AUTHORITIES.CREATE_NEW_CHAT, userData) &&
			!activeSession.item.active
				? GROUP_CHAT_API.START
				: GROUP_CHAT_API.JOIN;
		apiPutGroupChat(activeSession.item.id, groupChatApiCall)
			.then(() => reloadActiveSession())
			.catch(() => {
				setOverlayItem(startJoinGroupChatErrorOverlay);
				setOverlayActive(true);
			})
			.finally(() => {
				setIsRequestInProgress(false);
			});
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayActive(false);
			setOverlayItem({});
		} else if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
			setRedirectToSessionsList(true);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.LOGOUT) {
			logout();
		}
		setIsRequestInProgress(false);
	};

	useEffect(() => {
		if (forceBannedOverlay) {
			setOverlayItem(bannedUserOverlay);
			setOverlayActive(true);
		}
	}, [forceBannedOverlay, bannedUserOverlay]);

	const legacyGroupChatRules = useMemo(() => {
		const transKeys = [
			`consultingType.${topic?.id ?? 'noConsultingType'}.groupChatRules`,
			`consultingType.fallback.groupChatRules`
		];

		// Get groupChat rules from fallback_lng to get the count and make i18n
		// fallback chain working for non translated rules (de -> de@informal)
		const groupChatRuleKeys = Object.keys(
			translate(transKeys, {
				returnObjects: true,
				defaultValue: consultingType?.groupChat?.groupChatRules || [],
				lng: FALLBACK_LNG,
				ns: 'consultingTypes'
			})
		);

		// Then translate every rule by its own translation
		return groupChatRuleKeys.map((key) =>
			translate(
				transKeys.map((transKey) => `${transKey}.${key}`),
				{ ns: 'consultingTypes' }
			)
		);
	}, [consultingType?.groupChat?.groupChatRules, topic?.id, translate]);

	const authorContent = useMemo(
		() =>
			resolveGroupChatAuthorContent({
				language: i18n.resolvedLanguage || i18n.language,
				sourceLanguage: activeSession.item.sourceLanguage,
				hintMessageTranslations:
					activeSession.item.hintMessageTranslations,
				groupChatRulesTranslations:
					activeSession.item.groupChatRulesTranslations,
				legacyHintMessage: activeSession.item.hintMessage,
				legacyRules: legacyGroupChatRules
			}),
		[
			activeSession.item.groupChatRulesTranslations,
			activeSession.item.hintMessage,
			activeSession.item.hintMessageTranslations,
			activeSession.item.sourceLanguage,
			i18n.language,
			i18n.resolvedLanguage,
			legacyGroupChatRules
		]
	);
	const groupChatRules = authorContent.rules;
	const plannedStart = getGroupChatPlannedStart(activeSession.item);
	const { showCountdown, showRules, showRulesHeadline } =
		getGroupChatWaitingAreaVisibility(activeSession, plannedStart);

	if (redirectToSessionsList) {
		mobileListView();
		return <Navigate to={listPath + getSessionListTab()} replace />;
	}

	return (
		<div className="session joinChat">
			<SessionHeaderComponent
				isJoinGroupChatView={true}
				bannedUsers={bannedUsers}
			/>
			<div className="joinChat__content session__content">
				{/* The scheduled-chat countdown carries its own headline
				    ("Dein Gruppen-Chat beginnt in …"); a second static heading
				    above it just repeats the frame. Only show the standalone
				    "Spielregeln"-headline in the no-countdown (hint message) view.
				    Internal team chats show neither (#979). */}
				{showRulesHeadline && (
					<Headline
						text={translate('groupChat.join.content.headline')}
						semanticLevel="4"
					/>
				)}
				{/* An author-written greeting is real content, not waiting-room
				    chrome — it stays visible for internal team chats too. */}
				{!!authorContent.hintMessage && !showCountdown && (
					<Text text={authorContent.hintMessage} type="standard" />
				)}
				{showCountdown && plannedStart && (
					<div className="joinChat__waitingBox">
						<WaitingAreaCountdown
							plannedStart={plannedStart}
							welcomeText={authorContent.hintMessage || undefined}
							rules={groupChatRules}
							calendarSlot={
								<GroupChatCalendarMenu
									start={plannedStart}
									durationMinutes={
										activeSession.item.duration
									}
									eventId={activeSession.item.id}
								/>
							}
						/>
					</div>
				)}
				{showRules && (
					<WaitingAreaRules
						rules={groupChatRules}
						ariaLabel={translate(
							'groupChat.join.waitingArea.rulesLabel'
						)}
					/>
				)}
			</div>
			<div className="joinChat__button-container">
				{!hasUserAuthority(AUTHORITIES.CREATE_NEW_CHAT, userData) &&
					!activeSession.item.active && (
						<p className="joinChat__warning-message">
							<WarningIcon />
							{translate(
								hasUserAuthority(
									AUTHORITIES.ASKER_DEFAULT,
									userData
								)
									? 'groupChat.join.warning.message'
									: 'groupChat.join.warning.consultant.message'
							)}
						</p>
					)}
				<Button
					item={buttonItem}
					buttonHandle={handleButtonClick}
					disabled={isButtonDisabled}
				/>
			</div>

			{requestOverlayVisible && (
				<Overlay item={requestOverlay} name={OVERLAY_REQUEST} />
			)}

			{overlayActive && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
					handleOverlayClose={handleOverlayClose}
				/>
			)}
		</div>
	);
};
