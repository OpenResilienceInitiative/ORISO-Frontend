import type { TourWhen } from '../types';

/**
 * FE#2545: the Supervision topic tour runs only as a practice flow
 * (`practiceSupervisionTour`); there is no watch-only explanation. It keeps
 * the id of the old practice card "Übung: Supervisor hinzufügen" (already on
 * the UserService progress allowlist and the practice guard list). Version 2
 * (PO, 25 Nov): it shows as new for everyone, including counsellors who
 * completed the old card.
 */
export const SUPERVISION_TOUR_ID = 'consultant-practice-supervision';
export const SUPERVISION_TOUR_VERSION = 2;

/**
 * "A supervision chat allows a call", exactly as
 * `resolveSupervisionCallFeatureGates` decides it: the master switch, then
 * video (switch plus supervision switch) or audio (the same). The one-on-one
 * keys play no part.
 */
export const SUPERVISION_CALLS_ALLOWED: TourWhen = {
	anyOf: [
		[
			{ flag: 'featureCallsEnabled' },
			{ flag: 'featureVideoCallsEnabled' },
			{ flag: 'featureVideoCallsSupervisionChatsEnabled' }
		],
		[
			{ flag: 'featureCallsEnabled' },
			{ flag: 'featureAudioCallsEnabled' },
			{ flag: 'featureAudioCallsSupervisionChatsEnabled' }
		]
	]
};

export const SUPERVISION_ON = { flag: 'featureSupervisionEnabled' };
