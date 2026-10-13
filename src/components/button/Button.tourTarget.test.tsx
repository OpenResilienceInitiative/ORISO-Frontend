// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* Same stubs as Button.autoClose.test.tsx: Overlay's module graph reaches
   lottie-web, which throws on import under jsdom. */
vi.mock('../overlay/Overlay', () => ({ OVERLAY_RESET_TIME: 10000 }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../resources/img/icons/reload.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock calls */
import { Button, BUTTON_TYPES } from './Button';

afterEach(cleanup);

describe('Button — product-tour anchor', () => {
	it('puts data-tour-target on the button element itself', () => {
		render(
			<Button
				item={{ type: BUTTON_TYPES.PRIMARY, label: 'Annehmen' }}
				tourTarget="enquiry-accept-button"
			/>
		);

		const button = screen.getByRole('button', { name: 'Annehmen' });
		expect(button.getAttribute('data-tour-target')).toBe(
			'enquiry-accept-button'
		);
		expect(button.parentElement?.hasAttribute('data-tour-target')).toBe(
			false
		);
	});

	it('renders no anchor attribute without the prop', () => {
		render(
			<Button item={{ type: BUTTON_TYPES.PRIMARY, label: 'Annehmen' }} />
		);

		expect(
			screen
				.getByRole('button', { name: 'Annehmen' })
				.hasAttribute('data-tour-target')
		).toBe(false);
	});
});
