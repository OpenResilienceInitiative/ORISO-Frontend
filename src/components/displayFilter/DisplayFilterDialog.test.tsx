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
	{ id: 'system', label: 'System', unreadCount: 0, partial: true },
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
	canReset?: boolean;
}) => {
	const [value, setValue] = useState(initial);
	return (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={rest.onReset ?? (() => undefined)}
			onOpenProfile={() => undefined}
			kinds={KINDS}
			value={value}
			canReset={rest.canReset ?? true}
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
			name: 'In der Liste: Entwürfe'
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
			name: 'In der Liste: Sonstiges'
		}) as HTMLInputElement;
		expect(showOther.disabled).toBe(true);
		expect(showOther.checked).toBe(true);
		// The "cannot be hidden" explanation is visible text, linked to the
		// (unfocusable) disabled checkbox — not a hover-only title.
		const hintId = showOther.getAttribute('aria-describedby');
		expect(hintId).not.toBeNull();
		expect(document.getElementById(hintId as string)?.textContent).toBe(
			STORY_LABELS.otherFixed
		);
		const autoRead = screen.getByRole('switch', {
			name: STORY_LABELS.autoRead
		});
		// The scope/privacy qualification is programmatically attached.
		const descId = autoRead.getAttribute('aria-describedby');
		expect(descId).not.toBeNull();
		expect(document.getElementById(descId as string)?.textContent).toBe(
			STORY_LABELS.autoReadDescription
		);
		fireEvent.click(autoRead);
		expect(
			(onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue)
				.autoReadHidden
		).toBe(true);
	});

	it('renders a partially hidden family as mixed and exposes a real DOM id', () => {
		render(
			<DisplayFilterDialog
				open
				id="dlg-1"
				onClose={() => undefined}
				onReset={() => undefined}
				onChange={() => undefined}
				kinds={KINDS}
				value={EMPTY_DISPLAY_FILTER}
				labels={STORY_LABELS}
			/>
		);
		const showSystem = screen.getByRole('checkbox', {
			name: 'In der Liste: System'
		}) as HTMLInputElement;
		expect(showSystem.getAttribute('aria-checked')).toBe('mixed');
		expect(showSystem.indeterminate).toBe(true);
		expect(document.getElementById('dlg-1')).not.toBeNull();
	});

	it('renders no pill control for a show-only kind', () => {
		render(
			<DisplayFilterDialog
				open
				onClose={() => undefined}
				onReset={() => undefined}
				onChange={() => undefined}
				kinds={[
					...KINDS,
					{ id: 'futureTimeline', label: 'Zukunft', showOnly: true }
				]}
				value={EMPTY_DISPLAY_FILTER}
				labels={STORY_LABELS}
			/>
		);
		expect(
			screen.getByRole('checkbox', { name: 'In der Liste: Zukunft' })
		).not.toBeNull();
		expect(
			screen.queryByRole('checkbox', { name: 'Pille: Zukunft' })
		).toBeNull();
		// The empty Pill cell is explained to screen readers, not left blank.
		expect(screen.getByText(STORY_LABELS.pillNotApplicable)).not.toBeNull();
	});

	it('omits auto-read for sections without it', () => {
		render(<Harness onValue={() => undefined} showAutoRead={false} />);
		expect(
			screen.queryByRole('switch', { name: STORY_LABELS.autoRead })
		).toBeNull();
	});

	it('shows one footer line: the standards link, plus the reset only while this list deviates', () => {
		const onReset = vi.fn();
		const { rerender } = render(
			<Harness
				onValue={() => undefined}
				canReset={false}
				onReset={onReset}
			/>
		);
		expect(
			screen.getByRole('button', { name: 'Standards bearbeiten' })
		).toBeTruthy();
		expect(screen.queryByTestId('display-filter-reset')).toBeNull();
		expect(
			screen.queryByText('Diese Liste weicht von deinen Standards ab.')
		).toBeNull();
		// Only "Fertig" remains as a dialog action.
		expect(
			screen.queryByRole('button', { name: /zurücksetzen/i })
		).toBeNull();
		rerender(
			<Harness onValue={() => undefined} canReset onReset={onReset} />
		);
		expect(
			screen.getByText('Diese Liste weicht von deinen Standards ab.')
		).toBeTruthy();
		fireEvent.click(screen.getByTestId('display-filter-reset'));
		expect(onReset).toHaveBeenCalled();
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

describe('DisplayFilterDialog chip presentation + Träger switch (Frank 2026-09-16)', () => {
	afterEach(cleanup);

	it('lets the user pick the chip view and auto-sort, stored on the section value', () => {
		const onValue = vi.fn();
		render(<Harness onValue={onValue} />);
		const textView = screen.getByRole('radio', { name: 'Text' });
		const iconsView = screen.getByRole('radio', { name: 'Icons' });
		expect((iconsView as HTMLInputElement).checked).toBe(true);
		fireEvent.click(textView);
		expect(
			(onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue).view
		).toBe('text');
		const autoSort = screen.getByRole('switch', {
			name: 'Ungelesenes nach links sortieren'
		});
		expect((autoSort as HTMLInputElement).checked).toBe(true);
		fireEvent.click(autoSort);
		expect(
			(onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue).autoSort
		).toBe(false);
	});

	it('locks a deactivated kind (format off, rows exist) and explains why', () => {
		render(
			<DisplayFilterDialog
				open
				onClose={() => undefined}
				onReset={() => undefined}
				kinds={[
					{ id: 'oneToOne', label: 'Mail', unreadCount: 0 },
					{
						id: 'circle',
						label: 'Gesprächskreis',
						unreadCount: 2,
						availability: 'deactivated'
					}
				]}
				value={EMPTY_DISPLAY_FILTER}
				labels={STORY_LABELS}
				onChange={() => undefined}
			/>
		);
		const show = screen.getByRole('checkbox', {
			name: 'In der Liste: Gesprächskreis'
		}) as HTMLInputElement;
		const pill = screen.getByRole('checkbox', {
			name: 'Pille: Gesprächskreis'
		}) as HTMLInputElement;
		expect(show.disabled).toBe(true);
		expect(show.checked).toBe(true);
		expect(pill.disabled).toBe(true);
		const hint = screen.getByText(
			'Vom Träger abgeschaltet. Bestehende Gespräche bleiben sichtbar, bis sie archiviert sind.'
		);
		expect(show.getAttribute('aria-describedby')).toBe(hint.id);
		// The available kind next to it is untouched.
		expect(
			(
				screen.getByRole('checkbox', {
					name: 'In der Liste: Mail'
				}) as HTMLInputElement
			).disabled
		).toBe(false);
	});
});

describe('DisplayFilterDialog Ton column (Frank 2026-09-16)', () => {
	afterEach(cleanup);

	it('shows a Ton column instead of In der Liste when configured, and stores the mute', () => {
		const onValue = vi.fn();
		render(
			<DisplayFilterDialog
				open
				onClose={() => undefined}
				onReset={() => undefined}
				kinds={[{ id: 'oneToOne', label: 'Mail', unreadCount: 0 }]}
				value={EMPTY_DISPLAY_FILTER}
				labels={STORY_LABELS}
				columns={{ show: false, sound: true }}
				onChange={onValue}
			/>
		);
		expect(
			screen.queryByRole('checkbox', { name: 'In der Liste: Mail' })
		).toBeNull();
		const sound = screen.getByRole('checkbox', {
			name: 'Ton: Mail'
		}) as HTMLInputElement;
		expect(sound.checked).toBe(true);
		fireEvent.click(sound);
		const next = onValue.mock.calls.at(-1)?.[0] as DisplayFilterValue;
		expect(next.kinds.oneToOne?.sound).toBe(false);
		expect(screen.getByRole('columnheader', { name: 'Ton' })).toBeTruthy();
	});

	it('keeps the In der Liste column by default (Zeitstrahl)', () => {
		render(<Harness onValue={() => undefined} />);
		expect(
			screen.getByRole('checkbox', { name: 'In der Liste: Nachrichten' })
		).toBeTruthy();
		expect(screen.queryByRole('checkbox', { name: /^Ton:/ })).toBeNull();
	});
});
