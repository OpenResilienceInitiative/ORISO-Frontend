import * as React from 'react';
import { useContext, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ResizableHandle } from './ResizableHandle';
import {
	SESSION_LIST_TAB,
	SESSION_LIST_TYPES,
	SESSION_TYPES
} from '../session/sessionHelpers';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SessionsList } from './SessionsList';
import { ReactComponent as CreateGroupChatIcon } from '../../resources/img/icons/speech-bubble-plus.svg';
import defaultCreateGroup from '../../resources/img/illustrations/default-createGroup.svg';
import hoverCreateGroup from '../../resources/img/illustrations/hover-createGroup.svg';
import activeCreateGroup from '../../resources/img/illustrations/active-createGroup.svg';
import './sessionsList.styles';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { useSearchParam } from '../../hooks/useSearchParams';
import { useTranslation } from 'react-i18next';

interface SessionsListWrapperProps {
	sessionTypes: SESSION_TYPES;
}

export const SessionsListWrapper = ({
	sessionTypes
}: SessionsListWrapperProps) => {
	const { t: translate } = useTranslation();
	const { fixed: fixedLanguages } = useContext(LanguagesContext);
	const { userData } = useContext(UserDataContext);
	const { type } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');
	const location = useLocation();
	const isCreateChatActive = location.pathname.includes('/createGroupChat');
	
	// Resizable sidebar width
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		const saved = localStorage.getItem('sessionsList_width');
		const width = saved ? parseInt(saved, 10) : 380;
		
		// Snap to proper size if in awkward range (prevent text truncation)
		const ICON_ONLY_THRESHOLD = 280; // Match ResizableHandle
		const MIN_WIDTH = 80;
		const SNAP_THRESHOLD = 220; // Match ResizableHandle
		
		if (width > MIN_WIDTH && width < ICON_ONLY_THRESHOLD) {
			// Snap to appropriate size
			return width < SNAP_THRESHOLD ? MIN_WIDTH : ICON_ONLY_THRESHOLD;
		}
		
		return width;
	});
	
	// Icon-only mode when sidebar is small
	const isIconOnly = sidebarWidth < 280; // Match threshold
	
	const handleResize = useCallback((width: number) => {
		setSidebarWidth(width);
		localStorage.setItem('sessionsList_width', width.toString());
	}, []);

	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return (
			<div 
				className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
				style={{ width: `${sidebarWidth}px`, position: 'relative' }}
			>
				<div
					className="sessionsList__header"
					data-cy="session-list-header"
				>
					<h2
						className="sessionsList__headline"
						data-cy="session-list-headline"
					>
						{translate('sessionList.user.headline')}
					</h2>
				</div>
				<SessionsList
					defaultLanguage={fixedLanguages[0]}
					sessionTypes={sessionTypes}
				/>
				<ResizableHandle onResize={handleResize} />
			</div>
		);
	}

	return (
		<div 
			className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
			style={{ width: `${sidebarWidth}px`, position: 'relative' }}
		>
			<div className="sessionsList__header" data-cy="session-list-header">
				<h2
					className="sessionsList__headline"
					data-cy="session-list-headline"
				>
					{type === SESSION_LIST_TYPES.MY_SESSION
						? translate('sessionList.view.headline')
						: null}
					{type === SESSION_LIST_TYPES.ENQUIRY
						? translate('sessionList.preview.headline')
						: null}
			</h2>
		{type === SESSION_LIST_TYPES.MY_SESSION ? (
			<Link
				className="sessionsList__createChatLink"
				to={{
					pathname: `/sessions/consultant/sessionView/createGroupChat${
						sessionListTab
							? `?sessionListTab=${sessionListTab}`
							: ''
					}`
				}}
			>
				<button
					type="button"
					className={`sessionsList__createChatButton ${isCreateChatActive ? 'sessionsList__createChatButton--active' : ''}`}
					title={translate(
						'sessionList.createChat.buttonTitle'
					)}
				>
					<img
						src={isCreateChatActive ? activeCreateGroup : defaultCreateGroup}
						alt={translate('sessionList.createChat.buttonTitle')}
						className="sessionsList__createChatButtonImage"
					/>
				</button>
			</Link>
		) : (
			<div className="sessionMenuPlaceholder"></div>
		)}
			</div>
			<SessionsList
				defaultLanguage={fixedLanguages[0]}
				sessionTypes={sessionTypes}
			/>
			<ResizableHandle onResize={handleResize} />
		</div>
	);
};
