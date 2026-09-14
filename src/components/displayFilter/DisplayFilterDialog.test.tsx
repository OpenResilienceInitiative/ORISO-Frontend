// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DisplayFilterDialog } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	resolveKindSetting
} from './displayFilterTypes';
import { STORY_LABELS } from './displayFilterStoryData';

vi.mock('@mui/icons-material/Tune', () => ({
	default: () => <svg data-testid="tune-icon" />
}));
vi.mock('@mui/icons-material/MoreHoriz', () => ({
	default: () => <svg data-testid="more-icon" />
}));

const KINDS = [
	{ id: 'messages', label: 'Nachrichten', unreadCount: 5 },
	{ id: 'drafts', label: 'Entwürfe', unreadCount: 1 },
	{ id: 'other', label: 'Sonstiges', unreadCount: 0 }
];

const Harness = ({
	initial = EMPTY_DISPLAY_FILTER,
	onValue,
	...rest
}: {
	initial?: DisplayFilterValue;
	onValue: (value: DisplayFilterValue) => void;
	readOnly?: boolean;
	showAutoRead?: boolean;
	onReset?: () => void;
}) => {
	const [value, setValue] = useState(initial);
	return (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={rest.onReset ?? (() => undefined)}
			kinds={KINDS}
			value={value}
			customised
			labels={STORY_LABELS}
			readOnly={rest.readOnly}
			showAutoRead={rest.showAutoRead}
			onChange={(next) => {
				setValue(next);
				onValue(next);
			}}
		/>
	);
};

describe('DisplayFilterDialog (#1377)', () => {
	afterEach(cleanup);

	it('hiding a kind drops its pill and disables the pill checkbox', () => {
		const onValue = vi.fn();
		render(<Harness onValue={onValue} />);
		const showDrafts = screen.getByRole('checkbox', {
			name: 'Anzeigen: Entwürfe'
		}) as HTMLInputElement;
		const pillDrafts = screen.getByRole('checkbox', {
			name: 'Pille: Entwürfe'
		}) as HTMLInputElement;
		expect(pillDrafts.disabled).toBe(false);
		fireEvent.click(showDrafts);
		const last = onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue;
		expect(resolveKindSetting(last, 'drafts')).toEqual({
			show: false,
			pill: false
		});
		expect(pillDrafts.disabled).toBe(true);
		expect(pillDrafts.checked).toBe(false);
	});

	it('keeps "Sonstiges" fixed on and toggles auto-read', () => {
		const onValue = vi.fn();
		render(<Harness onValue={onValue} />);
		const showOther = screen.getByRole('checkbox', {
			name: 'Anzeigen: Sonstiges'
		}) as HTMLInputElement;
		expect(showOther.disabled).toBe(true);
		expect(showOther.checked).toBe(true);
		fireEvent.click(screen.getByRole('switch'));
		expect(
			(onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue)
				.autoReadHidden
		).toBe(true);
	});

	it('omits auto-read for sections without it', () => {
		render(<Harness onValue={() => undefined} showAutoRead={false} />);
		expect(screen.queryByRole('switch')).toBeNull();
	});

	it('inerts everything in read-only mode', () => {
		const onReset = vi.fn();
		render(
			<Harness onValue={() => undefined} readOnly onReset={onReset} />
		);
		expect(screen.getByRole('status').textContent).toContain(
			'neueren App-Version'
		);
		screen.getAllByRole('checkbox').forEach((box) => {
			expect((box as HTMLInputElement).disabled).toBe(true);
		});
		const reset = screen.getByTestId(
			'display-filter-reset'
		) as HTMLButtonElement;
		expect(reset.disabled).toBe(true);
	});
});
