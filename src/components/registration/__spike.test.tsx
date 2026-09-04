// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lottie-react', () => ({ default: () => null }));

import { Registration } from './Registration';
import {
	RegistrationContext,
	NotificationsContext,
	TenantContext,
	LocaleContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';

const Step = () => <div data-testid="step-body" />;

const wrap = (node: React.ReactNode) => (
	<GlobalComponentContext.Provider value={{ Stage: () => <div /> } as any}>
		<NotificationsContext.Provider
			value={{ addNotification: () => undefined } as any}
		>
			<TenantContext.Provider value={{ tenant: null } as any}>
				<LocaleContext.Provider value={{ locale: 'de' } as any}>
					<RegistrationContext.Provider
						value={
							{
								disabledNextButton: false,
								setDisabledNextButton: () => undefined,
								updateRegistrationData: () => undefined,
								registrationData: {},
								availableSteps: [
									{ name: 'topic-selection', component: Step },
									{ name: 'zipcode', component: Step }
								],
								registrationConsultingType: null
							} as any
						}
					>
						{node}
					</RegistrationContext.Provider>
				</LocaleContext.Provider>
			</TenantContext.Provider>
		</NotificationsContext.Provider>
	</GlobalComponentContext.Provider>
);

describe('spike', () => {
	it('renders', () => {
		render(
			wrap(
				<MemoryRouter initialEntries={['/registration/zipcode']}>
					<Routes>
						<Route
							path="/registration/:step"
							element={<Registration />}
						/>
					</Routes>
				</MemoryRouter>
			)
		);
		expect(screen.getByTestId('step-body')).toBeTruthy();
		const nav = document.querySelector(
			'[data-cy="registration-step-nav"]'
		);
		expect(nav).toBeTruthy();
		let el: HTMLElement | null = nav as HTMLElement;
		while (el && getComputedStyle(el).position !== 'fixed') {
			el = el.parentElement;
		}
		console.log('FOOTER FOUND:', !!el);
		if (el) {
			const cs = getComputedStyle(el);
			console.log(
				JSON.stringify(
					{
						position: cs.position,
						bottom: cs.bottom,
						right: cs.right,
						width: cs.width,
						backgroundColor: cs.backgroundColor,
						borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
						zIndex: cs.zIndex,
						backdropFilter: (cs as any).backdropFilter,
						cls: el.className
					},
					null,
					2
				)
			);
		}
	});
});
