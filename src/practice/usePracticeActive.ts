import { useSyncExternalStore } from 'react';
import { getPracticeSnapshot, subscribePractice } from './practiceMode';

/**
 * Whether practice mode is on, for the real components that must hide a
 * control while practising (calls, voice, attachments). Reads the module
 * store, not `PracticeContext`: outside a provider `usePractice()` says "not
 * practising", and a guard that fails open when the provider sits lower than
 * the component is no guard.
 */
export const usePracticeActive = (): boolean =>
	useSyncExternalStore(
		subscribePractice,
		() => getPracticeSnapshot().status === 'active',
		() => false
	);
