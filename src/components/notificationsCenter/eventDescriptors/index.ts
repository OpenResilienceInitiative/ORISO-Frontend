/**
 * WP-06 Activity Timeline — Event-descriptor registry (Slice 0a) public API.
 *
 * Single import surface for the registry that turns a typed, text-free server
 * record into a rendered timeline card. See `types.ts` for the shapes and
 * `registry.ts` for the seeded descriptors.
 */

export type {
	EventFamily,
	EventCategory,
	EventIconId,
	EventActionParams,
	EventActionTarget,
	EventDescriptor
} from './types';

export {
	EVENT_DESCRIPTORS,
	KNOWN_EVENT_TYPES,
	FALLBACK_DESCRIPTOR,
	getEventDescriptor,
	isKnownEventType,
	familyLabelKey
} from './registry';

export { EVENT_ICONS, getEventIcon } from './icons';

export type {
	TranslateFn,
	EventStringInput,
	RenderedEventStrings
} from './renderEventStrings';
export { renderEventStrings } from './renderEventStrings';
