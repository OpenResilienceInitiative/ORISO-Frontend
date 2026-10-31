import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import { snapSessionsListWidth } from '../sessionsList/resizableHandleMath';
import { SESSIONS_LIST_RESIZE } from '../sessionsList/sessionsListResize.constants';

export const TIMELINE_WIDTH_STORAGE_KEY = 'notificationsTimeline_width';
export const TIMELINE_DEFAULT_WIDTH = 400;
export const TIMELINE_MAX_WIDTH = 600;

/** Reuse the conversation stops, resolving its transitional 220px stop to the rail. */
export const normalizeTimelineListWidth = (width: number): number => {
	const snapped = snapSessionsListWidth(
		Number.isFinite(width) ? width : TIMELINE_DEFAULT_WIDTH,
		STAGE_LAYOUT.RAIL_WIDTH,
		TIMELINE_MAX_WIDTH
	);
	return snapped <= SESSIONS_LIST_RESIZE.ICON_ONLY_THRESHOLD
		? STAGE_LAYOUT.RAIL_WIDTH
		: snapped;
};

export const readTimelineListWidth = (saved: string | null): number =>
	saved?.trim() && Number.isFinite(Number(saved))
		? normalizeTimelineListWidth(Number(saved))
		: TIMELINE_DEFAULT_WIDTH;
