// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	TenantContext,
	TenantProvider,
	useTenantState
} from './TenantProvider';

const Probe = () => {
	const state = useTenantState();
	const context = React.useContext(TenantContext);
	return (
		<>
			<span>
				{state.isLoading ? 'loading' : state.tenant?.id || 'missing'}
			</span>
			<button
				type="button"
				onClick={() =>
					context.setTenant({ id: 'tenant-17', settings: {} } as any)
				}
			>
				resolve
			</button>
		</>
	);
};

describe('useTenantState', () => {
	it('distinguishes an unresolved tenant from a missing provider', () => {
		const { rerender } = render(
			<TenantProvider>
				<Probe />
			</TenantProvider>
		);
		expect(screen.getByText('loading')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'resolve' }));
		expect(screen.getByText('tenant-17')).toBeTruthy();

		rerender(<Probe />);
		expect(screen.getByText('missing')).toBeTruthy();
	});
});
