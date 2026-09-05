/**
 * T16: the composer's scroll-to-newest arrow (global, every width). The
 * composer is docked to a chat card (`.session`) or a side panel
 * (`.sidePanel`); the timeline it belongs to is the nearest such host's
 * scroll container. The app may pass an explicit handler instead
 * (`onMobileNavigateBottom`) — this is the fallback that needs no wiring.
 */
const HOST_SELECTOR = '.sidePanel, .session';
const TIMELINE_SELECTOR = '.sidePanel__timeline, .session__content';

export const findTimelineScrollContainer = (
	from: Element | null
): HTMLElement | null => {
	const host = from?.closest(HOST_SELECTOR);
	if (!host) {
		return null;
	}
	// A side panel inside the card: prefer the panel's own timeline.
	const own = host.classList.contains('sidePanel')
		? host.querySelector<HTMLElement>('.sidePanel__timeline')
		: (host.querySelector<HTMLElement>(':scope > .session__content') ??
			host.querySelector<HTMLElement>(
				'.chatStage__mainPane > .session__content'
			));
	return own ?? host.querySelector<HTMLElement>(TIMELINE_SELECTOR);
};

/** Scrolls the composer's timeline to its end; `false` when none is found. */
export const scrollTimelineToNewest = (from: Element | null): boolean => {
	const container = findTimelineScrollContainer(from);
	if (!container) {
		return false;
	}
	container.scrollTop = container.scrollHeight;
	return true;
};
