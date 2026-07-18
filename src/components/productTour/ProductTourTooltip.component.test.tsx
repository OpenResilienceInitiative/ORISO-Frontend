// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductTourTooltip } from './ProductTourTooltip';

const translations: Record<string, string> = {
	't.title': 'Erstanfragen',
	't.content': 'Hier finden Sie <br /> eine Übersicht.',
	'walkthrough.step.next': 'Weiter',
	'walkthrough.step.prev': 'Zurück',
	'walkthrough.step.done': 'Fertig',
	'walkthrough.step.step': 'Schritt',
	'walkthrough.step.of': 'von',
	'walkthrough.close': 'Rundgang schließen'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => translations[key] ?? key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

// The Button import chain reaches lottie through the Overlay barrel, which
// crashes in jsdom; stub the animation player.
vi.mock('lottie-react', () => ({ default: () => null }));

// vitest has no svgr transform for ReactComponent svg imports.
vi.mock('../../resources/img/icons/x.svg', () => ({
	ReactComponent: (props: any) => <svg {...props} />
}));

const baseProps = (over: Record<string, any> = {}) => ({
	index: 1,
	size: 5,
	isLastStep: false,
	continuous: true,
	step: {
		title: 't.title',
		content: 't.content'
	},
	backProps: { 'onClick': vi.fn(), 'aria-label': 'back' },
	closeProps: { 'onClick': vi.fn(), 'aria-label': 'close' },
	primaryProps: { 'onClick': vi.fn(), 'aria-label': 'primary' },
	skipProps: { 'onClick': vi.fn(), 'aria-label': 'skip' },
	tooltipProps: { 'aria-modal': true },
	controls: {
		next: vi.fn(),
		prev: vi.fn(),
		skip: vi.fn(),
		close: vi.fn()
	},
	...over
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('ProductTourTooltip', () => {
	it('renders the translated title and html content as a dialog', () => {
		render(<ProductTourTooltip {...(baseProps() as any)} />);

		expect(screen.getByRole('alertdialog')).toBeTruthy();
		expect(screen.getByText('Erstanfragen')).toBeTruthy();
		expect(
			screen.getByText(/eine Übersicht/, { exact: false })
		).toBeTruthy();
	});

	it('shows step progress and bullet indicators', () => {
		render(<ProductTourTooltip {...(baseProps() as any)} />);

		expect(screen.getByText('Schritt 2 von 5')).toBeTruthy();
		expect(
			screen
				.getByRole('alertdialog')
				.querySelectorAll('.productTourTooltip__bullet')
		).toHaveLength(5);
	});

	it('hides the back button on the first step', () => {
		render(<ProductTourTooltip {...(baseProps({ index: 0 }) as any)} />);

		expect(screen.queryByText('Zurück')).toBeNull();
		expect(screen.getByText('Weiter')).toBeTruthy();
	});

	it('wires next, back and close to the joyride tour controls', () => {
		const props = baseProps();
		render(<ProductTourTooltip {...(props as any)} />);

		fireEvent.click(screen.getByText('Weiter'));
		fireEvent.click(screen.getByText('Zurück'));
		fireEvent.click(screen.getByLabelText('Rundgang schließen'));

		expect(props.controls.next).toHaveBeenCalled();
		expect(props.controls.prev).toHaveBeenCalled();
		expect(props.controls.skip).toHaveBeenCalled();
	});

	it('labels the final step with the done label', () => {
		render(
			<ProductTourTooltip
				{...(baseProps({ index: 4, isLastStep: true }) as any)}
			/>
		);

		expect(screen.getByText('Fertig')).toBeTruthy();
		expect(screen.queryByText('Weiter')).toBeNull();
	});
});
