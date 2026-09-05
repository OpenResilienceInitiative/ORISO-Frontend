import * as React from 'react';
import { useContext, useRef, useState, useCallback } from 'react';
import { ResizableHandle } from './ResizableHandle';
import { SESSION_TYPES } from '../session/sessionHelpers';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { SessionsList } from './SessionsList';
import './sessionsList.styles';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { useResponsive } from '../../hooks/useResponsive';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import { useLocation } from 'react-router-dom';
import { parseChannel } from '../../utils/channelRoute';
import {
	readPanelWidth,
	resolveStageLayout,
	STAGE_LAYOUT
} from '../chatStage/stageLayout';
import { useViewportWidth } from '../chatStage/useViewportWidth';

interface SessionsListWrapperProps {
	sessionTypes: SESSION_TYPES;
}

export const SessionsListWrapper = ({
	sessionTypes
}: SessionsListWrapperProps) => {
	const {
		ICON_ONLY_THRESHOLD,
		SNAP_THRESHOLD,
		EXPANDED_MIN_WIDTH,
		EXPANDED_MAX_WIDTH,
		EXPANDED_SNAP_THRESHOLD
	} = SESSIONS_LIST_RESIZE;
	const MIN_WIDTH = 80;
	const { fromL } = useResponsive();
	const { fixed: fixedLanguages } = useContext(LanguagesContext);
	const { userData } = useContext(UserDataContext);
	const listScrollRef = useRef<HTMLDivElement | null>(null);

	// Resizable sidebar width. Default sits inside the expanded desktop band
	// (Figma node 115: min 397 / max 500).
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		const saved = localStorage.getItem('sessionsList_width');
		const width = saved ? Number.parseInt(saved, 10) : 420;

		// Snap to proper size if in awkward range (prevent text truncation)
		if (width > MIN_WIDTH && width < ICON_ONLY_THRESHOLD) {
			// Snap to appropriate size
			return width < SNAP_THRESHOLD ? MIN_WIDTH : ICON_ONLY_THRESHOLD;
		}

		// Snap the icon-only → expanded gap so the list is either compact or at
		// least the expanded minimum, never stranded mid-range.
		if (width > ICON_ONLY_THRESHOLD && width < EXPANDED_MIN_WIDTH) {
			return width < EXPANDED_SNAP_THRESHOLD
				? ICON_ONLY_THRESHOLD
				: EXPANDED_MIN_WIDTH;
		}

		// Clamp anything above the expanded maximum.
		if (width > EXPANDED_MAX_WIDTH) {
			return EXPANDED_MAX_WIDTH;
		}

		return width;
	});

	// D10 / B2 (review v11 checklist 7): while a side panel is open
	// (`?channel=`, the one truth) the list column snaps to the icon rail
	// when the chat card cannot host two 520 px panes next to it — the
	// same `resolveStageLayout` rule the stage uses. The persisted width
	// survives; dragging the list wider is locked meanwhile.
	const location = useLocation();
	const viewportWidth = useViewportWidth();
	const panelOpen = parseChannel(location.search).channel !== null;
	const stageLayout = resolveStageLayout({
		viewportWidth,
		listWidth: sidebarWidth,
		panelWidth: readPanelWidth(STAGE_LAYOUT.MIN_PANE_WIDTH),
		panelOpen: fromL && panelOpen
	});
	const railSnapped =
		fromL &&
		stageLayout.mode === 'split' &&
		stageLayout.listMode === 'rail';
	const effectiveWidth = railSnapped
		? Math.min(sidebarWidth, STAGE_LAYOUT.RAIL_WIDTH)
		: sidebarWidth;

	// Switch a bit earlier so text layout never reaches the broken/truncated range.
	const isIconOnly = effectiveWidth < ICON_ONLY_THRESHOLD;

	const handleResize = useCallback(
		(width: number) => {
			if (railSnapped && width > STAGE_LAYOUT.RAIL_WIDTH) {
				return;
			}
			setSidebarWidth(width);
			localStorage.setItem('sessionsList_width', width.toString());
		},
		[railSnapped]
	);

	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return (
			<div
				className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
				style={{
					width: fromL ? `${effectiveWidth}px` : undefined,
					position: 'relative'
				}}
			>
				<SessionsList
					defaultLanguage={fixedLanguages[0]}
					sessionTypes={sessionTypes}
					scrollContainerRef={listScrollRef}
				/>
				<ResizableHandle
					currentWidth={effectiveWidth}
					onResize={handleResize}
					scrollTargetRef={listScrollRef}
					maxWidth={
						railSnapped
							? STAGE_LAYOUT.RAIL_WIDTH
							: EXPANDED_MAX_WIDTH
					}
				/>
			</div>
		);
	}

	return (
		<div
			className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
			style={{
				width: fromL ? `${effectiveWidth}px` : undefined,
				position: 'relative'
			}}
		>
			<SessionsList
				defaultLanguage={fixedLanguages[0]}
				sessionTypes={sessionTypes}
				scrollContainerRef={listScrollRef}
			/>
			<ResizableHandle
				currentWidth={effectiveWidth}
				onResize={handleResize}
				scrollTargetRef={listScrollRef}
				maxWidth={
					railSnapped ? STAGE_LAYOUT.RAIL_WIDTH : EXPANDED_MAX_WIDTH
				}
			/>
		</div>
	);
};
