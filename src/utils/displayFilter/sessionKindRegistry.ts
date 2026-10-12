/**
 * Session id → classified display-filter kind, published by the lists that
 * classify their rows (SessionsList for Gespräche and Anfragen) and read by
 * NotificationsProvider to apply the per-kind sound mute (#1377, Frank
 * 2026-09-16: "Ton" column). A plain module store: no React, no persistence.
 */
import type { DisplayFilterSection } from './model';

export interface SessionKindEntry {
	section: DisplayFilterSection;
	kind: string;
}

class SessionKindRegistry {
	private bySection = new Map<DisplayFilterSection, Record<string, string>>();

	/** Replace the whole mapping of one section (the list's current rows). */
	publish(
		section: DisplayFilterSection,
		kinds: Record<string, string>
	): void {
		this.bySection.set(section, { ...kinds });
	}

	lookup(
		sessionId: string | number | null | undefined
	): SessionKindEntry | null {
		if (sessionId === null || sessionId === undefined) {
			return null;
		}
		const id = String(sessionId);
		for (const [section, kinds] of this.bySection) {
			const kind = kinds[id];
			if (kind) {
				return { section, kind };
			}
		}
		return null;
	}

	reset(): void {
		this.bySection.clear();
	}
}

export const sessionKindRegistry = new SessionKindRegistry();
