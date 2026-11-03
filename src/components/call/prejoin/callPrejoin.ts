import type {
	CallDeviceState,
	ElementCallStart
} from '../widget/useElementCallWidget';
import type {
	CallDevice,
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
	/**
	 * Circle: how the group meets, as the group chat says
	 * (`UserChatDTO.modality`, ORISO-UserService `chat.modality`).
	 */
	circleModality?: 'TEXT' | 'AUDIO' | 'VIDEO' | null;
}

/**
 * - Call message: before every join, unless this browser is already in the
 *   call (the camera is the call's then, and a second preview would fight
 *   it for the device).
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
	/** The microphone the check showed, by label (`chosenDeviceLabel`). */
	microphoneLabel?: string;
	/** The camera the check showed, by label. */
	cameraLabel?: string;
}

/**
 * What the call is started with: on/off, and the devices by label
 * (ElementCall#116). By label, because device ids belong to the page that
 * asked for them and the call runs on another origin; labels are the same
 * on both once the browser has granted access.
 */
export interface JoinMedia extends CallDeviceState {
	microphoneLabel?: string;
	cameraLabel?: string;
}

/**
 * The label of the device the check showed: the one picked, or — nothing
 * picked — the first, which is the one the picker shows as chosen and the
 * stream uses.
 */
export const chosenDeviceLabel = (
	devices: readonly CallDevice[],
	selectedId: string | undefined
): string | undefined =>
	(devices.find((device) => device.id === selectedId) ?? devices[0])?.label;

/**
 * Microphone and camera for the call: on/off, and which ones by label. A
 * check that could not run passes nothing: the call then asks the browser
 * itself, as it did before. No camera label where the call has no camera.
 */
export const joinMediaFrom = ({
	modality,
	micOn,
	cameraOn,
	cameraAvailable,
	blocker,
	microphoneLabel,
	cameraLabel
}: DeviceCheckOutcome): JoinMedia | null => {
	if (blocker) return null;
	const hasCamera = modality === 'video' && cameraAvailable;
	return {
		audio_enabled: micOn,
		video_enabled: hasCamera && cameraOn,
		...(microphoneLabel ? { microphoneLabel } : {}),
		...(hasCamera && cameraLabel ? { cameraLabel } : {})
	};
};

/**
 * The choice waits here, per room, until that room's call is ready to take
 * it (`GroupCallWidget`). In memory only: a reload starts afresh.
 */
const chosen = new Map<string, JoinMedia>();

export const rememberJoinMedia = (roomRef: string, media: JoinMedia | null) => {
	if (media) chosen.set(roomRef, media);
	else chosen.delete(roomRef);
};

export const peekJoinMedia = (
	roomRef: string | null | undefined
): JoinMedia | null => (roomRef && chosen.get(roomRef)) || null;

/** Once: a later call in the same room starts as calls always did. */
export const takeJoinMedia = (
	roomRef: string | null | undefined
): JoinMedia | null => {
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
 * What the call is asked to switch once it is ready
 * (`io.element.device_mute`). A phone call has no camera to switch, so it is
 * only told about the microphone.
 *
 * Redundant with `callStartFor` for an Element Call that reads the start
 * parameters (ElementCall#116); kept for one that does not, until the image
 * that does runs everywhere.
 */
export const devicesForCall = (
	callIsVideo: boolean,
	media: JoinMedia | null
): Partial<CallDeviceState> | null => {
	if (!media) return null;
	return callIsVideo
		? {
				audio_enabled: media.audio_enabled,
				video_enabled: media.video_enabled
			}
		: { audio_enabled: media.audio_enabled };
};

/**
 * The choice as the call reads it at start (ElementCall#116): before any
 * track exists, so a camera switched off here is never captured, not even
 * for a moment. A phone call is only told about the microphone.
 */
export const callStartFor = (
	callIsVideo: boolean,
	media: JoinMedia | null
): ElementCallStart | null => {
	if (!media) return null;
	return {
		audioEnabled: media.audio_enabled,
		...(callIsVideo ? { videoEnabled: media.video_enabled } : {}),
		...(media.microphoneLabel ? { audioInput: media.microphoneLabel } : {}),
		...(callIsVideo && media.cameraLabel
			? { videoInput: media.cameraLabel }
			: {})
	};
};

/**
 * The ready-time fallback (`devicesForCall`), sent until the call takes it:
 * for an Element Call image that ignores the start parameters, this is the
 * only way a camera switched off in the check goes off, so one lost message
 * must not leave it on. A few tries, and only while that call is still there.
 * Resolves `true` once the call took it.
 */
export const switchDevicesOnReady = async (
	send: (media: Partial<CallDeviceState>) => Promise<void>,
	media: Partial<CallDeviceState>,
	{
		attempts = 3,
		delayMs = 1000,
		isCurrent = () => true
	}: { attempts?: number; delayMs?: number; isCurrent?: () => boolean } = {}
): Promise<boolean> => {
	for (let attempt = 1; attempt <= attempts && isCurrent(); attempt++) {
		try {
			await send(media);
			return true;
		} catch {
			if (attempt < attempts && isCurrent())
				await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
	return false;
};
