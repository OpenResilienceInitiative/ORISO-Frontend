/**
 * Display filter (#1377, spec §3/§7) — presentational types shared by the
 * Storybook-first UI slice. No persistence here: the store/hook (slice 2)
 * produces a `DisplayFilterValue`, the dialog edits it, the lists read it.
 */

/** The catch-all kind every section carries. Always shown (spec §3). */
export const OTHER_KIND_ID = 'other';

export interface KindSetting {
	/** Rows of this kind appear in the list. Forced true for `other`. */
	show: boolean;
	/** A chip renders while the kind has unread items. Requires `show`. */
	pill: boolean;
}

export interface DisplayFilterValue {
	/** Per kind id; a missing entry means {@link DEFAULT_KIND_SETTING}. */
	kinds: Partial<Record<string, KindSetting>>;
	/** "Hide ⇒ read" (spec §6). Ignored by sections without auto-read. */
	autoReadHidden: boolean;
}

/** What the dialog needs to render one kind row. Labels arrive translated. */
export interface DisplayFilterKindOption {
	id: string;
	label: string;
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	/** Unread items of this kind in the loaded feed (drives the pill badge). */
	unreadCount?: number;
	/**
	 * Some event types of this kind are hidden in the profile (spec §5.1):
	 * the show checkbox renders indeterminate ("mixed") instead of checked.
	 */
	partial?: boolean;
}

export const DEFAULT_KIND_SETTING: KindSetting = { show: true, pill: true };

export const EMPTY_DISPLAY_FILTER: DisplayFilterValue = {
	kinds: {},
	autoReadHidden: false
};

/**
 * Effective setting for one kind: defaults fill gaps, `other` can never be
 * hidden, and a hidden kind never has a pill (spec §3).
 */
export const resolveKindSetting = (
	value: DisplayFilterValue,
	kindId: string
): KindSetting => {
	const raw = { ...DEFAULT_KIND_SETTING, ...(value.kinds[kindId] || {}) };
	const show = kindId === OTHER_KIND_ID ? true : raw.show;
	return { show, pill: show && raw.pill };
};

/**
 * Kinds accepted by {@link isDisplayFilterCustomised}: plain ids, or the
 * rendered options so profile-owned partial hiding (spec §5.1) counts too.
 */
export type DisplayFilterKindRef =
	| string
	| Pick<DisplayFilterKindOption, 'id' | 'partial'>;

/**
 * True when the EFFECTIVE filter differs from "show everything with pills"
 * (drives the button dot, spec §3): a hidden kind, a pill switched off,
 * auto-read on, or a kind whose event types are partly hidden in the profile
 * (`partial`) — that last one filters the feed although `value` is empty.
 */
export const isDisplayFilterCustomised = (
	value: DisplayFilterValue,
	kinds: ReadonlyArray<DisplayFilterKindRef>
): boolean =>
	value.autoReadHidden ||
	kinds.some((kind) => {
		const kindId = typeof kind === 'string' ? kind : kind.id;
		const partial =
			typeof kind === 'string' ? false : Boolean(kind.partial);
		const setting = resolveKindSetting(value, kindId);
		return partial || !setting.show || !setting.pill;
	});

/** Immutable update of one kind; hiding a kind also drops its pill. */
export const setKindSetting = (
	value: DisplayFilterValue,
	kindId: string,
	patch: Partial<KindSetting>
): DisplayFilterValue => {
	const current = resolveKindSetting(value, kindId);
	const next: KindSetting = { ...current, ...patch };
	if (kindId === OTHER_KIND_ID) {
		next.show = true;
	}
	if (!next.show) {
		next.pill = false;
	}
	return { ...value, kinds: { ...value.kinds, [kindId]: next } };
};

/**
 * Which kinds get a chip right now: pill enabled, and either unread items
 * present or the chip is the active one (spec §5.1).
 */
export const visiblePillKinds = <T extends DisplayFilterKindOption>(
	value: DisplayFilterValue,
	kinds: ReadonlyArray<T>,
	activeKindId: string | null
): T[] =>
	kinds.filter((kind) => {
		const setting = resolveKindSetting(value, kind.id);
		if (!setting.pill) {
			return false;
		}
		return (kind.unreadCount ?? 0) > 0 || kind.id === activeKindId;
	});

/**
 * The active chip must never outlive its pill: when the user hides a kind or
 * switches its pill off while that kind is the active filter, the chip that
 * would clear the selection is gone. Callers pass the active kind through
 * this on every value change and store the result (spec §5.1).
 */
export const reconcileActiveKind = (
	value: DisplayFilterValue,
	activeKindId: string | null
): string | null =>
	activeKindId && resolveKindSetting(value, activeKindId).pill
		? activeKindId
		: null;
