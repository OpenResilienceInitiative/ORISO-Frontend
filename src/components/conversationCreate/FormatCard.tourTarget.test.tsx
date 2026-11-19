// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cleanup, render, screen } from '@testing-library/react';
import { FormatCard } from './FormatCard';

afterEach(cleanup);

const renderCard = (tourTarget?: string) =>
	render(
		<FormatCard
			title="Gesprächskreis"
			subtitle="moderiert durch Berater:innen"
			avatar={<span />}
			tourTarget={tourTarget}
		>
			<p>Inhalt</p>
		</FormatCard>
	);

describe('FormatCard — product-tour anchor', () => {
	it('puts data-tour-target on the card section', () => {
		renderCard('groupchat-format-circle');

		const card = screen
			.getByRole('heading', {
				name: 'Gesprächskreis'
			})
			.closest('section')!;
		expect(card.getAttribute('data-tour-target')).toBe(
			'groupchat-format-circle'
		);
	});

	it('renders no anchor attribute without the prop', () => {
		const { container } = renderCard();

		expect(container.querySelector('[data-tour-target]')).toBeNull();
	});
});
