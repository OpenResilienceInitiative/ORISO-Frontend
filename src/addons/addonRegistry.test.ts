// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { appsInSlot, appTitle, findAddonApp } from './addonRegistry';
import { addonAppPath, addonNavigationItems } from './addonNavigation';
import { AvailableAddon } from './addonTypes';

const tools: AvailableAddon = {
	name: 'digisucht-tools',
	version: '1.0.0',
	entry: '/service/addons/digisucht-tools/ui/entry.js',
	apiBase: '/service/addons/digisucht-tools/api',
	apps: [
		{
			id: 'goals',
			title: { de: 'Ziele', en: 'Goals' },
			slots: ['asker.navigation', 'consultant.asker-profile']
		},
		{
			id: 'overview',
			title: { de: 'Übersicht' },
			slots: ['consultant.navigation']
		}
	]
};

describe('add-on registry helpers', () => {
	it('lists the apps of a slot', () => {
		expect(
			appsInSlot([tools], 'asker.navigation').map(({ app }) => app.id)
		).toEqual(['goals']);
		expect(appsInSlot([tools], 'consultant.session')).toEqual([]);
	});

	it('finds an app by add-on name and id', () => {
		expect(
			findAddonApp([tools], 'digisucht-tools', 'overview')?.app.id
		).toBe('overview');
		expect(
			findAddonApp([tools], 'digisucht-tools', 'missing')
		).toBeUndefined();
		expect(findAddonApp([tools], 'other', 'goals')).toBeUndefined();
	});

	it('picks the title in the user language, then German', () => {
		const goals = tools.apps[0];
		expect(appTitle(goals, 'en')).toBe('Goals');
		expect(appTitle(goals, 'de@informal')).toBe('Ziele');
		expect(appTitle(goals, 'fr')).toBe('Ziele');
		expect(appTitle({ id: 'x', title: {}, slots: [] }, 'de')).toBe('x');
	});

	it('turns navigation apps into navigation entries with their own title', () => {
		const [item] = addonNavigationItems(
			[tools],
			'consultant.navigation',
			'de'
		);
		expect(item.to).toBe(addonAppPath('digisucht-tools', 'overview'));
		expect(item.to).toBe('/addons/digisucht-tools/overview');
		expect(item.title).toBe('Übersicht');
		expect(item.navSlot).toBe('row');
	});
});
