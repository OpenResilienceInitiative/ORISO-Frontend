// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { FilterChip } from './FilterChip';

const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;

afterEach(cleanup);

describe('FilterChip — product-tour anchor', () => {
	it('puts data-tour-target on the chip button itself', () => {
		render(
			<FilterChip
				label="Live-Chat"
				icon={Icon}
				tourTarget="livechat-queue"
			/>
		);

		const chip = screen.getByRole('button', { name: 'Live-Chat' });
		expect(chip.getAttribute('data-tour-target')).toBe('livechat-queue');
	});

	it('renders no anchor attribute without the prop', () => {
		render(<FilterChip label="Live-Chat" icon={Icon} />);

		expect(
			screen
				.getByRole('button', { name: 'Live-Chat' })
				.hasAttribute('data-tour-target')
		).toBe(false);
	});
});
