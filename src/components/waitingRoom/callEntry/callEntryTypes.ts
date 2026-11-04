/**
 * Prototype for ORISO-Frontend#1386 (Storybook only, nothing is wired).
 * Device state is handed in, so the same components run on fixtures in
 * stories and on `getUserMedia` in the live story.
 */
export type CallModality = 'video' | 'audio';

export type CallDeviceKind = 'camera' | 'microphone' | 'speaker';

export interface CallDevice {
	id: string;
	label: string;
}

export interface CallDevices {
	camera: CallDevice[];
	microphone: CallDevice[];
	speaker: CallDevice[];
}

export type CallDeviceSelection = Partial<Record<CallDeviceKind, string>>;

/** What the person has switched and chosen; applied to the real stream. */
export interface CallDeviceControls {
	micOn: boolean;
	cameraOn: boolean;
	selection: CallDeviceSelection;
}

/** What stands in the column instead of the device check. */
export type CallEntryBlocker =
	| 'permissionDenied'
	| 'noDevice'
	| 'deviceBusy'
	| 'notOpenYet'
	| 'callEnded'
	| 'linkInvalid';

/**
 * Devices an earlier check chose, by label: ids differ between pages and
 * visits, labels do not once access is granted.
 */
export type PreferredDeviceLabels = Partial<
	Record<'microphone' | 'camera', string>
>;
