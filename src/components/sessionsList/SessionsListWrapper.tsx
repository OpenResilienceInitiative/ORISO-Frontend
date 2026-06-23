import * as React from 'react';
import { useContext, useRef, useState, useCallback } from 'react';
import { ResizableHandle } from './ResizableHandle';
import { SESSION_LIST_TYPES, SESSION_TYPES } from '../session/sessionHelpers';
import {
	AUTHORITIES,
	hasUserAuthority,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SessionsList } from './SessionsList';
import './sessionsList.styles';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../hooks/useResponsive';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';

interface SessionsListWrapperProps {
	sessionTypes: SESSION_TYPES;
}

export const SessionsListWrapper = ({
	sessionTypes
}: SessionsListWrapperProps) => {
	const { ICON_ONLY_THRESHOLD, SNAP_THRESHOLD } = SESSIONS_LIST_RESIZE;
	const MIN_WIDTH = 80;
	const { t: translate } = useTranslation();
	const { fromL } = useResponsive();
	const { fixed: fixedLanguages } = useContext(LanguagesContext);
	const { userData } = useContext(UserDataContext);
	const { type } = useContext(SessionTypeContext);
	const listScrollRef = useRef<HTMLDivElement | null>(null);

	// Resizable sidebar width
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		const saved = localStorage.getItem('sessionsList_width');
		const width = saved ? Number.parseInt(saved, 10) : 380;

		// Snap to proper size if in awkward range (prevent text truncation)
		if (width > MIN_WIDTH && width < ICON_ONLY_THRESHOLD) {
			// Snap to appropriate size
			return width < SNAP_THRESHOLD ? MIN_WIDTH : ICON_ONLY_THRESHOLD;
		}

		return width;
	});

	// Switch a bit earlier so text layout never reaches the broken/truncated range.
	const isIconOnly = sidebarWidth < ICON_ONLY_THRESHOLD;

	const handleResize = useCallback((width: number) => {
		setSidebarWidth(width);
		localStorage.setItem('sessionsList_width', width.toString());
	}, []);

	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return (
			<div
				className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
				style={{
					width: fromL ? `${sidebarWidth}px` : undefined,
					position: 'relative'
				}}
			>
				<SessionsList
					defaultLanguage={fixedLanguages[0]}
					sessionTypes={sessionTypes}
					scrollContainerRef={listScrollRef}
				/>
				<ResizableHandle
					currentWidth={sidebarWidth}
					onResize={handleResize}
					scrollTargetRef={listScrollRef}
				/>
			</div>
		);
	}

	return (
		<div
			className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
			style={{
				width: fromL ? `${sidebarWidth}px` : undefined,
				position: 'relative'
			}}
		>
			<SessionsList
				defaultLanguage={fixedLanguages[0]}
				sessionTypes={sessionTypes}
				scrollContainerRef={listScrollRef}
			/>
			<ResizableHandle
				currentWidth={sidebarWidth}
				onResize={handleResize}
				scrollTargetRef={listScrollRef}
			/>
		</div>
	);
};
