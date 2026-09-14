// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	SessionTypeContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { AskerInfoContent } from './AskerInfoContent';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('./AskerInfoData', () => ({ AskerInfoData: () => null }));
vi.mock('./AskerInfoTools', () => ({ AskerInfoTools: () => null }));
vi.mock('../box/Box', () => ({ Box: ({ children }: any) => <>{children}</> }));
vi.mock('./AskerInfoAssign', () => ({
	AskerInfoAssign: (props: any) => (
		<div data-testid="assignment-entry">
			{String(props.showLegacyAssignment)}:{String(props.handoverEnabled)}
		</div>
	)
}));

const renderContent = (consultantId: string) =>
	render(
		<TenantContext.Provider value={{ tenant: { settings: {} } } as any}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'owner-1',
							grantedAuthorities: [
								'AUTHORIZATION_CONSULTANT_DEFAULT'
							]
						}
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<ActiveSessionContext.Provider
						value={{
							activeSession: {
								isGroup: false,
								consultant: { id: consultantId },
								item: { id: 41 }
							} as any
						}}
					>
						<AskerInfoContent />
					</ActiveSessionContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</TenantContext.Provider>
	);

describe('AskerInfoContent handover entry eligibility', () => {
	afterEach(cleanup);

	it('shows current owners the handover entry without legacy ASSIGN authority', () => {
		renderContent('owner-1');
		expect(screen.getByTestId('assignment-entry').textContent).toBe(
			'false:true'
		);
	});

	it('does not expose the owner action to another consultant', () => {
		renderContent('owner-2');
		expect(screen.queryByTestId('assignment-entry')).toBeNull();
	});
});
