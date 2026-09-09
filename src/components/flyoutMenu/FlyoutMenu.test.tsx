// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlyoutMenu } from './FlyoutMenu';

afterEach(cleanup);

describe('FlyoutMenu', () => {
	it('stays open after its trigger click and closes on the next document click', () => {
		const { container, getByRole } = render(
			<FlyoutMenu>
				<button type="button">Bannen</button>
			</FlyoutMenu>
		);
		const content = container.querySelector('.flyoutMenu__content');
		const documentClick = vi.fn();
		document.addEventListener('click', documentClick);

		fireEvent.click(getByRole('button', { name: 'app.menu' }));
		expect(content?.classList).toContain('flyoutMenu__content--shown');
		expect(documentClick).not.toHaveBeenCalled();

		fireEvent.click(document.body);
		expect(content?.classList).not.toContain('flyoutMenu__content--shown');
		document.removeEventListener('click', documentClick);
	});
});
