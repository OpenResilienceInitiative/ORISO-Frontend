import { useContext, useMemo, useState } from 'react';
import { UserDataContext } from '../../../globalState';
import { generateAvatarForUser } from '../../../utils/pseudonymGenerator';
import { useLiveCallDevices } from './useLiveCallDevices';
import type { CallDeviceCheckProps } from './CallDeviceCheck';
import type {
	CallDeviceControls,
	CallEntryBlocker,
	CallModality
} from './callEntryTypes';

export interface CallDeviceCheckState {
	/** Everything `CallDeviceCheck` shows, wired to the real devices. */
	check: CallDeviceCheckProps;
	controls: CallDeviceControls;
	cameraAvailable: boolean;
	blocker?: CallEntryBlocker;
	/** Ask the browser again ("Erneut prüfen"). */
	retry: () => void;
}

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
		mediaDevices
	}: { initial?: CallDeviceControls; mediaDevices?: MediaDevices } = {}
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
		blocker: live.blocker,
		retry: live.retry
	};
};
