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
	/** Call message: this browser is in a call, this one or another. */
	alreadyInCall?: boolean;
	/** Circle: the group's room, where its calls take place. */
	roomRef?: string | null;
	/**
	 * Circle: how the group meets, as the group chat says
	 * (`UserChatDTO.modality`, ORISO-UserService `chat.modality`).
	 */
	circleModality?: 'TEXT' | 'AUDIO' | 'VIDEO' | null;
}

/**
 * - Call message: before every join, unless this browser is in a call (the
 *   camera is that call's then, and a second preview would fight it for the
 *   device). The join itself then says "already in it" or "busy".
 * - Circle pre-lobby: as an option, only in a video circle (product owner,
 *   2026-11-03), when the group's room is known — the choice is kept for
 *   that room's next call.
 */
export const shouldShowDeviceCheck = ({
	surface,
	mediaSupported,
	alreadyInCall = false,
	roomRef,
	circleModality
}: DeviceCheckContext): boolean => {
	if (!mediaSupported) return false;
	return surface === 'callMessage'
		? !alreadyInCall
		: Boolean(roomRef) && circleModality === 'VIDEO';
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
 * (`io.element.device_mute`). A check that could not run passes nothing, and
 * the call asks the browser itself, as it did before; unless the person
 * switched something off: that is still theirs to decide.
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
}: DeviceCheckOutcome): CallDeviceState | null => {
	const video = modality === 'video';
	if (blocker && micOn && (cameraOn || !video)) return null;
	return {
		audio_enabled: micOn,
		video_enabled: video && cameraOn && cameraAvailable
	};
};

/**
 * The choice waits here, per room, until that room's call is ready to take
 * it (`GroupCallWidget`). In memory only: a reload starts afresh.
 */
const chosen = new Map<
	string,
	{ media: CallDeviceState; cameraSwitch?: boolean }
>();

/**
 * @param cameraSwitch The camera switch itself, in a video check. `media` says
 * what the call gets, which is "off" for a camera that was not available too.
 */
export const rememberJoinMedia = (
	roomRef: string,
	media: CallDeviceState | null,
	cameraSwitch?: boolean
) => {
	if (media) chosen.set(roomRef, { media, cameraSwitch });
	else chosen.delete(roomRef);
};

export const peekJoinMedia = (
	roomRef: string | null | undefined
): CallDeviceState | null => (roomRef && chosen.get(roomRef)?.media) || null;

/** Where the camera switch was left; an audio check never touched it. */
export const peekCameraSwitch = (
	roomRef: string | null | undefined
): boolean | undefined => {
	const entry = roomRef ? chosen.get(roomRef) : undefined;
	return entry && (entry.cameraSwitch ?? true);
};

/** Keeps what a device check (`useCallDeviceCheck`) says now for that room. */
export const keepDeviceChoice = (
	roomRef: string,
	modality: CallModality,
	{
		controls,
		cameraAvailable,
		blocker
	}: {
		controls: CallDeviceControls;
		cameraAvailable: boolean;
		blocker?: CallEntryBlocker;
	}
) =>
	rememberJoinMedia(
		roomRef,
		joinMediaFrom({
			modality,
			micOn: controls.micOn,
			cameraOn: controls.cameraOn,
			cameraAvailable,
			blocker
		}),
		modality === 'video' ? controls.cameraOn : undefined
	);

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
	remembered: CallDeviceState | null,
	cameraSwitch?: boolean
): CallDeviceControls => ({
	micOn: remembered?.audio_enabled ?? true,
	cameraOn:
		modality === 'video' &&
		(cameraSwitch ?? remembered?.video_enabled ?? true),
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

const confirms = (
	wanted: Partial<CallDeviceState>,
	reported: CallDeviceState | null
) =>
	reported !== null &&
	(wanted.audio_enabled === undefined ||
		wanted.audio_enabled === reported.audio_enabled) &&
	(wanted.video_enabled === undefined ||
		wanted.video_enabled === reported.video_enabled);

/**
 * Sends the choice until the call's own answer confirms it. The call starts
 * with both on, and a person who switched the camera off must not stay on
 * camera because one message got lost. `false`: not confirmed.
 */
export const deliverJoinMedia = async (
	send: (media: Partial<CallDeviceState>) => Promise<CallDeviceState | null>,
	wanted: Partial<CallDeviceState>,
	{
		attempts = 3,
		waitMs = 1_000,
		stopped = () => false
	}: { attempts?: number; waitMs?: number; stopped?: () => boolean } = {}
): Promise<boolean> => {
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		if (stopped()) return false;
		const reported = await send(wanted).catch(() => null);
		if (confirms(wanted, reported)) return true;
		if (attempt < attempts) {
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}
	return false;
};
