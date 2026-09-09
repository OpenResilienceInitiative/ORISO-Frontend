/**
 * Pure rules behind the side room's call controls (Frank, 09.09.2026: "auch
 * braucht die supervision die möglichkeit das man einen call haben kann
 * entweder video oder audio").
 *
 * Same three questions the main chat header answers, in the same order:
 *
 * 1. WHICH calls — the tenant's supervision gates
 *    (`featureVideoCallsSupervisionChatsEnabled` /
 *    `featureAudioCallsSupervisionChatsEnabled`). Both off means the tenant
 *    switched calls off for this room: nothing renders, as in `SessionMenu`.
 * 2. WHERE — the header row while the column has space, the kebab when it is
 *    narrow or on the phone. That is D8's decision, taken by the same
 *    threshold as the main chat header (`roomHeaderDensity.ts`).
 * 3. WHETHER — a call needs somebody to call. Alone in the side room the
 *    buttons are DISABLED, never hidden (house rule "disable, don't hide").
 *
 * No React, no DOM. `PanelCallActions` only renders what this returns.
 */
import { HEADER_COMPACT_WIDTH } from '../sessionHeader/roomHeaderDensity';

export type PanelCallKind = 'video' | 'audio';
export type PanelCallPlacement = 'row' | 'menu';

export interface PanelCallActionsInput {
	/** Measured width of the panel; `null` before the first measurement. */
	width: number | null | undefined;
	/** People visible in the side room, me included. */
	participantCount: number;
	audioEnabled: boolean;
	videoEnabled: boolean;
	/** Viewport phone (`useResponsive().untilM`). */
	phone?: boolean;
}

export interface PanelCallActionsState {
	visible: boolean;
	placement: PanelCallPlacement;
	/** Video first, as in the main chat header. */
	kinds: PanelCallKind[];
	/** Nobody else in the room — the controls stay, greyed out. */
	disabled: boolean;
}

export const resolvePanelCallActions = ({
	width,
	participantCount,
	audioEnabled,
	videoEnabled,
	phone = false
}: PanelCallActionsInput): PanelCallActionsState => {
	const kinds: PanelCallKind[] = [
		...(videoEnabled ? (['video'] as const) : []),
		...(audioEnabled ? (['audio'] as const) : [])
	];
	const measured = Number.isFinite(width as number) ? (width as number) : 0;
	return {
		visible: kinds.length > 0,
		placement:
			phone || (measured > 0 && measured < HEADER_COMPACT_WIDTH)
				? 'menu'
				: 'row',
		kinds,
		disabled: participantCount < 2
	};
};
