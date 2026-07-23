import { describe, expect, it } from 'vitest';
import {
	hasMediaInlineDisplayFeature,
	hasMediaUploadFeature
} from './mediaUploadHelpers';

describe('hasMediaUploadFeature', () => {
	it('defaults to enabled when settings are missing or empty', () => {
		expect(hasMediaUploadFeature(undefined, 'oneOnOne')).toBe(true);
		expect(hasMediaUploadFeature({}, 'anonymous')).toBe(true);
		expect(hasMediaUploadFeature({}, 'group')).toBe(true);
		expect(hasMediaUploadFeature({}, 'supervision')).toBe(true);
	});

	it('disables every chat type when the family master is off', () => {
		const settings = { featureMediaUploadEnabled: false };
		expect(hasMediaUploadFeature(settings, 'oneOnOne')).toBe(false);
		expect(hasMediaUploadFeature(settings, 'anonymous')).toBe(false);
		expect(hasMediaUploadFeature(settings, 'group')).toBe(false);
		expect(hasMediaUploadFeature(settings, 'supervision')).toBe(false);
	});

	it('disables only the chat type whose variant is off', () => {
		const settings = { featureMediaUploadAnonymousChatsEnabled: false };
		expect(hasMediaUploadFeature(settings, 'anonymous')).toBe(false);
		expect(hasMediaUploadFeature(settings, 'oneOnOne')).toBe(true);
		expect(hasMediaUploadFeature(settings, 'group')).toBe(true);
		expect(hasMediaUploadFeature(settings, 'supervision')).toBe(true);
	});

	it('maps each chat type to its own variant', () => {
		expect(
			hasMediaUploadFeature(
				{ featureMediaUploadGroupChatsEnabled: false },
				'group'
			)
		).toBe(false);
		expect(
			hasMediaUploadFeature(
				{ featureMediaUploadSupervisionChatsEnabled: false },
				'supervision'
			)
		).toBe(false);
		expect(
			hasMediaUploadFeature(
				{ featureMediaUploadOneOnOneChatsEnabled: false },
				'oneOnOne'
			)
		).toBe(false);
	});
});

describe('hasMediaInlineDisplayFeature', () => {
	it('defaults to enabled when settings are missing or empty', () => {
		expect(hasMediaInlineDisplayFeature(undefined, 'oneOnOne')).toBe(true);
		expect(hasMediaInlineDisplayFeature({}, 'anonymous')).toBe(true);
	});

	it('disables every chat type when the family master is off', () => {
		const settings = { featureMediaInlineDisplayEnabled: false };
		expect(hasMediaInlineDisplayFeature(settings, 'oneOnOne')).toBe(false);
		expect(hasMediaInlineDisplayFeature(settings, 'anonymous')).toBe(false);
		expect(hasMediaInlineDisplayFeature(settings, 'group')).toBe(false);
		expect(hasMediaInlineDisplayFeature(settings, 'supervision')).toBe(
			false
		);
	});

	it('disables only the chat type whose variant is off', () => {
		const settings = {
			featureMediaInlineDisplayAnonymousChatsEnabled: false
		};
		expect(hasMediaInlineDisplayFeature(settings, 'anonymous')).toBe(false);
		expect(hasMediaInlineDisplayFeature(settings, 'group')).toBe(true);
	});
});
