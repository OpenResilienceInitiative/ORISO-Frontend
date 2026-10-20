// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';

const state = vi.hoisted(() => ({
	theming: {
		assistantName: 'Help companion',
		assistantIcon: 'data:image/png;base64,iVBORw0KGgo&#61;'
	}
}));
vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: () => ({ theming: state.theming })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
afterEach(cleanup);

describe('tenant identity in real assistant messages', () => {
	it('shows the saved name and preset and stops using the previous tenant identity after switching', () => {
		const { container, rerender } = render(
			<ErstantwortSequence
				skipAnimation
				bausteine={[{ id: 'greeting', body: 'Your message arrived.' }]}
			/>
		);
		expect(screen.getByText('Help companion')).toBeTruthy();
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			'data:image/png;base64,iVBORw0KGgo='
		);
		state.theming = { assistantName: '', assistantIcon: 'default' };
		rerender(
			<ErstantwortSequence
				skipAnimation
				bausteine={[{ id: 'greeting', body: 'Your message arrived.' }]}
			/>
		);
		expect(screen.getByText('Carimat')).toBeTruthy();
		expect(screen.queryByText('Help companion')).toBeNull();
	});
	it('keeps an explicit supervision sender separate from the assistant branding', () => {
		render(
			<ErstantwortSequence
				skipAnimation
				name="Supervision"
				bausteine={[{ id: 'greeting', body: 'A supervision notice.' }]}
			/>
		);
		expect(screen.getByText('Supervision')).toBeTruthy();
	});
});
