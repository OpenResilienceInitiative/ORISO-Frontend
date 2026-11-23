// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { MarkAllReadButton } from './MarkAllReadButton';

afterEach(cleanup);

describe('MarkAllReadButton — product-tour anchor', () => {
	it('puts data-tour-target on the button itself', () => {
		render(
			<MarkAllReadButton
				hasUnread
				onClick={() => undefined}
				label="Alle als gelesen markieren"
				tourTarget="timeline-mark-all-read"
			/>
		);

		expect(
			screen
				.getByRole('button', { name: 'Alle als gelesen markieren' })
				.getAttribute('data-tour-target')
		).toBe('timeline-mark-all-read');
	});

	it('renders no anchor attribute without the prop', () => {
		render(
			<MarkAllReadButton
				hasUnread
				onClick={() => undefined}
				label="Alle als gelesen markieren"
			/>
		);

		expect(
			screen
				.getByRole('button', { name: 'Alle als gelesen markieren' })
				.hasAttribute('data-tour-target')
		).toBe(false);
	});
});
