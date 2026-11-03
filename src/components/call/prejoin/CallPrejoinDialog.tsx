import * as React from 'react';
import { useState } from 'react';
import { KnockWaitDialog } from '../../knockWaitDialog/KnockWaitDialog';
import { useCallDeviceCheck } from '../../waitingRoom/callEntry/useCallDeviceCheck';
import type { CallModality } from '../../waitingRoom/callEntry/callEntryTypes';
import {
	initialControlsFor,
	joinMediaFrom,
	peekJoinMedia,
	rememberJoinMedia
} from './callPrejoin';

export interface CallPrejoinDialogProps {
	modality: CallModality;
	/** The room whose call takes the choice (`GroupCallWidget`). */
	roomRef: string;
	/** `join`: right before the call. `check`: the circle's option. */
	purpose?: 'join' | 'check';
	/**
	 * "Jetzt beitreten" / "Fertig": the choice is kept for the room's call.
	 * The caller closes the dialog — that releases the preview's camera —
	 * and joins.
	 */
	onDone: () => void;
	/** ✕ or Escape: nothing is kept. */
	onClose: () => void;
	/** Stories: stands in for `navigator.mediaDevices`. */
	mediaDevices?: MediaDevices;
	sheet?: boolean;
}

/**
 * Glue only (#2016): the knock wait dialog in its `ready` phase holding the
 * waiting room's device check, for a signed-in person. Mounted only while
 * shown, so the camera is asked for when it opens and released when it
 * closes.
 */
export const CallPrejoinDialog = ({
	modality,
	roomRef,
	purpose = 'join',
	onDone,
	onClose,
	mediaDevices,
	sheet
}: CallPrejoinDialogProps) => {
	const [initial] = useState(() =>
		initialControlsFor(modality, peekJoinMedia(roomRef))
	);
	const device = useCallDeviceCheck(modality, { initial, mediaDevices });
	const done = () => {
		rememberJoinMedia(
			roomRef,
			joinMediaFrom({
				modality,
				micOn: device.controls.micOn,
				cameraOn: device.controls.cameraOn,
				cameraAvailable: device.cameraAvailable,
				blocker: device.blocker
			})
		);
		onDone();
	};
	return (
		<KnockWaitDialog
			variant="call"
			phase="ready"
			purpose={purpose}
			media={device.check}
			onJoin={done}
			onRetry={device.retry}
			onCancel={onClose}
			onClose={onClose}
			onKnockAgain={onClose}
			sheet={sheet}
		/>
	);
};
