import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserDataContext } from '../../../globalState';
import { generateAvatarForUser } from '../../../utils/pseudonymGenerator';
import { useLiveCallDevices } from './useLiveCallDevices';
import type { CallDeviceCheckProps } from './CallDeviceCheck';
import type {
	CallDeviceControls,
	CallDevices,
	CallDeviceSelection,
	CallEntryBlocker,
	CallModality,
	PreferredDeviceLabels
} from './callEntryTypes';

export interface CallDeviceCheckState {
	/** Everything `CallDeviceCheck` shows, wired to the real devices. */
	check: CallDeviceCheckProps;
	controls: CallDeviceControls;
	cameraAvailable: boolean;
	/**
	 * The browser has answered (`useLiveCallDevices`). Before that,
	 * `cameraAvailable` is the optimistic default, not a finding.
	 */
	settled: boolean;
	blocker?: CallEntryBlocker;
	/** Ask the browser again ("Erneut prüfen"). */
	retry: () => void;
}

/**
 * The selection with the devices named by label filled in where nothing is
 * picked yet: a pick of the person's own always stays. A label not listed
 * (the device is gone) leaves the default, and so does the first listed —
 * the default the preview uses anyway, so it need not restart for it.
 */
export const selectByLabel = (
	devices: CallDevices,
	labels: PreferredDeviceLabels,
	selection: CallDeviceSelection
): CallDeviceSelection => {
	let next = selection;
	(['microphone', 'camera'] as const).forEach((kind) => {
		const label = labels[kind];
		if (!label || next[kind] !== undefined) return;
		const index = devices[kind].findIndex(
			(device) => device.label === label
		);
		if (index > 0) next = { ...next, [kind]: devices[kind][index].id };
	});
	return next;
};

/**
 * A signed-in person's device check: their own name and animal on the
 * preview, the switches and pickers applied to the real stream
 * (`useLiveCallDevices`). Mount it only while the check is shown — the
 * camera is asked for on mount and released on unmount.
 *
 * Moved out of the knock dialog's gate (#1893) so the pre-join check
 * (#2016) holds the devices the same way.
 */
export const useCallDeviceCheck = (
	modality: CallModality,
	{
		initial,
		preferredLabels,
		mediaDevices
	}: {
		initial?: CallDeviceControls;
		/**
		 * The devices an earlier check chose (`JoinMedia`), picked once the
		 * browser lists them (#2028 review).
		 */
		preferredLabels?: PreferredDeviceLabels;
		mediaDevices?: MediaDevices;
	} = {}
): CallDeviceCheckState => {
	const { userData } = useContext(UserDataContext) ?? ({} as never);
	const [controls, setControls] = useState<CallDeviceControls>(
		() =>
			initial ?? {
				micOn: true,
				cameraOn: modality === 'video',
				selection: {}
			}
	);
	const live = useLiveCallDevices(modality, controls, mediaDevices);

	// Each label is looked up once, in the first list that has its kind:
	// later lists (after a pick restarts the preview) leave the pick alone.
	const pendingLabels = useRef(preferredLabels);
	const { devices } = live;
	useEffect(() => {
		const pending = pendingLabels.current;
		if (!pending) return;
		const now: PreferredDeviceLabels = {};
		const later: PreferredDeviceLabels = {};
		(['microphone', 'camera'] as const).forEach((kind) => {
			if (!pending[kind]) return;
			if (devices[kind].length > 0) now[kind] = pending[kind];
			else later[kind] = pending[kind];
		});
		if (!now.microphone && !now.camera) return;
		pendingLabels.current = later;
		setControls((current) => {
			const selection = selectByLabel(devices, now, current.selection);
			return selection === current.selection
				? current
				: { ...current, selection };
		});
	}, [devices]);
	const name = userData?.userName ?? '';
	const avatar = useMemo(
		() => generateAvatarForUser(userData?.userId || name || 'guest'),
		[name, userData?.userId]
	);
	const cameraAvailable = !live.cameraMissing;

	return {
		check: {
			modality,
			name,
			avatar,
			devices: live.devices,
			selection: controls.selection,
			stream: live.stream,
			micLevel: live.micLevel,
			micOn: controls.micOn,
			cameraOn: controls.cameraOn,
			cameraAvailable,
			blocker: live.blocker,
			onToggleMic: () =>
				setControls((now) => ({ ...now, micOn: !now.micOn })),
			onToggleCamera: () =>
				setControls((now) => ({ ...now, cameraOn: !now.cameraOn })),
			onSelectDevice: (kind, id) =>
				setControls((now) => ({
					...now,
					selection: { ...now.selection, [kind]: id }
				}))
		},
		controls,
		cameraAvailable,
		settled: live.settled,
		blocker: live.blocker,
		retry: live.retry
	};
};
