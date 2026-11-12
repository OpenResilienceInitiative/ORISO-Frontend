import { useEffect, useState } from 'react';
import { endpoints } from '../resources/scripts/endpoints';
import { FETCH_ERRORS, FETCH_METHODS, fetchData } from '../api/fetchData';
import { AddonLink } from './addonLink';
import { useAddonRegistry } from './addonRegistry';

export type AddonCalendarKind = 'appointment' | 'deadline' | 'reminder';

/** One entry of `GET /service/addons/calendar` (contract `oriso-addon/v1`, section 3). */
export interface AddonCalendarEntry {
	id: string;
	addon: string;
	appId: string;
	kind: AddonCalendarKind;
	title: Record<string, string>;
	start: Date;
	end?: Date;
	allDay: boolean;
	link: AddonLink;
}

const KINDS: readonly AddonCalendarKind[] = [
	'appointment',
	'deadline',
	'reminder'
];
const DAY_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

const toDate = (value: unknown): Date | undefined => {
	if (typeof value !== 'string') return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
};

const toTexts = (value: unknown): Record<string, string> =>
	isRecord(value)
		? (Object.fromEntries(
				Object.entries(value).filter(
					([, text]) => typeof text === 'string' && text.trim()
				)
			) as Record<string, string>)
		: {};

const toEntry = (raw: unknown): AddonCalendarEntry | null => {
	if (!isRecord(raw)) return null;
	const { id, addon, appId } = raw;
	const start = toDate(raw.start);
	const title = toTexts(raw.title);
	if (
		(typeof id !== 'string' && typeof id !== 'number') ||
		typeof addon !== 'string' ||
		typeof appId !== 'string' ||
		!start ||
		Object.keys(title).length === 0
	) {
		return null;
	}
	const allDay = raw.allDay === true;
	const end =
		toDate(raw.end) ??
		(allDay ? new Date(start.getTime() + DAY_MS) : undefined);
	const link = isRecord(raw.link) ? raw.link : {};
	const sessionId = link.sessionId;
	return {
		id: String(id),
		addon,
		appId,
		kind: KINDS.includes(raw.kind as AddonCalendarKind)
			? (raw.kind as AddonCalendarKind)
			: 'appointment',
		title,
		start,
		end: end && end > start ? end : undefined,
		allDay,
		link: {
			addon,
			appId,
			slot: typeof link.slot === 'string' ? link.slot : null,
			sessionId:
				typeof sessionId === 'string' || typeof sessionId === 'number'
					? sessionId
					: null
		}
	};
};

export const parseAddonCalendar = (response: unknown): AddonCalendarEntry[] =>
	isRecord(response) && Array.isArray(response.entries)
		? response.entries
				.map(toEntry)
				.filter((entry): entry is AddonCalendarEntry => entry !== null)
				.sort((a, b) => a.start.getTime() - b.start.getTime())
		: [];

/** Calendar entries of all add-ons for a range; an unreachable AddonService yields none. */
export const apiGetAddonCalendar = async (
	from: Date,
	to: Date
): Promise<AddonCalendarEntry[]> => {
	try {
		const query = new URLSearchParams({
			from: from.toISOString(),
			to: to.toISOString()
		});
		const response = await fetchData({
			url: `${endpoints.addonCalendar}?${query}`,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
		});
		return parseAddonCalendar(response);
	} catch {
		return [];
	}
};

/** Add-on calendar entries from now until `monthsAhead`; loads only when the user has add-ons. */
export const useAddonCalendarEntries = ({
	enabled,
	monthsAhead
}: {
	enabled: boolean;
	monthsAhead: number;
}): AddonCalendarEntry[] => {
	const { addons } = useAddonRegistry();
	const [entries, setEntries] = useState<AddonCalendarEntry[]>([]);
	const active = enabled && addons.length > 0;

	useEffect(() => {
		if (!active) {
			setEntries([]);
			return undefined;
		}
		let current = true;
		const from = new Date();
		const to = new Date(from);
		to.setMonth(to.getMonth() + monthsAhead);
		apiGetAddonCalendar(from, to).then(
			(loaded) => current && setEntries(loaded)
		);
		return () => {
			current = false;
		};
	}, [active, addons, monthsAhead]);

	return entries;
};
