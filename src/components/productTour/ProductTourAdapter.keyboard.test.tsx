// @vitest-environment jsdom
/** Real Joyride and tooltip: keyboard actions must reach the app controls. */
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductTourAdapter } from './ProductTourAdapter';
import { ProductTourTooltip } from './ProductTourTooltip';
import { emitTourEvent } from './tourEvents';
import type { TourDefinition, TourStep } from './types';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));

beforeEach(() => {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		x: 100,
		y: 100,
		left: 100,
		top: 100,
		right: 280,
		bottom: 140,
		width: 180,
		height: 40,
		toJSON: () => ({})
	});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
});
afterEach(async () => {
	cleanup();
	await act(async () => {});
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const renderTour = (step: TourStep, controls: React.ReactNode) => {
	const onTerminalStatus = vi.fn();
	const tour: TourDefinition = {
		id: 'keyboard-tour',
		version: 1,
		surface: 'frontend',
		audiences: ['consultant'],
		titleKey: 'tour.title',
		summaryKey: 'tour.summary',
		steps: [step]
	};
	render(
		<MemoryRouter>
			{controls}
			<ProductTourAdapter
				tour={tour}
				active
				tooltipComponent={ProductTourTooltip}
				onTerminalStatus={onTerminalStatus}
			/>
		</MemoryRouter>
	);
	return { onTerminalStatus };
};
const step: TourStep = {
	id: 'action',
	target: 'action',
	titleKey: 'tour.title',
	contentKey: 'tour.content'
};

describe('ProductTourAdapter with real Joyride keyboard behavior', () => {
	it('lets Tab leave an action tooltip and Enter activate the actual target', async () => {
		const onAction = vi.fn(() => emitTourEvent('keyboard-action'));
		const { onTerminalStatus } = renderTour(
			{ ...step, advanceOn: { type: 'event', name: 'keyboard-action' } },
			<button data-tour-target="action" onClick={onAction}>
				Add supervisor
			</button>
		);
		const tooltip = await screen.findByRole('alertdialog');
		expect(tooltip.getAttribute('aria-modal')).not.toBe('true');
		const target = screen.getByRole('button', { name: 'Add supervisor' });
		await waitFor(() => expect(document.activeElement).toBe(target));
		act(() =>
			screen.getByRole('button', { name: 'walkthrough.close' }).focus()
		);
		await userEvent.tab();
		expect(document.activeElement).not.toBe(
			screen.getByRole('button', { name: 'walkthrough.close' })
		);
		// At the document's last control, native Tab first wraps to body.
		if (document.activeElement === document.body) await userEvent.tab();
		expect(document.activeElement).toBe(target);
		await userEvent.keyboard('{Enter}');
		expect(onAction).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(onTerminalStatus).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'completed' })
			)
		);
	});

	it('focuses an operable descendant of a click-step anchor and advances on Enter', async () => {
		const onAction = vi.fn();
		const { onTerminalStatus } = renderTour(
			{ ...step, advanceOn: { type: 'click' } },
			<div data-tour-target="action">
				<button onClick={onAction}>Open enquiry</button>
			</div>
		);
		await screen.findByRole('alertdialog');
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'Open enquiry' })
			)
		);
		await userEvent.keyboard('{Enter}');
		expect(onAction).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(onTerminalStatus).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'completed' })
			)
		);
	});

	it('focuses the editable composer rather than its toolbar or anchor wrapper', async () => {
		const { onTerminalStatus } = renderTour(
			{ ...step, advanceOn: { type: 'event', name: 'keyboard-send' } },
			<div data-tour-target="action">
				<button>Bold</button>
				<div role="textbox" contentEditable aria-label="Reply" />
				<button onClick={() => emitTourEvent('keyboard-send')}>
					Send
				</button>
			</div>
		);
		await screen.findByRole('alertdialog');
		const editor = screen.getByRole('textbox', { name: 'Reply' });
		await waitFor(() => expect(document.activeElement).toBe(editor));
		await userEvent.keyboard('My reply');
		expect(editor.textContent).toBe('My reply');
		await userEvent.tab();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Send' })
		);
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(onTerminalStatus).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'completed' })
			)
		);
	});

	it('keeps explanatory steps modal and retains their keyboard focus trap', async () => {
		renderTour(step, <button data-tour-target="action">Outside</button>);
		const tooltip = await screen.findByRole('alertdialog');
		expect(tooltip.getAttribute('aria-modal')).toBe('true');
		act(() =>
			screen
				.getByRole('button', { name: 'walkthrough.step.done' })
				.focus()
		);
		await userEvent.tab();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'walkthrough.close' })
		);
		await userEvent.tab();
		expect(tooltip.contains(document.activeElement)).toBe(true);
	});
});
