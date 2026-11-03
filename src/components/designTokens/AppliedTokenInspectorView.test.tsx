// @vitest-environment oriso-jsdom
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import type { AppliedTokenInspection } from './appliedTokenInspector';

afterEach(cleanup);

// Synthetic measurements test the visible consumer, not palette correctness.
// Real-provider computed-style evidence remains a separate browser contract.
const matching: AppliedTokenInspection = {
	id: 'system.info.fill',
	kind: 'colour',
	token: '--m3-secondary',
	property: 'fill',
	selector: '.systemMessage__icon path',
	targetIndex: 0,
	expected: 'rgb(77, 86, 96)',
	calculated: 'rgb(77, 86, 96)',
	applied: 'rgb(77, 86, 96)',
	elementFound: true,
	status: 'match',
	issues: [],
	source: {
		path: 'src/components/message/message.styles.scss',
		rule: '.systemMessage__icon *',
		declaration: 'fill: var(--m3-secondary, $form-primary)'
	},
	raw: {
		expected: '#4d5660',
		calculated: '#4d5660',
		applied: 'rgb(77, 86, 96)',
		rootToken: '#4d5660'
	}
};
const mismatch: AppliedTokenInspection = {
	...matching,
	applied: 'rgb(1, 2, 3)',
	status: 'mismatch',
	issues: ['applied-mismatch'],
	raw: { ...matching.raw, applied: 'rgb(1, 2, 3)' }
};

const renderInspector = async (
	rows: readonly AppliedTokenInspection[],
	onRefresh = vi.fn()
) => {
	// Defer absent-module resolution until each case executes, including jsdom.
	const viewModule = './AppliedTokenInspectorView.tsx';
	const { AppliedTokenInspector } = await import(viewModule);
	const i18n = createInstance();
	await i18n.init({
		lng: 'en',
		fallbackLng: 'en',
		defaultNS: 'common',
		ns: ['common'],
		resources: { de: { common: de }, en: { common: en } },
		interpolation: { escapeValue: false },
		react: { useSuspense: false }
	});
	const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
	const tree = (observations: readonly AppliedTokenInspection[]) => (
		<I18nextProvider i18n={i18n}>
			<form onSubmit={onSubmit}>
				<AppliedTokenInspector
					rows={observations}
					onRefresh={onRefresh}
				/>
			</form>
		</I18nextProvider>
	);
	const view = render(tree(rows));
	return {
		i18n,
		onRefresh,
		onSubmit,
		rerenderRows: (next: readonly AppliedTokenInspection[]) =>
			view.rerender(tree(next))
	};
};

describe('visible applied-token inspection', () => {
	it('shows separate expected, inherited and applied values with declared source in a labelled table', async () => {
		await renderInspector([mismatch]);
		const table = within(
			screen.getByRole('table', { name: 'Applied token measurements' })
		);
		for (const name of [
			'Expected (engine)',
			'Calculated (inherited token)',
			'Applied (component)',
			'Result',
			'Declared source'
		])
			expect(table.getByRole('columnheader', { name })).toBeVisible();
		const row = within(table.getAllByRole('row')[1]);
		expect(row.getAllByText('rgb(77, 86, 96)')).toHaveLength(2);
		expect(row.getByText('rgb(1, 2, 3)')).toBeVisible();
		expect(row.getByText(matching.token)).toBeVisible();
		expect(row.getByText(matching.property, { exact: true })).toBeVisible();
		expect(row.getByText(matching.source.path)).toBeVisible();
		expect(row.getByText(matching.source.rule)).toBeVisible();
		expect(row.getByText(matching.source.declaration)).toBeVisible();
	});

	it.each([
		{ row: matching, label: 'Match', reason: null },
		{
			row: mismatch,
			label: 'Mismatch',
			reason: 'Applied value differs from the engine.'
		},
		{
			row: {
				...matching,
				elementFound: false,
				targetIndex: null,
				applied: null,
				calculated: null,
				status: 'missing' as const,
				issues: ['missing-element'],
				raw: { ...matching.raw, calculated: null, applied: null }
			},
			label: 'Missing',
			reason: 'Target element was not found.'
		},
		{
			row: {
				...matching,
				expected: null,
				status: 'unresolved' as const,
				issues: ['missing-expected'],
				raw: { ...matching.raw, expected: null }
			},
			label: 'Unresolved',
			reason: 'No independent expected value is available.'
		}
	])(
		'names $label and its reason in visible text',
		async ({ row, label, reason }) => {
			await renderInspector([row]);
			const measured = within(screen.getAllByRole('row')[1]);
			expect(measured.getByText(label, { exact: true })).toBeVisible();
			if (reason) expect(measured.getByText(reason)).toBeVisible();
			if (row.expected === null || row.applied === null)
				expect(
					measured.getAllByText('Unavailable').length
				).toBeGreaterThan(0);
			if (label !== 'Match')
				expect(
					measured.queryByText('Match', { exact: true })
				).not.toBeInTheDocument();
		}
	);

	it('keeps both matching targets visible with their distinct indices and measurements', async () => {
		await renderInspector([matching, { ...mismatch, targetIndex: 1 }]);
		const table = within(
			screen.getByRole('table', { name: 'Applied token measurements' })
		);
		expect(table.getAllByRole('row')).toHaveLength(3);
		const first = table
			.getByRole('rowheader', { name: 'system.info.fill [0]' })
			.closest('tr');
		const second = table
			.getByRole('rowheader', { name: 'system.info.fill [1]' })
			.closest('tr');
		expect(within(first).getByText('Match', { exact: true })).toBeVisible();
		expect(within(second).getByText('rgb(1, 2, 3)')).toBeVisible();
		expect(
			within(second).getByText('Mismatch', { exact: true })
		).toBeVisible();
	});

	it('replaces a stale mismatch when refreshed observations restore the match', async () => {
		const view = await renderInspector([mismatch]);
		expect(screen.getByText('Mismatch', { exact: true })).toBeVisible();
		view.rerenderRows([matching]);
		expect(
			screen.queryByText('Mismatch', { exact: true })
		).not.toBeInTheDocument();
		expect(screen.queryByText('rgb(1, 2, 3)')).not.toBeInTheDocument();
		expect(screen.getByText('Match', { exact: true })).toBeVisible();
	});

	it('refreshes by keyboard without submitting a containing form', async () => {
		const view = await renderInspector([matching]);
		const user = userEvent.setup();
		await user.tab();
		expect(
			screen.getByRole('button', { name: 'Refresh inspection' })
		).toHaveFocus();
		await user.keyboard('{Enter}');
		await user.keyboard(' ');
		expect(view.onRefresh).toHaveBeenCalledTimes(2);
		expect(view.onSubmit).not.toHaveBeenCalled();
	});

	it('updates accessible labels and result text when the actual i18n locale changes', async () => {
		const view = await renderInspector([mismatch]);
		expect(
			screen.getByRole('heading', { name: 'Applied design tokens' })
		).toBeVisible();
		await act(async () => {
			await view.i18n.changeLanguage('de');
		});
		expect(
			screen.getByRole('heading', { name: 'Angewendete Design-Tokens' })
		).toBeVisible();
		expect(
			screen.getByRole('button', { name: 'Prüfung aktualisieren' })
		).toBeVisible();
		expect(
			screen.getByRole('table', { name: 'Gemessene Design-Tokens' })
		).toBeVisible();
		expect(screen.getByText('Abweichung', { exact: true })).toBeVisible();
		expect(
			screen.queryByText('Mismatch', { exact: true })
		).not.toBeInTheDocument();
	});

	it('does not present an empty observation list as a passing inspection', async () => {
		await renderInspector([]);
		expect(screen.getByText('No measurements yet.')).toBeVisible();
		expect(
			screen.queryByText('Match', { exact: true })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: 'Refresh inspection' })
		).toBeEnabled();
	});
});
