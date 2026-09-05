import * as React from 'react';
import { useContext, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SESSION_LIST_TAB } from '../session/sessionHelpers';
import { SessionTypeContext, ActiveSessionProvider } from '../../globalState';
import { Loading } from '../app/Loading';
import { ReactComponent as PersonIcon } from '../../resources/img/icons/person.svg';
import './askerInfo.styles';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useSession } from '../../hooks/useSession';
import { useResponsive } from '../../hooks/useResponsive';
import {
	desktopView,
	mobileListView,
	mobileUserProfileView
} from '../app/navigationHandler';
import { useTranslation } from 'react-i18next';
import { AskerInfoContent } from './AskerInfoContent';
import { AskerInfoFooter } from './AskerInfoFooter';
import { AskerInfoActionProvider } from './askerInfoActionContext';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';

export const AskerInfo = () => {
	const { t: translate } = useTranslation();
	const { groupId: groupIdFromParam } = useParams<{ groupId: string }>();
	const navigate = useNavigate();

	const { path: listPath } = useContext(SessionTypeContext);

	const { session: activeSession, ready } = useSession(groupIdFromParam);

	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	useEffect(() => {
		if (!ready || activeSession) {
			return;
		}

		navigate(
			listPath +
				(sessionListTab ? `?sessionListTab=${sessionListTab}` : '')
		);
	}, [activeSession, navigate, listPath, ready, sessionListTab]);

	// Same id the sessions list and chat derive their avatar from, so all three
	// show one animal for a given asker (SessionListItemComponent does this too).
	const askerAvatar = useMemo(
		() =>
			generateAvatarForUser(
				activeSession?.item?.askerMatrixUserId ||
					activeSession?.user?.username ||
					'unknown'
			),
		[activeSession]
	);

	const { fromL, fromM } = useResponsive();
	// 100px is the Figma avatar; it drops with the row below $fromMedium
	// (600px), matching the SCSS breakpoint for the same row.
	const avatarSize = fromM ? 100 : 64;
	useEffect(() => {
		if (!fromL) {
			mobileUserProfileView();
			return () => {
				mobileListView();
			};
		}
		desktopView();
	}, [fromL]);

	if (!activeSession) {
		return <Loading />;
	}

	// Header back link and footer buttons lead to the same place, so the path
	// is built once rather than twice with a chance of drifting apart.
	const sessionPath = `${listPath}/${activeSession.item.matrixRoomId}/${
		activeSession.item.id
	}${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`;

	return (
		<ActiveSessionProvider activeSession={activeSession}>
			<div className="askerInfo__wrapper">
				{/* Figma "Room Header All": a 56px row with the icon pill and the
				    panel title, closed by a divider. There is no back control here
				    - the footer carries it, which is why the design has one. */}
				<div className="askerInfo__header">
					<div className="askerInfo__header__wrapper">
						<span
							className="askerInfo__header__icon"
							aria-hidden="true"
						>
							<PersonIcon />
						</span>
						<h3 className="askerInfo__header__title">
							{translate('userProfile.header.title')}
						</h3>
					</div>
				</div>
				<AskerInfoActionProvider>
					<div className="askerInfo__innerWrapper">
						<div className="askerInfo__user">
							<span
								className="askerInfo__icon"
								title={translate('profile.data.profileIcon')}
								aria-label={translate(
									'profile.data.profileIcon'
								)}
							>
								<AnimalAvatar
									avatar={askerAvatar}
									size={avatarSize}
								/>
							</span>
							<h2>{activeSession.user.username}</h2>
						</div>
						<div className="askerInfo__content">
							<AskerInfoContent />
						</div>
					</div>
					<AskerInfoFooter onLeave={() => navigate(sessionPath)} />
				</AskerInfoActionProvider>
			</div>
		</ActiveSessionProvider>
	);
};
