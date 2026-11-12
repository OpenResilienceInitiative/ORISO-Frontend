// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseAddonPanel, withAddonPanel } from './addonPanel';

describe('add-on panel in the URL', () => {
	it('reads add-on and app from ?addon=', () => {
		expect(parseAddonPanel('?addon=digisucht-tools/goals&x=1')).toEqual({
			addonName: 'digisucht-tools',
			appId: 'goals'
		});
		expect(parseAddonPanel('?addon=only-name')).toBeNull();
		expect(parseAddonPanel('?addon=a/b/c')).toBeNull();
		expect(parseAddonPanel('')).toBeNull();
	});

	it('opens the add-on panel instead of another channel and keeps other parameters', () => {
		expect(
			withAddonPanel('?channel=team&tab=1', {
				addonName: 'digisucht-tools',
				appId: 'goals'
			})
		).toBe('?tab=1&addon=digisucht-tools%2Fgoals');
	});

	it('closes the panel', () => {
		expect(withAddonPanel('?addon=a%2Fb&tab=1', null)).toBe('?tab=1');
		expect(withAddonPanel('?addon=a%2Fb', null)).toBe('');
	});
});
