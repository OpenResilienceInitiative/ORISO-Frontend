import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { GlobalTypes } from 'storybook/internal/types';
import type { StoryObj } from '@storybook/react-vite';

/** Manual is the default; a reviewer can explicitly opt into scripted demos. */
export const entryFormDemoGlobalTypes: GlobalTypes = {
	entryFormDemo: {
		name: 'Formular-Demo',
		description:
			'Eingaben selbst bedienen oder die Vorschläge automatisch vorführen',
		toolbar: {
			icon: 'play',
			items: [
				{ value: 'manual', title: 'Formulare manuell bedienen' },
				{ value: 'automatic', title: 'Formular-Demo automatisch' }
			],
			dynamicTitle: true
		}
	}
};

export const entryFormDemoEnabled = (globals: Record<string, unknown>) =>
	globals.entryFormDemo === 'automatic';

/** Verify the real browser motion, including the height reserved by the footer. */
export const verifyConsentOpening = async (panel: HTMLElement) => {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		expect(panel).toBeVisible();
		expect(panel.getBoundingClientRect().height).toBeGreaterThan(20);
		return;
	}
	const animations = panel.getAnimations({ subtree: true });
	expect(animations.length).toBeGreaterThan(0);
	const checkbox = panel.querySelector('input[type="checkbox"]')!;
	for (const animation of animations) {
		animation.pause();
		animation.currentTime = 0;
	}
	const initialHeight = panel.getBoundingClientRect().height;
	const initialTop = checkbox.getBoundingClientRect().top;
	for (const animation of animations) animation.finish();
	expect(panel.getBoundingClientRect().height).toBeGreaterThan(
		initialHeight + 20
	);
	expect(initialTop).toBeGreaterThan(
		checkbox.getBoundingClientRect().top + 20
	);
	// Leave the visible story with the same natural reveal its users see.
	for (const animation of animations) {
		animation.currentTime = 0;
		animation.play();
	}
	await Promise.all(animations.map((animation) => animation.finished));
};

/** Exercise each account entry through its public controls, including portals. */
export const accountConsentPlay =
	(temporary = false): NonNullable<StoryObj['play']> =>
	async ({ canvasElement, globals }) => {
		if (!entryFormDemoEnabled(globals)) return;
		const surface = within(canvasElement.ownerDocument.body);
		const username = await surface.findByRole('textbox', {
			name: 'User-ID'
		});
		await userEvent.clear(username);
		const action = surface.getByRole('button', {
			name: /^(Registrieren|Beitreten|Der Gruppe beitreten)$/
		});
		await waitFor(() => {
			expect(
				surface.queryByRole('region', { name: 'Datenschutz' })
			).not.toBeInTheDocument();
			expect(action).toBeDisabled();
			expect(action).toHaveAttribute('data-cy-state', 'preparing');
		});
		if (temporary) {
			await userEvent.type(username, 'anon-musterstadt');
		} else {
			await userEvent.click(
				surface.getByRole('button', { name: /Alle 3/ })
			);
		}
		const panel = await surface.findByRole('region', {
			name: 'Datenschutz'
		});
		await verifyConsentOpening(panel);
		const checkbox = within(panel).getByRole('checkbox');
		expect(within(panel).queryByRole('heading')).not.toBeInTheDocument();
		expect(checkbox).toBeEnabled();
		expect(checkbox).not.toBeChecked();
		expect(action).toBeDisabled();
		const openingAnimations = panel.getAnimations({ subtree: true });
		await userEvent.click(checkbox);
		await waitFor(() => {
			expect(action).toBeEnabled();
			expect(action).toHaveAttribute('data-cy-state', 'ready');
		});
		expect(within(panel).getByRole('checkbox')).toBe(checkbox);
		for (const animation of openingAnimations) {
			expect(animation.playState).toBe('finished');
			expect(panel.getAnimations({ subtree: true })).toContain(animation);
		}
		await userEvent.click(checkbox);
		await waitFor(() => expect(action).toBeDisabled());
		await waitFor(() => {
			const panelRect = panel.getBoundingClientRect();
			const actionRect = action.getBoundingClientRect();
			expect(Math.abs(actionRect.width - panelRect.width)).toBeLessThan(
				1
			);
			expect(actionRect.right).toBeLessThanOrEqual(
				document.documentElement.clientWidth + 1
			);
			expect(actionRect.bottom).toBeLessThanOrEqual(
				document.documentElement.clientHeight + 1
			);
		});
	};
