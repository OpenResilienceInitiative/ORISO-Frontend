// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import {
	applyTenantTitle,
	restoreDefaultTitle,
	showSectionTitle
} from './tabTitle';

describe('section tab title', () => {
	beforeEach(() => {
		document.head.innerHTML = '<title>caritas-berlin</title>';
	});

	it('shows only the section name and restores the tenant title', () => {
		showSectionTitle('Kalender');
		expect(document.title).toBe('Kalender');
		showSectionTitle('Mein Profil');
		expect(document.title).toBe('Mein Profil');
		restoreDefaultTitle();
		expect(document.title).toBe('caritas-berlin');
	});

	it('keeps the section name when the tenant title arrives late', () => {
		showSectionTitle('Kalender');
		applyTenantTitle('Caritas Berlin');
		expect(document.title).toBe('Kalender');
		restoreDefaultTitle();
		expect(document.title).toBe('Caritas Berlin');
	});

	it('sets the tenant title directly when no section title shows', () => {
		applyTenantTitle('Caritas Berlin');
		expect(document.title).toBe('Caritas Berlin');
	});

	it('is a no-op to restore when no section title was shown', () => {
		restoreDefaultTitle();
		expect(document.title).toBe('caritas-berlin');
	});
});
