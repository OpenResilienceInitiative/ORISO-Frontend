// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposerToolbar } from './ComposerToolbar';
import de from '../../../resources/i18n/de/common.json';
import en from '../../../resources/i18n/en/common.json';

afterEach(() => cleanup());

/** Resolves a dotted key against a locale bundle, the way i18next does. */
const lookup = (bundle: unknown, key: string): string | undefined => {
	const value = key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === 'object'
					? (node as Record<string, unknown>)[part]
					: undefined,
			bundle
		);
	return typeof value === 'string' ? value : undefined;
};

const fallbackTranslate = (key: string) => lookup(en, key) ?? key;
const germanTranslate = (key: string) => lookup(de, key) ?? key;

const renderToolbar = ({
	translate = fallbackTranslate,
	onAction = vi.fn(),
	isActionSelected = () => false
}: {
	translate?: (key: string) => string;
	onAction?: (action: string) => void;
	isActionSelected?: (action: string) => boolean;
} = {}) => {
	render(
		<ComposerToolbar
			direction="up"
			isMobile={false}
			isExpanded={false}
			onAction={onAction}
			isActionSelected={isActionSelected}
			onCollapse={vi.fn()}
			onExpandToggle={vi.fn()}
			translate={translate as never}
		/>
	);
	return { onAction };
};

const openTextStyleMenu = (buttonName: string) =>
	fireEvent.click(screen.getByRole('button', { name: buttonName }));

const ENGLISH_ORDER = [
	'Normal text',
	'Title',
	'Large heading',
	'Medium heading',
	'Small heading'
];

const GERMAN_ORDER = [
	'Normaler Text',
	'Titel',
	'Große Überschrift',
	'Mittlere Überschrift',
	'Kleine Überschrift'
];

/** The five entries in DOM order, by accessible name (glyphs are aria-hidden). */
const textStyleEntryNames = (expected: string[]) => {
	const items = screen.getAllByRole('menuitemradio');
	const byName = expected.map((name) =>
		screen.getByRole('menuitemradio', { name })
	);
	return { items, byName };
};

describe('ComposerToolbar text-style menu (#995)', () => {
	it('offers a normal-text entry ahead of the four heading levels', () => {
		renderToolbar();
		openTextStyleMenu('Text style');

		const { items, byName } = textStyleEntryNames(ENGLISH_ORDER);
		expect(items).toHaveLength(ENGLISH_ORDER.length);
		expect(items).toEqual(byName);
	});

	it('turns a heading back into body text via the paragraph action', () => {
		const { onAction } = renderToolbar();
		openTextStyleMenu('Text style');
		fireEvent.click(
			screen.getByRole('menuitemradio', { name: 'Normal text' })
		);

		expect(onAction).toHaveBeenCalledWith('paragraph');
	});

	it('announces which style the caret is currently in', () => {
		renderToolbar({ isActionSelected: (action) => action === 'heading2' });
		openTextStyleMenu('Text style');

		expect(
			screen
				.getByRole('menuitemradio', { name: 'Large heading' })
				.getAttribute('aria-checked')
		).toBe('true');
		expect(
			screen
				.getByRole('menuitemradio', { name: 'Normal text' })
				.getAttribute('aria-checked')
		).toBe('false');
	});

	it('reads in German from the shipped de bundle, not an English fallback', () => {
		renderToolbar({ translate: germanTranslate });
		openTextStyleMenu('Textstil');

		const { items, byName } = textStyleEntryNames(GERMAN_ORDER);
		expect(items).toHaveLength(GERMAN_ORDER.length);
		expect(items).toEqual(byName);
	});

	it('has a German string for every toolbar key the component asks for', () => {
		const missing: string[] = [];
		renderToolbar({
			translate: (key) => {
				const translated = lookup(de, key);
				if (translated === undefined) {
					missing.push(key);
				}
				return translated ?? key;
			}
		});
		openTextStyleMenu('Textstil');

		expect(missing).toEqual([]);
	});
});
