import type {
	CallDeviceState,
	ElementCallStart
} from '../widget/useElementCallWidget';
import type {
	CallDevice,
	CallDeviceControls,
	CallDeviceSelection,
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
 * check that could not run passes nothing, and the call asks the browser
 * itself, as it did before; unless the person switched something off: that
 * is still theirs to decide. No camera label where the call has no camera.
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
	const video = modality === 'video';
	if (blocker && micOn && (cameraOn || !video)) return null;
	const hasCamera = video && cameraAvailable;
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
const chosen = new Map<
	string,
	{
		media: JoinMedia;
		cameraSwitch?: boolean;
		selection: CallDeviceSelection;
	}
>();

/**
 * @param cameraSwitch The camera switch itself, in a video check. `media` says
 * what the call gets, which is "off" for a camera that was not available too.
 * @param selection The devices picked in the check, for the next check to open
 * on: by id, which holds here, in the page that asked for them.
 */
export const rememberJoinMedia = (
	roomRef: string,
	media: JoinMedia | null,
	cameraSwitch?: boolean,
	selection: CallDeviceSelection = {}
) => {
	if (media) chosen.set(roomRef, { media, cameraSwitch, selection });
	else chosen.delete(roomRef);
};

export const peekJoinMedia = (
	roomRef: string | null | undefined
): JoinMedia | null => (roomRef && chosen.get(roomRef)?.media) || null;

/** Where the camera switch was left; an audio check never touched it. */
export const peekCameraSwitch = (
	roomRef: string | null | undefined
): boolean | undefined => {
	const entry = roomRef ? chosen.get(roomRef) : undefined;
	return entry && (entry.cameraSwitch ?? true);
};

/** The devices the last check for that room picked. */
export const peekDeviceSelection = (
	roomRef: string | null | undefined
): CallDeviceSelection => (roomRef && chosen.get(roomRef)?.selection) || {};

/** Keeps what a device check (`useCallDeviceCheck`) says now for that room. */
export const keepDeviceChoice = (
	roomRef: string,
	modality: CallModality,
	{
		controls,
		cameraAvailable,
		blocker,
		devices
	}: {
		controls: CallDeviceControls;
		cameraAvailable: boolean;
		blocker?: CallEntryBlocker;
		/** What the check found: the choice names its devices by label. */
		devices?: {
			microphone: readonly CallDevice[];
			camera: readonly CallDevice[];
		};
	}
) =>
	rememberJoinMedia(
		roomRef,
		joinMediaFrom({
			modality,
			micOn: controls.micOn,
			cameraOn: controls.cameraOn,
			cameraAvailable,
			blocker,
			microphoneLabel: chosenDeviceLabel(
				devices?.microphone ?? [],
				controls.selection.microphone
			),
			cameraLabel: chosenDeviceLabel(
				devices?.camera ?? [],
				controls.selection.camera
			)
		}),
		modality === 'video' ? controls.cameraOn : undefined,
		controls.selection
	);

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
	remembered: CallDeviceState | null,
	cameraSwitch?: boolean,
	selection: CallDeviceSelection = {}
): CallDeviceControls => ({
	micOn: remembered?.audio_enabled ?? true,
	cameraOn:
		modality === 'video' &&
		(cameraSwitch ?? remembered?.video_enabled ?? true),
	selection
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
 * The ready-time fallback (`devicesForCall`), sent until the call's own answer
 * confirms it: an Element Call image that ignores the start parameters starts
 * with both on, and a person who switched the camera off must not stay on
 * camera because one message got lost. `false`: not confirmed, or confirmed by
 * a call that has gone meanwhile.
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
		if (confirms(wanted, reported)) return !stopped();
		if (attempt < attempts) {
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}
	return false;
};
