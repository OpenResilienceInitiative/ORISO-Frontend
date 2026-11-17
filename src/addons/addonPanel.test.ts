// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { addonPanelSlot, parseAddonPanel, withAddonPanel } from './addonPanel';

describe('add-on panel in the URL', () => {
	it('reads add-on and app from ?addon=', () => {
		expect(parseAddonPanel('?addon=digisucht-tools/goals&x=1')).toEqual({
			addonName: 'digisucht-tools',
			appId: 'goals'
		});
		expect(parseAddonPanel('?addon=only-name')).toBeNull();
		expect(parseAddonPanel('?addon=a/b/c')).toBeNull();
		expect(
			parseAddonPanel('?addon=a/b/consultant.session-menu/d')
		).toBeNull();
		expect(parseAddonPanel('')).toBeNull();
	});

	it('keeps the slot the panel was opened from', () => {
		expect(parseAddonPanel('?addon=a/b/consultant.session-menu')).toEqual({
			addonName: 'a',
			appId: 'b',
			slot: 'consultant.session-menu'
		});
		expect(
			withAddonPanel('', {
				addonName: 'a',
				appId: 'b',
				slot: 'consultant.session-menu'
			})
		).toBe('?addon=a%2Fb%2Fconsultant.session-menu');
		const both = {
			slots: ['consultant.session', 'consultant.session-menu']
		} as const;
		expect(
			addonPanelSlot(
				{ slots: [...both.slots] },
				'consultant',
				'consultant.session-menu'
			)
		).toBe('consultant.session-menu');
		expect(
			addonPanelSlot(
				{ slots: ['consultant.session'] },
				'consultant',
				'consultant.session-menu'
			)
		).toBe('consultant.session');
		expect(
			addonPanelSlot(
				{ slots: ['asker.session-menu'] },
				'consultant',
				'asker.session-menu'
			)
		).toBeUndefined();
	});

	it('opens the add-on panel instead of another channel and keeps other parameters', () => {
		expect(
			withAddonPanel('?channel=team&tab=1', {
				addonName: 'digisucht-tools',
				appId: 'goals'
			})
		).toBe('?tab=1&addon=digisucht-tools%2Fgoals');
		expect(
			withAddonPanel('?channel=thread%3Aroot&at=e1', {
				addonName: 'a',
				appId: 'b'
			})
		).toBe('?addon=a%2Fb');
	});

	it('closes the panel', () => {
		expect(withAddonPanel('?addon=a%2Fb&tab=1', null)).toBe('?tab=1');
		expect(withAddonPanel('?addon=a%2Fb', null)).toBe('');
	});

	it('opens an app beside the chat only in a slot of the role', () => {
		expect(
			addonPanelSlot(
				{ slots: ['consultant.session', 'consultant.session-menu'] },
				'consultant'
			)
		).toBe('consultant.session');
		expect(
			addonPanelSlot({ slots: ['consultant.session-menu'] }, 'consultant')
		).toBe('consultant.session-menu');
		expect(addonPanelSlot({ slots: ['asker.session-menu'] }, 'asker')).toBe(
			'asker.session-menu'
		);
		expect(
			addonPanelSlot({ slots: ['consultant.session'] }, 'asker')
		).toBeUndefined();
		expect(
			addonPanelSlot({ slots: ['asker.session-menu'] }, 'consultant')
		).toBeUndefined();
	});
});
