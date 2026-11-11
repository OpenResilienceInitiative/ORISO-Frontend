import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { actWarnings, suspendedInAct } from '../../../.storybook/actWarnings';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Registration } from './Registration';
import { AgencySpecificContext, RegistrationProvider } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';
import { config } from '../../resources/scripts/config';
import { registrationSessionStorageKey } from '../../globalState/provider/RegistrationProvider';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Stage } from '../stage/stage';
import { desktop1440Globals } from '../message/messageStoryShell';
import { coveredLegalLinks } from '../stageLayout/stageLegalLinksContract';
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
	id: 'registration-registration-runtime',
	title: 'Entry flows/Postcode counselling/Routed registration',
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<LegalLinksProvider legalLinks={config.legalLinks}>
				<Story />
			</LegalLinksProvider>
		)
	],
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

// #1338: the header topic search moves focus through MUI buttons; see
// storyActWarnings for why these exact warnings are declared.
const headerSearchActWarnings = actWarnings({
	'ForwardRef(ButtonBase)': 9,
	'TransitionGroup': 6,
	'Transition': 1,
	'TopicSelection': 1,
	'RegistrationProvider': 1
});

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
	parameters: {
		verification: {
			expectedErrors: [...headerSearchActWarnings, ...suspendedInAct(1)]
		}
	},
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

/**
 * ORISO-Frontend#1736 (Frank, 2026-10-15: the middle part moves in, the
 * stepper travels, nothing reloads). The real routed registration: choosing a
 * topic and pressing "Weiter" slides the next step in from the right while the
 * stage, the header and the stepper stay the very same elements; going back
 * through the stepper slides the step in from the left.
 */
export const NextStepSlidesInAndTheFrameStays: Story = {
	parameters: {
		verification: { expectedErrors: headerSearchActWarnings }
	},
	globals: desktop1440Globals,
	render: () => (
		<div style={{ height: '100vh' }}>
			<RegistrationRuntimeStory />
		</div>
	),
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const body = within(doc.body);
		const currentStep = () =>
			doc
				.querySelector('[data-cy="registration-form"]')
				?.getAttribute('data-cy-step');
		const slidingFrom = () =>
			doc
				.querySelector('[data-cy="step-transition"]')
				?.getAttribute('data-slide-from');
		const isSliding = (name: string) =>
			(
				doc
					.querySelector('[data-cy="step-transition"]')
					?.getAnimations() ?? []
			).some(
				(animation) =>
					(animation as CSSAnimation).animationName === name
			);

		const header = await waitFor(() => {
			const row = doc.querySelector<HTMLElement>('.stageLayout__header');
			expect(row).not.toBeNull();
			return within(row!);
		});
		await userEvent.click(
			await header.findByRole('button', { name: 'Thema suchen' })
		);
		await userEvent.type(await header.findByRole('combobox'), 'schulden');
		await userEvent.click(
			await body.findByRole('option', { name: /Schulden/ })
		);
		await waitFor(() =>
			expect(body.getByRole('button', { name: /Weiter/ })).toBeEnabled()
		);

		const firstStep = currentStep();
		const frame = {
			stage: doc.querySelector('.stageLayout__stage'),
			header: doc.querySelector('[data-cy="registration-header"]'),
			stepper: doc.querySelector('[data-cy="icon-stepper"]')
		};
		expect(frame.stage).not.toBeNull();
		expect(frame.header).not.toBeNull();
		expect(frame.stepper).not.toBeNull();

		await userEvent.click(body.getByRole('button', { name: /Weiter/ }));

		await waitFor(() => expect(currentStep()).not.toBe(firstStep));
		expect(slidingFrom()).toBe('right');
		await waitFor(() => expect(isSliding('slideInFromRight')).toBe(true));
		// The frame did not reload: the same elements, moved on.
		expect(doc.querySelector('.stageLayout__stage')).toBe(frame.stage);
		expect(doc.querySelector('[data-cy="registration-header"]')).toBe(
			frame.header
		);
		expect(doc.querySelector('[data-cy="icon-stepper"]')).toBe(
			frame.stepper
		);
		// The line to the step we came from is now solid.
		expect(
			doc.querySelector('[data-cy="step-connector"][data-done="true"]')
		).not.toBeNull();
		expect(
			doc.querySelector('[aria-current="step"]')?.getAttribute('data-cy')
		).not.toBe(`icon-stepper-step-${firstStep}`);

		// Back through the stepper: the step slides in from the other side.
		await userEvent.click(
			doc.querySelector(`[data-cy="icon-stepper-step-${firstStep}"]`)!
		);
		await waitFor(() => expect(currentStep()).toBe(firstStep));
		expect(slidingFrom()).toBe('left');
		expect(doc.querySelector('.stageLayout__stage')).toBe(frame.stage);
		expect(doc.querySelector('[data-cy="registration-header"]')).toBe(
			frame.header
		);
	}
};

/**
 * ORISO-Frontend#2138 (also ORISO-Admin#1487): from the postcode step on, the
 * privacy policy and imprint in the red stage could be seen but not clicked —
 * the build identity footer of the content column lay over them. The first
 * step hid the bug: its long topic list pushes that footer below the links.
 * This walks the real routed flow on desktop and hit-tests every legal link on
 * every step it reaches, then opens the imprint with a real click.
 *
 * The platform version is set as on every deployed environment: without it
 * the identity footer is not rendered, and Storybook never showed the bug.
 */
export const LegalLinksStayClickableOnEveryStep: Story = {
	beforeEach: () => {
		const runtimeWindow: Window & {
			__ORISO_RUNTIME_CONFIG__?: Record<string, string | undefined>;
		} = window;
		const previous = runtimeWindow.__ORISO_RUNTIME_CONFIG__;
		runtimeWindow.__ORISO_RUNTIME_CONFIG__ = {
			...previous,
			REACT_APP_PLATFORM_VERSION: 'v2.0.15'
		};
		return () => {
			runtimeWindow.__ORISO_RUNTIME_CONFIG__ = previous;
		};
	},
	globals: desktop1440Globals,
	render: () => (
		<div style={{ height: '100vh' }}>
			<RegistrationRuntimeStory />
		</div>
	),
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const body = within(doc.body);
		const currentStep = () =>
			doc
				.querySelector('[data-cy="registration-form"]')
				?.getAttribute('data-cy-step');
		const expectLegalLinksReachable = () =>
			waitFor(() => expect(coveredLegalLinks(doc)).toEqual([]));

		// Pick the first topic the way a visitor does: open a group, choose.
		const group = await waitFor(() => {
			const summary = doc.querySelector<HTMLElement>(
				'.stageLayout__content .MuiAccordionSummary-root[aria-expanded="false"]'
			);
			expect(summary).not.toBeNull();
			return summary!;
		});
		await expectLegalLinksReachable();
		await userEvent.click(group);
		const topic = await waitFor(() => {
			// The radio input itself is hidden; its row takes the click.
			const row = doc
				.querySelector<HTMLElement>(
					'[data-cy="topic-radio-group"] input[type="radio"]'
				)
				?.closest<HTMLElement>('label, .MuiListItemButton-root');
			expect(row).toBeTruthy();
			return row!;
		});
		await userEvent.click(topic);
		await waitFor(() =>
			expect(body.getByRole('button', { name: /Weiter/ })).toBeEnabled()
		);
		const firstStep = currentStep();
		await userEvent.click(body.getByRole('button', { name: /Weiter/ }));
		await waitFor(() => expect(currentStep()).not.toBe(firstStep));

		// The short postcode step: here the footer used to cover the links.
		await expectLegalLinksReachable();

		const imprint = doc.querySelector<HTMLElement>(
			'.stage__legalLinks button:last-of-type, .stage__legalLinks a:last-of-type'
		);
		expect(imprint).not.toBeNull();
		const rect = imprint!.getBoundingClientRect();
		// A real pointer click at the link's position, not a synthetic
		// click on the element, so a covering box would take it instead.
		const target = doc.elementFromPoint(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2
		) as HTMLElement;
		await userEvent.click(target);
		const dialog = await body.findByRole('dialog');
		await waitFor(() => expect(dialog).toBeVisible());
	}
};
