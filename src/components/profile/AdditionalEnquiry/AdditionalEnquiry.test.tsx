// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdditionalEnquiry } from './AdditionalEnquiry';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		SessionsDataContext: ReactModule.createContext({
			sessions: [
				{
					agency: { id: 42, name: 'Agency', postcode: '10115' },
					session: { id: 1, postcode: 1067 }
				}
			],
			dispatch: vi.fn()
		})
	};
});

vi.mock('../../button/Button', () => ({
	BUTTON_TYPES: { LINK: 'link', PRIMARY: 'primary' },
	Button: ({ item, buttonHandle }: any) => (
		<button type="button" onClick={buttonHandle}>
			{item.label}
		</button>
	)
}));

vi.mock('../../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h2>{text}</h2>
}));

vi.mock('../NewRequestDialog/NewRequestDialog', () => ({
	NewRequestDialog: ({ open, prefilledPostcode, knownAgencyIds }: any) =>
		open ? (
			<div data-testid="new-request-dialog">
				postcode:{prefilledPostcode};known:
				{(knownAgencyIds ?? []).join(',')}
			</div>
		) : null
}));

describe('AdditionalEnquiry', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('opens the dialog with zero-padded postcode and known agency ids', () => {
		render(<AdditionalEnquiry />);

		expect(screen.queryByTestId('new-request-dialog')).toBeNull();

		fireEvent.click(
			screen.getByText('profile.data.register.dialog.openButton')
		);

		// numeric session postcode 1067 must arrive as "01067"
		expect(screen.getByTestId('new-request-dialog').textContent).toBe(
			'postcode:01067;known:42'
		);
	});
});
