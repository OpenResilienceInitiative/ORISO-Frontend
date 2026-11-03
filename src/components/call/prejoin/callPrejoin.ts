import type { CallDeviceState } from '../widget/useElementCallWidget';
import type {
	CallDeviceControls,
	CallEntryBlocker,
	CallModality
} from '../../waitingRoom/callEntry/callEntryTypes';

/**
 * The small decisions behind the pre-join device check for signed-in people
 * (#2016): when the check shows, and what of it reaches the call.
 *
 * The check itself is the guest waiting room's (`CallDeviceCheck`), shown in
 * the knock wait dialog's shell. The call is Element Call; it starts with
 * `skipLobby`, so this check is the only one the person gets.
 */

/** Where the check is offered. */
export type PrejoinSurface = 'callMessage' | 'circleLobby';

export interface DeviceCheckContext {
	surface: PrejoinSurface;
	/** The browser can ask for camera and microphone at all. */
	mediaSupported: boolean;
	/** Call message: this browser is already in that very call. */
	alreadyInCall?: boolean;
	/** Circle: the group's room, where its calls take place. */
	roomRef?: string | null;
}

/**
 * - Call message: before every join, unless this browser is already in the
 *   call (the camera is the call's then, and a second preview would fight
 *   it for the device).
 * - Circle pre-lobby: as an option, when the group's room is known — the
 *   choice is kept for that room's next call.
 */
export const shouldShowDeviceCheck = ({
	surface,
	mediaSupported,
	alreadyInCall = false,
	roomRef
}: DeviceCheckContext): boolean => {
	if (!mediaSupported) return false;
	return surface === 'callMessage' ? !alreadyInCall : Boolean(roomRef);
};

/** What the person left the check with. */
export interface DeviceCheckOutcome {
	modality: CallModality;
	micOn: boolean;
	cameraOn: boolean;
	/** `false`: no usable webcam (none, denied or busy). */
	cameraAvailable: boolean;
	/** The check could not run at all. */
	blocker?: CallEntryBlocker;
}

/**
 * Microphone and camera for the call, in Element Call's own words
 * (`io.element.device_mute`). A check that could not run passes nothing:
 * the call then asks the browser itself, as it did before.
 *
 * Not passed: which camera or microphone was picked. Device ids belong to
 * the page that asked for them, and the call runs on another origin; the
 * widget API has no action to choose an input device either.
 */
export const joinMediaFrom = ({
	modality,
	micOn,
	cameraOn,
	cameraAvailable,
	blocker
}: DeviceCheckOutcome): CallDeviceState | null =>
	blocker
		? null
		: {
				audio_enabled: micOn,
				video_enabled:
					modality === 'video' && cameraOn && cameraAvailable
			};

/**
 * The choice waits here, per room, until that room's call is ready to take
 * it (`GroupCallWidget`). In memory only: a reload starts afresh.
 */
const chosen = new Map<string, CallDeviceState>();

export const rememberJoinMedia = (
	roomRef: string,
	media: CallDeviceState | null
) => {
	if (media) chosen.set(roomRef, media);
	else chosen.delete(roomRef);
};

export const peekJoinMedia = (
	roomRef: string | null | undefined
): CallDeviceState | null => (roomRef && chosen.get(roomRef)) || null;

/** Once: a later call in the same room starts as calls always did. */
export const takeJoinMedia = (
	roomRef: string | null | undefined
): CallDeviceState | null => {
	const media = peekJoinMedia(roomRef);
	if (roomRef) chosen.delete(roomRef);
	return media;
};

/** Stories and tests. */
export const forgetAllJoinMedia = () => chosen.clear();

/** A second check in the same room opens where the first one left off. */
export const initialControlsFor = (
	modality: CallModality,
	remembered: CallDeviceState | null
): CallDeviceControls => ({
	micOn: remembered?.audio_enabled ?? true,
	cameraOn: modality === 'video' && (remembered?.video_enabled ?? true),
	selection: {}
});

/**
 * What the call is asked to switch once it is ready. A phone call has no
 * camera to switch, so it is only told about the microphone.
 */
export const devicesForCall = (
	callIsVideo: boolean,
	media: CallDeviceState | null
): Partial<CallDeviceState> | null => {
	if (!media) return null;
	return callIsVideo ? media : { audio_enabled: media.audio_enabled };
};
