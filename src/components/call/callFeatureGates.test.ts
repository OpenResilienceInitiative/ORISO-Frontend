import { describe, expect, it } from 'vitest';
import {
	resolveCallFeatureGates,
	resolveSupervisionCallFeatureGates
} from './callFeatureGates';

describe('resolveCallFeatureGates', () => {
	it('allows both kinds when the tenant says nothing', () => {
		expect(resolveCallFeatureGates({}, 'supervision')).toEqual({
			audio: true,
			video: true
		});
		expect(resolveCallFeatureGates({}, 'oneOnOne')).toEqual({
			audio: true,
			video: true
		});
	});

	it('honours the legacy master switch for every chat type', () => {
		expect(
			resolveCallFeatureGates(
				{ featureCallsEnabled: false },
				'supervision'
			)
		).toEqual({ audio: false, video: false });
	});

	it('reads the supervision flags for a supervision room', () => {
		expect(
			resolveCallFeatureGates(
				{ featureVideoCallsSupervisionChatsEnabled: false },
				'supervision'
			)
		).toEqual({ audio: true, video: false });
		expect(
			resolveCallFeatureGates(
				{ featureAudioCallsSupervisionChatsEnabled: false },
				'supervision'
			)
		).toEqual({ audio: false, video: true });
	});

	it('does not let another chat type’s flag leak into supervision', () => {
		expect(
			resolveCallFeatureGates(
				{
					featureAudioCallsOneOnOneChatsEnabled: false,
					featureVideoCallsGroupChatsEnabled: false
				},
				'supervision'
			)
		).toEqual({ audio: true, video: true });
	});

	it('keeps the kind-wide switches above the per-chat ones', () => {
		expect(
			resolveCallFeatureGates(
				{
					featureAudioCallsEnabled: false,
					featureAudioCallsSupervisionChatsEnabled: true
				},
				'supervision'
			).audio
		).toBe(false);
	});

	it('matches the branch SessionMenu used for every chat type', () => {
		const settings = {
			featureAudioCallsAnonymousChatsEnabled: false,
			featureVideoCallsOneOnOneChatsEnabled: false,
			featureAudioCallsGroupChatsEnabled: false,
			featureVideoCallsSupervisionChatsEnabled: false
		};
		expect(resolveCallFeatureGates(settings, 'anonymous').audio).toBe(
			false
		);
		expect(resolveCallFeatureGates(settings, 'oneOnOne').video).toBe(false);
		expect(resolveCallFeatureGates(settings, 'group').audio).toBe(false);
		expect(resolveCallFeatureGates(settings, 'supervision').video).toBe(
			false
		);
	});
});

describe('resolveSupervisionCallFeatureGates', () => {
	it('does not inherit the client-facing consulting-type call gate', () => {
		expect(
			resolveSupervisionCallFeatureGates({
				featureAudioCallsSupervisionChatsEnabled: true,
				featureVideoCallsSupervisionChatsEnabled: true
			})
		).toEqual({ audio: true, video: true });
	});

	it('still applies the dedicated supervision flags when the consulting type allows calls', () => {
		expect(
			resolveSupervisionCallFeatureGates({
				featureAudioCallsSupervisionChatsEnabled: false,
				featureVideoCallsSupervisionChatsEnabled: true
			})
		).toEqual({ audio: false, video: true });
	});
});
