import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { SessionsZone } from '../app/SessionsZone';
import { useResponsive } from '../../hooks/useResponsive';
import { SESSION_LIST_TYPES } from './sessionHelpers';
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

function ProtectedSessionFixture() {
	return (
		<div className="session__wrapper">
			<CurtainPlayground framed={false} />
		</div>
	);
}

/** Real SessionsZone routing and production shell CSS; only case data is fictional. */
function ResponsiveProtectedSession() {
	return (
		<div className="app" style={{ height: '100vh' }}>
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
													component:
														ProtectedSessionFixture,
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
	title: 'Templates/Sessions/ProtectedCaseResponsive',
	parameters: {
		layout: 'fullscreen',
		viewport: {
			options: {
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
