// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TeamDiscussionIconButton } from './TeamDiscussionBadge';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const renderInRow = (onOpen: () => void) => {
	const onRowKeyDown = vi.fn();
	const onRowClick = vi.fn();
	render(
		<div onKeyDown={onRowKeyDown} onClick={onRowClick}>
			<TeamDiscussionIconButton onOpen={onOpen} />
		</div>
	);
	return { onRowKeyDown, onRowClick };
};

describe('TeamDiscussionIconButton', () => {
	it('opens the discussion on click without activating the row', () => {
		const onOpen = vi.fn();
		const { onRowClick } = renderInRow(onOpen);
		fireEvent.click(screen.getByRole('button'));
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onRowClick).not.toHaveBeenCalled();
	});

	it.each(['Enter', ' '])(
		'keeps %j keydown away from the enclosing row handler',
		(key) => {
			const { onRowKeyDown } = renderInRow(vi.fn());
			fireEvent.keyDown(screen.getByRole('button'), { key });
			expect(onRowKeyDown).not.toHaveBeenCalled();
		}
	);

	it('still lets arrow keys reach the row for list navigation', () => {
		const { onRowKeyDown } = renderInRow(vi.fn());
		fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
		expect(onRowKeyDown).toHaveBeenCalledTimes(1);
	});
});
