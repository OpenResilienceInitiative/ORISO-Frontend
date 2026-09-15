import * as React from 'react';
import { useContext, useEffect, useRef, useState, useCallback } from 'react';
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
import {
	readPanelWidth,
	maxListWidthBesidePanel,
	resolveStageLayout,
	STAGE_LAYOUT
} from '../chatStage/stageLayout';
import { useViewportWidth } from '../chatStage/useViewportWidth';
import { useChatStageOpenPanel } from '../chatStage/ChatStagePanelContext';
import { SessionListRailProvider } from './SessionListRailContext';

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

	// D10 / B2 (review v11 checklist 7): while a side pane is open the
	// list column snaps to the icon rail when the chat card cannot host
	// two 520 px panes next to it — the same `resolveStageLayout` rule the
	// stage uses. "Open" is the pane the card actually shows
	// (`ChatStagePanelContext`, review D-4), not the `?channel=` request:
	// an asker's forwarded link or an unloaded thread root keeps the param
	// without a pane. The persisted width survives; dragging the list
	// wider is locked meanwhile.
	const viewportWidth = useViewportWidth();
	const openPanel = useChatStageOpenPanel();
	const panelOpen = openPanel !== null;
	const stageLayout = resolveStageLayout({
		viewportWidth,
		listWidth: sidebarWidth,
		panelWidth: readPanelWidth(STAGE_LAYOUT.MIN_PANE_WIDTH),
		panelOpen: fromL && panelOpen
	});
	// T41b (Frank, 15.09., "must be able to widen view"): the snap above is
	// an OFFER, not a lock. Pulling the handle past the rail takes the offer
	// back for as long as the reader keeps the list open; pushing it back to
	// the rail hands it over again, so opening the next side room snaps as
	// before.
	const [widenedBesidePanel, setWidenedBesidePanel] = useState(false);
	// Review (CodeRabbit): the flag belongs to ONE open panel. Setting it
	// while nothing is open would kill the snap for the next side room the
	// reader opens, and it must not survive the panel it was taken against —
	// including a team → thread switch that never goes through `null`.
	useEffect(() => {
		setWidenedBesidePanel(false);
	}, [openPanel]);
	const railSnapped =
		fromL &&
		panelOpen &&
		!widenedBesidePanel &&
		stageLayout.mode === 'split' &&
		stageLayout.listMode === 'rail';
	const effectiveWidth = railSnapped
		? Math.min(sidebarWidth, STAGE_LAYOUT.RAIL_WIDTH)
		: sidebarWidth;
	// Beside an open pane the list may grow until the chat card can no
	// longer host two panes at their drag floor.
	const maxListWidth =
		fromL && panelOpen
			? Math.min(
					EXPANDED_MAX_WIDTH,
					maxListWidthBesidePanel(viewportWidth)
				)
			: EXPANDED_MAX_WIDTH;

	// Switch a bit earlier so text layout never reaches the broken/truncated range.
	const isIconOnly = effectiveWidth < ICON_ONLY_THRESHOLD;

	const handleResize = useCallback(
		(width: number) => {
			const next = Math.min(width, maxListWidth);
			if (panelOpen) {
				setWidenedBesidePanel(next > STAGE_LAYOUT.RAIL_WIDTH);
			}
			setSidebarWidth(next);
			localStorage.setItem('sessionsList_width', next.toString());
		},
		[maxListWidth, panelOpen]
	);

	// Review (CodeRabbit): a window that shrinks under a widened list would
	// leave the chat and the panel below their drag floor — the persisted
	// width follows the current ceiling instead.
	useEffect(() => {
		setSidebarWidth((current) =>
			current > maxListWidth ? maxListWidth : current
		);
	}, [maxListWidth]);

	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return (
			<div
				className={`sessionsList__wrapper ${isIconOnly ? 'sessionsList__wrapper--iconOnly' : ''}`}
				style={{
					width: fromL ? `${effectiveWidth}px` : undefined,
					position: 'relative'
				}}
			>
				<SessionListRailProvider rail={isIconOnly}>
					<SessionsList
						defaultLanguage={fixedLanguages[0]}
						sessionTypes={sessionTypes}
						scrollContainerRef={listScrollRef}
					/>
				</SessionListRailProvider>
				<ResizableHandle
					currentWidth={effectiveWidth}
					onResize={handleResize}
					scrollTargetRef={listScrollRef}
					maxWidth={maxListWidth}
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
			<SessionListRailProvider rail={isIconOnly}>
				<SessionsList
					defaultLanguage={fixedLanguages[0]}
					sessionTypes={sessionTypes}
					scrollContainerRef={listScrollRef}
				/>
			</SessionListRailProvider>
			<ResizableHandle
				currentWidth={effectiveWidth}
				onResize={handleResize}
				scrollTargetRef={listScrollRef}
				maxWidth={maxListWidth}
			/>
		</div>
	);
};
