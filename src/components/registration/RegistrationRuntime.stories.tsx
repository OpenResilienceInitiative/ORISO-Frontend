import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Registration } from './Registration';
import { AgencySpecificContext, RegistrationProvider } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { registrationSessionStorageKey } from '../../globalState/provider/RegistrationProvider';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Stage } from '../stage/stage';
import { desktop1440Globals } from '../message/messageStoryShell';
import {
	APP_ORISO_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';

function RegistrationRuntimeStory() {
	const [sessionCleared, setSessionCleared] = useState(false);
	const [specificAgency, setSpecificAgency] = useState<any>(null);

	useEffect(() => {
		const previousRegistrationSession = sessionStorage.getItem(
			registrationSessionStorageKey
		);
		sessionStorage.removeItem(registrationSessionStorageKey);
		setSessionCleared(true);

		return () => {
			if (previousRegistrationSession == null) {
				sessionStorage.removeItem(registrationSessionStorageKey);
			} else {
				sessionStorage.setItem(
					registrationSessionStorageKey,
					previousRegistrationSession
				);
			}
		};
	}, []);

	if (!sessionCleared) {
		return null;
	}

	return (
		<AgencySpecificContext.Provider
			value={{
				specificAgency,
				setSpecificAgency
			}}
		>
			<GlobalComponentContext.Provider value={{ Stage }}>
				<RegistrationProvider>
					<Routes>
						<Route
							path="/registration"
							element={<Registration />}
						/>
						<Route
							path="/registration/:step"
							element={<Registration />}
						/>
						<Route
							path="/:topicSlug/registration"
							element={<Registration />}
						/>
						<Route
							path="/:topicSlug/registration/:step"
							element={<Registration />}
						/>
						<Route
							path="*"
							element={
								<Navigate
									to="/registration/topic-selection"
									replace
								/>
							}
						/>
					</Routes>
				</RegistrationProvider>
			</GlobalComponentContext.Provider>
		</AgencySpecificContext.Provider>
	);
}

const meta = {
	title: 'REGISTRATION/Registration runtime',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'light' },
		router: {
			initialPath: '/registration/topic-selection'
		},
		design: [
			{
				type: 'figma',
				name: 'App.Oriso',
				url: APP_ORISO_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Runtime story for the real routed `Registration` component. It uses the app `RegistrationProvider`, Storybook API fixtures from preview.tsx, real `StageLayout`, and a MemoryRouter route so `useParams()` receives the active registration step.'
			}
		}
	}
} satisfies Meta<typeof RegistrationRuntimeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopicSelectionRoute: Story = {
	// One viewport tall like the app root, so `.stageLayout` is the scroller.
	render: () => (
		<div style={{ height: '100vh' }}>
			<RegistrationRuntimeStory />
		</div>
	)
};

/**
 * Regression guard: on a long step the sticky header row stays at 0 with the
 * band under it; breaks if `.stageLayout__contentWrapper` shrinks.
 */
export const LongTopicListKeepsStepHeader: Story = {
	globals: desktop1440Globals,
	// Storybook's root grows with its content; the app root is one viewport tall.
	render: () => (
		<div style={{ height: '100vh' }}>
			<RegistrationRuntimeStory />
		</div>
	),
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const query = <T extends Element>(selector: string) =>
			doc.querySelector<T>(selector);

		await waitFor(() => {
			expect(query('.stageLayout__header')).not.toBeNull();
			expect(query('.registrationStepperSticky')).not.toBeNull();
		});

		// Make the step taller than the viewport.
		await waitFor(() =>
			expect(
				doc.querySelectorAll('.stageLayout__content [aria-expanded]')
					.length
			).toBeGreaterThan(0)
		);
		for (const group of Array.from(
			doc.querySelectorAll<HTMLElement>(
				'.stageLayout__content .MuiAccordionSummary-root[aria-expanded="false"]'
			)
		)) {
			await userEvent.click(group);
		}

		const scroller = query<HTMLElement>('.stageLayout')!;
		await waitFor(() =>
			expect(scroller.scrollHeight).toBeGreaterThan(
				scroller.clientHeight * 2
			)
		);
		scroller.scrollTop = scroller.scrollHeight;

		await waitFor(() => {
			const header = query(
				'.stageLayout__header'
			)!.getBoundingClientRect();
			const band = query(
				'.registrationStepperSticky'
			)!.getBoundingClientRect();
			expect(header.top).toBe(0);
			expect(header.height).toBe(72);
			expect(band.top).toBe(header.bottom);
		});
	}
};

/** A picked search suggestion selects the topic and enables "Weiter". */
export const HeaderSearchSelectsTopic: Story = {
	globals: desktop1440Globals,
	render: () => (
		<div style={{ height: '100vh' }}>
			<RegistrationRuntimeStory />
		</div>
	),
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		const header = await waitFor(() => {
			const row = canvasElement.ownerDocument.querySelector<HTMLElement>(
				'.stageLayout__header'
			);
			expect(row).not.toBeNull();
			return within(row!);
		});

		await userEvent.click(
			await header.findByRole('button', { name: 'Thema suchen' })
		);
		await userEvent.type(await header.findByRole('combobox'), 'schulden');
		const option = await body.findByRole('option', { name: /Schulden/ });
		await userEvent.click(option);

		await waitFor(() => {
			const checked = canvasElement.ownerDocument.querySelector(
				'[data-cy="topic-radio-group"] input[type="radio"]:checked'
			);
			expect(checked).not.toBeNull();
			expect(
				checked!.closest(
					'[role="radio"], li, label, .MuiListItemButton-root'
				)?.textContent
			).toMatch(/Schulden/);
		});
		await waitFor(() =>
			expect(body.getByRole('button', { name: /Weiter/ })).toBeEnabled()
		);
	}
};
