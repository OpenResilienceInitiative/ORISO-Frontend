import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
	AddonApp,
	AddonRegistrationResult,
	AvailableAddon
} from './addonTypes';
import { AddonMount } from './AddonMount';
import {
	REGISTRATION_ADDON_MOUNT_TIMEOUT_MS,
	toRegistrationResult
} from './registrationAddon';
import './addons.styles';

export interface RegistrationAddonStepProps {
	addon: AvailableAddon;
	app: AddonApp;
	topicId?: number;
	postcode?: string;
	tenantId?: number;
	/** Called with a checked result; an app's call without a usable agency is ignored. */
	onComplete: (result: AddonRegistrationResult) => void;
	onBack: () => void;
	/** The app failed or did not mount in time. */
	onUnavailable?: () => void;
}

/** The registration's agency selection, done by an add-on (`registration.agency-finder`). */
export const RegistrationAddonStep = ({
	addon,
	app,
	topicId,
	postcode,
	tenantId,
	onComplete,
	onBack,
	onUnavailable
}: RegistrationAddonStepProps) => {
	const unavailable = useRef(onUnavailable);
	unavailable.current = onUnavailable;
	const mountTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => {
		mountTimer.current = setTimeout(
			() => unavailable.current?.(),
			REGISTRATION_ADDON_MOUNT_TIMEOUT_MS
		);
		return () => clearTimeout(mountTimer.current);
	}, []);
	const mounted = useCallback(() => clearTimeout(mountTimer.current), []);
	const failed = useCallback(() => {
		clearTimeout(mountTimer.current);
		unavailable.current?.();
	}, []);
	const placement = useMemo(() => ({ tenantId }), [tenantId]);
	const complete = useCallback(
		(result: AddonRegistrationResult) => {
			const checked = toRegistrationResult(result);
			if (checked) {
				onComplete(checked);
			} else {
				console.error(
					`Add-on ${addon.name}/${app.id} completed without an agency`
				);
			}
		},
		[addon.name, app.id, onComplete]
	);
	const registration = useMemo(
		() => ({ topicId, postcode, complete, back: onBack }),
		[topicId, postcode, complete, onBack]
	);
	return (
		// The step sits inside the registration's form: an add-on form's submit must not submit that one too.
		<div
			className="addonRegistration"
			data-cy="registration-addon-step"
			onSubmit={(event) => event.stopPropagation()}
		>
			<AddonMount
				addon={addon}
				app={app}
				slot="registration.agency-finder"
				placement={placement}
				registration={registration}
				onMounted={mounted}
				onFailure={failed}
			/>
		</div>
	);
};
