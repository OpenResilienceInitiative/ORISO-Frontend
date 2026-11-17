import * as React from 'react';
import { useCallback, useMemo } from 'react';
import {
	AddonApp,
	AddonRegistrationResult,
	AvailableAddon
} from './addonTypes';
import { AddonMount } from './AddonMount';
import { toRegistrationResult } from './registrationAddon';
import './addons.styles';

export interface RegistrationAddonStepProps {
	addon: AvailableAddon;
	app: AddonApp;
	topicId?: number;
	postcode?: string;
	/** Called with a checked result; an app's call without a usable agency is ignored. */
	onComplete: (result: AddonRegistrationResult) => void;
	onBack: () => void;
}

/** The registration's agency selection, done by an add-on (`registration.agency-finder`). */
export const RegistrationAddonStep = ({
	addon,
	app,
	topicId,
	postcode,
	onComplete,
	onBack
}: RegistrationAddonStepProps) => {
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
				registration={registration}
			/>
		</div>
	);
};
