/**
 * Geometry rules for the voice player timeline ("Kacheln"), per the
 * "Chat message polish" design decision (turn 6a):
 *
 * - one tile per second up to the cap,
 * - above the cap the recording is split into `cap` equal sections and the
 *   meta line names the seconds per tile,
 * - narrow columns (`size="sm"`) get at most 10 sections and the tiles shrink
 *   with the column instead of overflowing.
 */

export type VoicePlayerSize = 'md' | 'sm';

export const TILE_CAP: Record<VoicePlayerSize, number> = {
	md: 16,
	sm: 10
};

export interface TileLayout {
	/** Maximum number of tiles for this size. */
	cap: number;
	/** Number of tiles actually rendered. */
	count: number;
	/** Seconds represented by a single tile. */
	secondsPerTile: number;
	/** True once tiles stand for sections rather than single seconds. */
	isSectioned: boolean;
}

export const getTileLayout = (
	durationSec: number,
	size: VoicePlayerSize = 'md'
): TileLayout => {
	const cap = TILE_CAP[size] ?? TILE_CAP.md;
	const duration = Number.isFinite(durationSec)
		? Math.max(0, durationSec)
		: 0;
	// Math.max(1, …) keeps sub-second recordings from collapsing to zero tiles,
	// which would make secondsPerTile divide by zero.
	const count =
		duration <= cap ? Math.max(1, Math.round(duration)) : Math.max(1, cap);

	return {
		cap,
		count,
		secondsPerTile: duration > 0 ? duration / count : 0,
		isSectioned: duration > cap
	};
};

/** `m:ss`, the clock format used across the chat. */
export const formatClock = (seconds: number): string => {
	const total = Number.isFinite(seconds)
		? Math.max(0, Math.round(seconds))
		: 0;
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
