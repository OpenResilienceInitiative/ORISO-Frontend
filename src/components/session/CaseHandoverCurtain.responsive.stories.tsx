import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { SessionsZone } from '../app/SessionsZone';
import { useResponsive } from '../../hooks/useResponsive';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import type { CaseHandoverCurtainStep } from './CaseHandoverCurtain';
import { expect, userEvent, within } from 'storybook/test';
import { CurtainPlayground } from './__storybook__/CurtainPlayground';
import '../app/authenticatedApp.styles';
import './session.styles';
import '../sessionsList/sessionsList.styles';

const route = '/sessions/consultant/sessionView/session/:sessionId';

function SessionListFixture() {
	const { fromL } = useResponsive();
	return (
		<div
			className="sessionsList__wrapper"
			style={{ width: fromL ? 420 : undefined }}
		>
			<p>Fictional team case</p>
		</div>
	);
}

function ProtectedSessionFixture({
	initialStep = 'intro'
}: {
	initialStep?: CaseHandoverCurtainStep;
}) {
	return (
		<div className="session__wrapper">
			<CurtainPlayground
				framed={false}
				initialStep={initialStep}
				initialReasonCode={
					initialStep === 'describe' ? 'ADVICE_REQUESTED' : ''
				}
			/>
		</div>
	);
}

/** Real SessionsZone routing and production shell CSS; only case data is fictional. */
function ResponsiveProtectedSession({
	initialStep = 'intro',
	frameHeight = '100vh'
}: {
	initialStep?: CaseHandoverCurtainStep;
	frameHeight?: number | string;
}) {
	return (
		<div className="app" style={{ height: frameHeight }}>
			<div className="app__wrapper">
				<nav
					className="navigation__wrapper"
					aria-label="Application navigation"
				/>
				<div className="contentWrapper">
					<div className="contentWrapper__content">
						<Routes>
							<Route
								path="/sessions/*"
								element={
									<SessionsZone
										routerConfig={{
											listRoutes: [
												{
													path: route,
													component:
														SessionListFixture,
													type: SESSION_LIST_TYPES.MY_SESSION
												}
											],
											detailRoutes: [
												{
													path: route,
													component: () => (
														<ProtectedSessionFixture
															initialStep={
																initialStep
															}
														/>
													),
													type: SESSION_LIST_TYPES.MY_SESSION
												}
											]
										}}
									/>
								}
							/>
						</Routes>
					</div>
				</div>
			</div>
		</div>
	);
}

const meta = {
	component: ResponsiveProtectedSession,
	title: 'Templates/Sessions/ProtectedCaseResponsive',
	parameters: {
		layout: 'fullscreen',
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7605-35181'
		},
		viewport: {
			options: {
				phone390Short: {
					name: 'Phone short 390×420',
					styles: { width: '390px', height: '420px' },
					type: 'mobile'
				},
				tablet820: {
					name: 'Tablet 820',
					styles: { width: '820px', height: '1180px' },
					type: 'tablet'
				}
			}
		},
		router: { initialPath: '/sessions/consultant/sessionView/session/42' },
		docs: {
			description: {
				component:
					'Protected request form in the actual responsive session list/detail shell. Fictional local case; no content or access is granted.'
			}
		}
	},
	render: ResponsiveProtectedSession
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Phone: Story = { globals: { viewport: { value: 'phone390' } } };
export const Tablet: Story = { globals: { viewport: { value: 'tablet820' } } };
export const Desktop: Story = {
	globals: { viewport: { value: 'desktop1440' } }
};

export const ReasonOnShortPhone: Story = {
	args: { initialStep: 'reason', frameHeight: 420 },
	globals: { viewport: { value: 'phone390Short' } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const next = canvas.getByRole('button', {
			name: /Weiter|Next|Continuer/
		});
		await expect(next).toBeDisabled();
		await userEvent.click(
			canvas.getByRole('radio', {
				name: /Rat erbeten|Advice requested|Conseil demandé/
			})
		);
		await expect(next).toBeEnabled();
		await userEvent.click(next);
		await expect(canvas.getByRole('textbox')).toBeVisible();
	}
};
export const DescriptionOnShortPhone: Story = {
	args: { initialStep: 'describe', frameHeight: 420 },
	globals: { viewport: { value: 'phone390Short' } }
};
