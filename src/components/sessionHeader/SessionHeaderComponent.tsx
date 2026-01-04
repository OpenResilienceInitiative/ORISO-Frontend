import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { handleNumericTranslation } from '../../utils/translate';
import { mobileListView } from '../app/navigationHandler';
import {
	AUTHORITIES,
	getContact,
	hasUserAuthority,
	SessionTypeContext,
	useConsultingType,
	UserDataContext,
	ActiveSessionContext
} from '../../globalState';
import {
	SessionConsultantInterface,
	TopicSessionInterface
} from '../../globalState/interfaces';
import {
	getViewPathForType,
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';
import { SessionMenu } from '../sessionMenu/SessionMenu';
import {
	convertUserDataObjectToArray,
	getUserDataTranslateBase
} from '../profile/profileHelpers';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { UserAvatar } from '../message/UserAvatar';
import { ConsultantSearchLoader } from './ConsultantSearchLoader';
import './sessionHeader.styles';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';
import { GroupChatHeader } from './GroupChatHeader';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useTopic } from '../../globalState';

export interface SessionHeaderProps {
	consultantAbsent?: SessionConsultantInterface;
	hasUserInitiatedStopOrLeaveRequest?: React.MutableRefObject<boolean>;
	isJoinGroupChatView?: boolean;
	bannedUsers: string[];
}

export const SessionHeaderComponent = (props: SessionHeaderProps) => {
	const { t: translate } = useTranslation([
		'common',
		'consultingTypes',
		'agencies'
	]);
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const consultingType = useConsultingType(activeSession.item.consultingType);
	const topic = useTopic(
		(activeSession.item.topic as TopicSessionInterface).id
	);
	const settings = useAppConfig();

	const contact = getContact(activeSession);
	const userSessionData = contact?.sessionData;

	const preparedUserSessionData =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) &&
		userSessionData
			? convertUserDataObjectToArray(userSessionData)
			: null;
	const translateBase = getUserDataTranslateBase(
		activeSession.item.consultingType
	);

	const [isSubscriberFlyoutOpen, setIsSubscriberFlyoutOpen] = useState(false);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const getSessionListTab = () =>
		`${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;
	const { type, path: listPath } = useContext(SessionTypeContext);

	useEffect(() => {
		if (isSubscriberFlyoutOpen) {
			document.addEventListener('mousedown', (event) =>
				handleWindowClick(event)
			);
		}
	}, [isSubscriberFlyoutOpen]);

	const sessionView = getViewPathForType(type);
	const userProfileLink = `/sessions/consultant/${sessionView}/${
		activeSession.item.groupId
	}/${activeSession.item.id}/userProfile${getSessionListTab()}`;

	const handleBackButton = () => {
		mobileListView();
	};

	const handleWindowClick = (event) => {
		const flyoutElement = document.querySelector(
			'.sessionInfo__metaInfo__flyout'
		);
		if (
			flyoutElement &&
			!flyoutElement.contains(event.target) &&
			event.target.id !== 'subscriberButton'
		) {
			setIsSubscriberFlyoutOpen(false);
		}
	};

	const enquiryUserProfileCondition =
		typeof settings?.user?.profile?.visibleOnEnquiry === 'function'
			? settings.user.profile.visibleOnEnquiry(userSessionData ?? {})
			: settings?.user?.profile?.visibleOnEnquiry;

	const isAskerInfoAvailable = () =>
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		consultingType?.showAskerProfile &&
		activeSession.isSession &&
		((type === SESSION_LIST_TYPES.ENQUIRY && enquiryUserProfileCondition) ||
			SESSION_LIST_TYPES.ENQUIRY !== type);

	if (activeSession.isGroup) {
		return (
			<GroupChatHeader
				hasUserInitiatedStopOrLeaveRequest={
					props.hasUserInitiatedStopOrLeaveRequest
				}
				isJoinGroupChatView={props.isJoinGroupChatView}
				bannedUsers={props.bannedUsers}
			/>
		);
	}

	return (
		<div className="sessionInfo">
			<div className="sessionInfo__headerWrapper">
				<Link
					to={listPath + getSessionListTab()}
					onClick={handleBackButton}
					className="sessionInfo__backButton"
				>
					<BackIcon />
				</Link>
				<div
					className={clsx('sessionInfo__username', {
						'sessionInfo__username--deactivate':
							!isAskerInfoAvailable()
					})}
				>
					{hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
					!activeSession.consultant ? (
						<ConsultantSearchLoader size="40px" />
					) : (
						<UserAvatar
							username={contact?.username || 'User'}
							displayName={contact?.displayName}
							userId={contact?.username || 'unknown'}
							size="40px"
						/>
					)}
					{hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) && (
						<h3>
							{contact?.displayName ||
								contact?.username ||
								translate('sessionList.user.consultantUnknown')}
						</h3>
					)}
					{hasUserAuthority(
						AUTHORITIES.CONSULTANT_DEFAULT,
						userData
					) ? (
						isAskerInfoAvailable() ? (
							<Link to={userProfileLink}>
								<h3>
									{contact?.username ||
										translate(
											'sessionList.user.consultantUnknown'
										)}
								</h3>
							</Link>
						) : (
							<h3>
								{contact?.username ||
									translate(
										'sessionList.user.consultantUnknown'
									)}
							</h3>
						)
					) : null}
				</div>
				<SessionMenu
					hasUserInitiatedStopOrLeaveRequest={
						props.hasUserInitiatedStopOrLeaveRequest
					}
					isAskerInfoAvailable={isAskerInfoAvailable()}
					bannedUsers={props.bannedUsers}
				/>
			</div>

			{(hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) ||
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) && (
				<div className="sessionInfo__metaInfo">
					{activeSession.agency?.name && (
						<div className="sessionInfo__metaInfo__content">
							{translate(
								[
									`agency.${activeSession.agency.id}.name`,
									activeSession.agency.name
								],
								{ ns: 'agencies' }
							)}
						</div>
					)}
					{topic?.name && (
						<div className="sessionInfo__metaInfo__content">
							{topic.name}
						</div>
					)}
				</div>
			)}
		</div>
	);
};
