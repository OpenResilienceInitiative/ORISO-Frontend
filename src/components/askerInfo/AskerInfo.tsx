import * as React from 'react';
import { useContext, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { SESSION_LIST_TAB } from '../session/sessionHelpers';
import { SessionTypeContext, ActiveSessionProvider } from '../../globalState';
import { Loading } from '../app/Loading';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
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

	const { fromL } = useResponsive();
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
				<div className="askerInfo__header">
					<div className="askerInfo__header__wrapper">
						<Link
							to={sessionPath}
							className="askerInfo__header__backButton"
						>
							<BackIcon
								aria-label={translate('app.back')}
								title={translate('app.back')}
							/>
						</Link>
						<h3 className="askerInfo__header__title">
							{translate('userProfile.header.title')}
						</h3>
					</div>
					<div className="askerInfo__header__metaInfo">
						<p className="askerInfo__header__username askerInfo__header__username--withBackButton">
							{activeSession.user.username}
						</p>
					</div>
				</div>
				<AskerInfoActionProvider>
					<div className="askerInfo__innerWrapper">
						<div className="askerInfo__user">
							<div className="askerInfo__icon">
								<PersonIcon
									className="askerInfo__icon--user"
									title={translate(
										'profile.data.profileIcon'
									)}
									aria-label={translate(
										'profile.data.profileIcon'
									)}
								/>
							</div>
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
