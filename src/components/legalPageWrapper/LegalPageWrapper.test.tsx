// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalPageWrapper } from './LegalPageWrapper';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'en' }
	})
}));

// Stage pulls svgr logo imports that the unit-test pipeline cannot transform.
vi.mock('../stage/stage', () => ({
	Stage: () => null
}));

vi.mock('./legalPageWrapper.styles.scss', () => ({}));
vi.mock('../legalContent/legalContent.styles.scss', () => ({}));

const PLACEHOLDER_NOTICE =
	'Hinweis: Dieser Text ist ein Platzhalter und noch nicht rechtsverbindlich gepflegt.';
const MT_NOTICE =
	'Maschinell übersetzt — rechtlich verbindlich ist die deutsche Fassung.';

describe('LegalPageWrapper', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders a server-resolved string unchanged with no notices (old backend, graceful degradation)', () => {
		render(<LegalPageWrapper content="<p>Impressum der Trägerin</p>" />);

		expect(screen.getByText('Impressum der Trägerin')).toBeDefined();
		expect(screen.queryByText(MT_NOTICE)).toBeNull();
		expect(screen.queryByText(PLACEHOLDER_NOTICE)).toBeNull();
	});

	it('prefers the raw language map and shows the machine-translation notice (new backend)', () => {
		// Object shape exactly as delivered by the TenantService contract
		// (content.impressumLanguages / content.privacyLanguages): the raw
		// stored map incl. `<lang>__meta` keys with JSON string values.
		const rawContent = {
			de: '<p>Deutsche Fassung</p>',
			en: '<p>English machine translation</p>',
			en__meta: JSON.stringify({
				mt: true,
				src: 'de',
				at: '2026-07-04T10:00:00Z'
			})
		};

		render(
			<LegalPageWrapper
				content="<p>Server resolved without meta</p>"
				rawContent={rawContent}
			/>
		);

		// UI language is en -> the machine-translated text plus the notice
		expect(screen.getByText('English machine translation')).toBeDefined();
		expect(screen.getByText(MT_NOTICE)).toBeDefined();
		expect(screen.queryByText('Server resolved without meta')).toBeNull();
		expect(screen.queryByText(PLACEHOLDER_NOTICE)).toBeNull();
	});

	it('shows the original-language fallback notice when the UI language is missing in the map', () => {
		render(
			<LegalPageWrapper
				rawContent={{ de: '<p>Nur Deutsch vorhanden</p>' }}
			/>
		);

		expect(screen.getByText('Nur Deutsch vorhanden')).toBeDefined();
		expect(
			screen.getByText(
				'Dieser Text liegt nicht in Ihrer Sprache vor und wird in seiner Originalsprache angezeigt.'
			)
		).toBeDefined();
	});

	it('falls back to the resolved string when the raw map has no renderable content', () => {
		render(
			<LegalPageWrapper
				content="<p>Alte Server-Auflösung</p>"
				rawContent={{ de: '', en: '   ' }}
			/>
		);

		expect(screen.getByText('Alte Server-Auflösung')).toBeDefined();
		expect(screen.queryByText(PLACEHOLDER_NOTICE)).toBeNull();
	});

	it('falls back to the resolved string when the raw map is empty (tenant without stored content)', () => {
		render(
			<LegalPageWrapper
				content="<p>Alte Server-Auflösung</p>"
				rawContent={{}}
			/>
		);

		expect(screen.getByText('Alte Server-Auflösung')).toBeDefined();
		expect(screen.queryByText(PLACEHOLDER_NOTICE)).toBeNull();
	});

	it('shows the placeholder warning when the tenant legal text is absent', () => {
		render(<LegalPageWrapper />);

		expect(screen.getByText(PLACEHOLDER_NOTICE)).toBeDefined();
	});

	it('does not flash the placeholder warning while the tenant data is still loading', () => {
		render(<LegalPageWrapper loading />);

		expect(screen.queryByText(PLACEHOLDER_NOTICE)).toBeNull();
	});

	it('shows the placeholder warning when the tenant legal text is empty', () => {
		render(<LegalPageWrapper content="   " rawContent={undefined} />);

		expect(screen.getByText(PLACEHOLDER_NOTICE)).toBeDefined();
	});

	it('shows the placeholder warning when raw map and resolved string are both empty', () => {
		render(<LegalPageWrapper content="" rawContent={{ de: '' }} />);

		expect(screen.getByText(PLACEHOLDER_NOTICE)).toBeDefined();
	});
});
