import * as React from 'react';
import {
	RegistrationFooter,
	type RegistrationFooterProps
} from '../registrationFooter/RegistrationFooter';

export interface WaitingRoomBarProps
	extends Omit<RegistrationFooterProps, 'consent' | 'animateIn'> {
	/**
	 * The consent sheet (`WaitingRoomConsentPanel`). While it is set the bar
	 * is mounted anew and slides it in above the actions; without it the bar
	 * carries only the gate.
	 */
	consent?: React.ReactNode;
}

/**
 * The one switch between a waiting room's gate bar and its consent bar.
 * Live chat, registration, self-help group and call entry all use it, so
 * the remount and the slide-in cannot drift apart between rooms (#1219).
 */
export const WaitingRoomBar = ({ consent, ...bar }: WaitingRoomBarProps) =>
	consent ? (
		<RegistrationFooter
			key="consent"
			animateIn
			consent={consent}
			{...bar}
		/>
	) : (
		<RegistrationFooter key="gate" {...bar} />
	);
