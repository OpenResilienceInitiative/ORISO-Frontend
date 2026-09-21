import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Registration } from './Registration';
import { AgencySpecificContext, RegistrationProvider } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { registrationSessionStorageKey } from '../../globalState/provider/RegistrationProvider';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Stage } from '../stage/stage';
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
	render: () => <RegistrationRuntimeStory />
};

/**
 * Regression guard for the step header on long steps (desktop, `lg`).
 *
 * The header row (language + login) and the step band are two sticky boxes:
 * the row at 0, the band at 72px under it. A sticky box only sticks inside its
 * parent. When `.stageLayout__contentWrapper` shrank to one viewport while an
 * opened topic group overflowed it, the row scrolled away after one screen and
 * list rows showed through the empty 72px above the band. Scroll to the very
 * end: the row must still sit at 0, 72px tall, with the band right under it.
 */
export const LongTopicListKeepsStepHeader: Story = {
	// The app root is one viewport tall, which makes `.stageLayout` the
	// scroll container. Storybook's root grows with its content instead.
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

		// Open every collapsed topic group so the step is taller than the
		// viewport, as it is with a real tenant's topic list.
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
