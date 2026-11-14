/**
 * FullCalendar 7.1.5 queues a "restore the time scroll" step after it has
 * measured the time grid. When the grid unmounts before that queue runs
 * (switching views, leaving the page), the step calls `scrollTo` on a
 * scroller that is gone and throws "Cannot read properties of null (reading
 * 'scrollTo')" from inside FullCalendar. Once a grid unmounts, its scrollers
 * are replaced by inert ones so a late step does nothing.
 *
 * Remove this when FullCalendar guards `applyTimeScroll` itself.
 */
import { TimeGridLayout } from '@fullcalendar/react/protected-api';

interface ScrollerRef {
	current: { scrollTo: (position: { x?: number; y?: number }) => void };
}
interface GuardedLayout {
	componentWillUnmount?: () => void;
	timeScrollerRef?: ScrollerRef;
	dayScrollerRef?: ScrollerRef;
}

const GUARDED = Symbol.for('oriso.calendar.timeGridUnmountGuard');
const inert = (): ScrollerRef => ({ current: { scrollTo: () => undefined } });

const prototype = (
	TimeGridLayout as unknown as { prototype?: GuardedLayout } | undefined
)?.prototype as (GuardedLayout & { [GUARDED]?: boolean }) | undefined;

if (prototype && !prototype[GUARDED]) {
	const unmount = prototype.componentWillUnmount;
	prototype.componentWillUnmount = function (this: GuardedLayout) {
		unmount?.call(this);
		this.timeScrollerRef = inert();
		this.dayScrollerRef = inert();
	};
	prototype[GUARDED] = true;
}
