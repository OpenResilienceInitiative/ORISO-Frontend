import * as React from 'react';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createStore, Provider, useAtomValue } from 'jotai';
import { expect, userEvent, waitFor } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { PracticeBanner } from '../../practice/PracticeBanner';
import { PracticeProvider } from '../../practice/PracticeProvider';
import { isPracticeMode } from '../../practice/practiceMode';
import { InPracticeMode } from './practiceStoryHelpers';
import { practiceTourProgressAtom } from '../../practice/usePracticeTourProgress';

/** What the tour host receives from the banner. */
const HostRequest = () => {
	const request = useAtomValue(tourLaunchRequestAtom);
	return (
		<p role="status" aria-label="Tour host request">
			{request ? `${request.mode} ${request.tourId}` : 'none'}
		</p>
	);
};

/**
 * Practice mode on, a run at step 3 of 6, and an "app" behind the banner so
 * its elevation and its contrast against real content are visible.
 */
const Stage = () => {
	const store = useMemo(() => {
		const created = createStore();
		created.set(practiceTourProgressAtom, {
			tourId: 'consultant-practice-accept',
			stepIndex: 2,
			stepCount: 6
		});
		created.set(tourLaunchRequestAtom, {
			tourId: 'consultant-practice-accept',
			mode: 'start',
			requestedAt: 1
		});
		return created;
	}, []);

	return (
		<Provider store={store}>
			<PracticeProvider>
				<InPracticeMode>
					<main style={{ minHeight: '100vh', padding: 24 }}>
						<h1 style={{ margin: 0 }}>Anfragen</h1>
						<p>Die echte Oberfläche liegt hinter dem Hinweis.</p>
						<PracticeBanner />
						<HostRequest />
					</main>
				</InPracticeMode>
			</PracticeProvider>
		</Provider>
	);
};

const meta = {
	title: 'Organisms/PracticeBanner',
	component: Stage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Persistent note that practice mode is on (#1622). It names the flow, shows "Step i of N", says it is a practice case without real data, and offers **End practice** and **Restart**. It cannot be dismissed. Drag the handle, or focus it and use the arrow keys (Shift: larger steps); it stays inside the window. It sits above the tour overlay and below dialogs. Desktop only: practice cannot be started on a phone.'
			}
		}
	},
	globals: { viewport: { value: 'desktop1440', isRotated: false } }
} satisfies Meta<typeof Stage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
	name: 'Running · desktop',
	play: async ({ canvas }) => {
		const banner = await canvas.findByRole('status', {
			name: 'Übungsmodus'
		});
		await expect(banner).toBeVisible();
		await expect(canvas.getByText('Übung: Anfrage annehmen')).toBeVisible();
		await expect(canvas.getByText(/Schritt 3 von 6/)).toBeVisible();
		await expect(
			canvas.getByText(/Übungsfall, keine echten Daten/)
		).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: 'Übung beenden' })
		).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: 'Neu starten' })
		).toBeVisible();
		// Nothing to dismiss it with.
		await userEvent.keyboard('{Escape}');
		await expect(banner).toBeVisible();
	}
};

export const MovedWithKeyboard: Story = {
	name: 'Moved with the arrow keys · desktop',
	play: async ({ canvas }) => {
		const banner = await canvas.findByRole('status', {
			name: 'Übungsmodus'
		});
		const handle = canvas.getByRole('button', { name: /verschieben/ });
		handle.focus();
		await expect(handle).toHaveFocus();

		const before = banner.getBoundingClientRect();
		await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
		const after = banner.getBoundingClientRect();

		await expect(Math.round(after.top - before.top)).toBe(64);
		await expect(Math.round(after.left)).toBe(Math.round(before.left));
		// Never out of the window, however far it is pushed.
		await userEvent.keyboard(
			'{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}'
		);
		await expect(
			Math.round(banner.getBoundingClientRect().left)
		).toBeGreaterThanOrEqual(8);
	}
};

export const Restart: Story = {
	name: 'Restart · desktop',
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Neu starten' })
		);

		// The tour host gets a new run of the same tour; its re-enter resets
		// the fixtures (Organisms/PracticeFlow runs the whole chain).
		await expect(
			canvas.getByRole('status', { name: 'Tour host request' })
		).toHaveTextContent('restart consultant-practice-accept');
		await expect(isPracticeMode()).toBe(true);
	}
};

export const EndPractice: Story = {
	name: 'End practice · desktop',
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Übung beenden' })
		);

		await waitFor(() =>
			expect(
				canvas.queryByRole('status', { name: 'Übungsmodus' })
			).toBeNull()
		);
		// The guard comes off once the practice views have drained.
		await waitFor(() => expect(isPracticeMode()).toBe(false));
	}
};
