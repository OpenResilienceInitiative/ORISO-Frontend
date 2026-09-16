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
	/** The kind has a chip in the row (a menu entry). Requires `show`. */
	pill: boolean;
	/**
	 * Notification sound for items of this kind (Frank 2026-09-16, "Ton"):
	 * `false` mutes the kind on top of the area sound settings. Missing means
	 * on. Kept out of {@link resolveKindSetting} — read via {@link isKindMuted}.
	 */
	sound?: boolean;
}

/**
 * How the chip row draws its chips (Figma 1139:45736 / 9947:31377):
 * `icons` = icon pills, only the active one shows its label; `labels` =
 * icon + label on every pill; `text` = compact text pills, no icons.
 */
export type ChipView = 'icons' | 'labels' | 'text';
export const CHIP_VIEWS: ReadonlyArray<ChipView> = ['icons', 'labels', 'text'];

export interface ChipPresentation {
	view: ChipView;
	/** Kinds with unread items float to the left of the row. */
	autoSort: boolean;
}

export const DEFAULT_CHIP_PRESENTATION: ChipPresentation = {
	view: 'icons',
	autoSort: true
};

export interface DisplayFilterValue {
	/** Per kind id; a missing entry means {@link DEFAULT_KIND_SETTING}. */
	kinds: Partial<Record<string, KindSetting>>;
	/** "Hide ⇒ read" (spec §6). Ignored by sections without auto-read. */
	autoReadHidden: boolean;
	/** Chip row view; missing means {@link DEFAULT_CHIP_PRESENTATION}. */
	view?: ChipView;
	/** Chip row auto-sort; missing means {@link DEFAULT_CHIP_PRESENTATION}. */
	autoSort?: boolean;
}

/** Effective chip presentation of one value, defaults filled in. */
export const resolveChipPresentation = (
	value: Pick<DisplayFilterValue, 'view' | 'autoSort'>
): ChipPresentation => ({
	view: value.view ?? DEFAULT_CHIP_PRESENTATION.view,
	autoSort: value.autoSort ?? DEFAULT_CHIP_PRESENTATION.autoSort
});

/** What the dialog needs to render one kind row. Labels arrive translated. */
export interface DisplayFilterKindOption {
	id: string;
	label: string;
	/** Chip caption when it differs from the dialog row label (Sonstiges row → "Weitere" chip). */
	chipLabel?: string;
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	/** Unread items of this kind in the loaded feed (drives the pill badge). */
	unreadCount?: number;
	/**
	 * Some event types of this kind are hidden in the profile (spec §5.1):
	 * the show checkbox renders indeterminate ("mixed") instead of checked.
	 */
	partial?: boolean;
	/**
	 * The kind gates a panel, not rows (e.g. "Future timeline", spec §5.2):
	 * no unread count and no chip, so the dialog renders no Pill control and
	 * {@link visiblePillKinds} never yields it.
	 */
	showOnly?: boolean;
	/**
	 * Träger feature switch (Frank 2026-09-16): `deactivated` kinds stay
	 * listed with their controls locked and a notice, `absent` kinds are not
	 * listed at all. Missing means `available`.
	 */
	availability?: KindAvailability;
}

/**
 * What the Träger's feature switch means for one kind of this list:
 * - `available`: the format is on.
 * - `deactivated`: the format is off but rows of that kind still exist —
 *   they stay visible, the chip and the dialog row are shown locked, and a
 *   snackbar explains. Nothing vanishes silently.
 * - `absent`: the format is off and nothing of that kind exists → not listed.
 */
export type KindAvailability = 'available' | 'deactivated' | 'absent';

export const resolveKindAvailability = ({
	formatEnabled,
	rowCount
}: {
	formatEnabled: boolean;
	rowCount: number;
}): KindAvailability => {
	if (formatEnabled) {
		return 'available';
	}
	return rowCount > 0 ? 'deactivated' : 'absent';
};

/** The kinds a dialog/chip row lists: everything but `absent`. */
export const listedKinds = <
	T extends Pick<DisplayFilterKindOption, 'availability'>
>(
	kinds: ReadonlyArray<T>
): T[] => kinds.filter((kind) => kind.availability !== 'absent');

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

/** True when the user muted this kind's notification sound. */
export const isKindMuted = (value: DisplayFilterValue, kindId: string): boolean =>
	value.kinds[kindId]?.sound === false;

/**
 * Kinds accepted by {@link isDisplayFilterCustomised}: plain ids, or the
 * rendered options so profile-owned partial hiding (spec §5.1) counts too.
 */
export type DisplayFilterKindRef =
	| string
	| Pick<DisplayFilterKindOption, 'id' | 'partial' | 'showOnly'>;

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
		const showOnly =
			typeof kind === 'string' ? false : Boolean(kind.showOnly);
		const setting = resolveKindSetting(value, kindId);
		// A show-only kind has no pill (spec §5.2), so a stale `pill: false`
		// left behind by hide → show must not count as customised.
		return (
			partial ||
			!setting.show ||
			(!showOnly && !setting.pill) ||
			isKindMuted(value, kindId)
		);
	});

/**
 * Immutable update of one kind. The stored `pill` is the user's intent and
 * survives hide → show untouched; {@link resolveKindSetting} masks it while
 * the kind is hidden. (Before 2026-09-16 hiding overwrote the intent, so a
 * re-shown kind came back without its pill — Frank's "nothing happens".)
 */
export const setKindSetting = (
	value: DisplayFilterValue,
	kindId: string,
	patch: Partial<KindSetting>
): DisplayFilterValue => {
	const current: KindSetting = {
		...DEFAULT_KIND_SETTING,
		...(value.kinds[kindId] || {})
	};
	const next: KindSetting = { ...current, ...patch };
	if (kindId === OTHER_KIND_ID) {
		next.show = true;
	}
	if (next.sound !== false) {
		delete next.sound;
	}
	return { ...value, kinds: { ...value.kinds, [kindId]: next } };
};

/**
 * Which kinds get a chip: every shown kind whose pill is on. A chip is a
 * menu entry (Frank, 2026-09-16, replaces spec §5.1 "chip only while
 * unread"): unread items are shown as a marker/count badge on the chip, the
 * chip itself never comes and goes with the count. Show-only kinds gate a
 * panel, not rows, and never get a chip. `activeKindId` is accepted for
 * call-site compatibility; the active chip is a shown kind by construction
 * (see {@link reconcileActiveKind}).
 */
export const visiblePillKinds = <T extends DisplayFilterKindOption>(
	value: DisplayFilterValue,
	kinds: ReadonlyArray<T>,
	_activeKindId: string | null = null
): T[] => {
	const bundled = kindsUnderOther(value, kinds);
	const bundledUnread = kinds
		.filter((kind) => bundled.includes(kind.id))
		.reduce((sum, kind) => sum + (kind.unreadCount ?? 0), 0);
	return (
		kinds
			.filter(
				(kind) =>
					!kind.showOnly && resolveKindSetting(value, kind.id).pill
			)
			// The bundle chip only when it has something to hold: bundled kinds
			// or unread unmapped items (Frank 2026-09-16: "alle Arten an → kein
			// Sonstiges").
			.filter(
				(kind) =>
					kind.id !== OTHER_KIND_ID ||
					bundled.length > 0 ||
					(kind.unreadCount ?? 0) > 0
			)
			.map((kind) =>
				kind.id === OTHER_KIND_ID && bundledUnread > 0
					? {
							...kind,
							unreadCount: (kind.unreadCount ?? 0) + bundledUnread
						}
					: kind
			)
	);
};

/**
 * Sonstiges bundles every shown kind whose own pill is off (Frank
 * 2026-09-16): their unread items count on the Sonstiges chip and the
 * Sonstiges chip filters to them. Hidden and show-only kinds are not part
 * of it, nor is Sonstiges itself.
 */
export const kindsUnderOther = (
	value: DisplayFilterValue,
	kinds: ReadonlyArray<DisplayFilterKindOption>
): string[] =>
	kinds
		.filter((kind) => {
			if (kind.id === OTHER_KIND_ID || kind.showOnly) {
				return false;
			}
			const setting = resolveKindSetting(value, kind.id);
			return setting.show && !setting.pill;
		})
		.map((kind) => kind.id);

/** True when a row of `rowKind` belongs to the active Sonstiges chip. */
export const matchesOtherChip = (
	value: DisplayFilterValue,
	kinds: ReadonlyArray<DisplayFilterKindOption>,
	rowKind: string
): boolean =>
	rowKind === OTHER_KIND_ID ||
	kindsUnderOther(value, kinds).includes(rowKind);

export interface ChipOrderOptions {
	/** Kinds with unread items float to the left; order is stable otherwise. */
	autoSort: boolean;
}

/**
 * Display order of the chips. With auto-sort on, kinds that have unread
 * items come first (in section order among themselves), then the rest in
 * section order. Off: the section order as given.
 */
export const orderChipKinds = <T extends DisplayFilterKindOption>(
	kinds: ReadonlyArray<T>,
	{ autoSort }: ChipOrderOptions
): T[] => {
	if (!autoSort) {
		return [...kinds];
	}
	const unread = kinds.filter((kind) => (kind.unreadCount ?? 0) > 0);
	const rest = kinds.filter((kind) => (kind.unreadCount ?? 0) === 0);
	return [...unread, ...rest];
};

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
