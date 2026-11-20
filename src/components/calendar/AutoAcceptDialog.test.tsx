// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AutoAcceptDialog } from './AutoAcceptDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../form/OrisoSelect', () => ({
	OrisoMultiSelect: ({
		label,
		value,
		options,
		onChange
	}: {
		label: string;
		value: string[];
		options: { value: string; label: string }[];
		onChange: (event: { target: { value: string[] } }) => void;
	}) => (
		<select
			aria-label={label}
			multiple
			value={value}
			onChange={(e) =>
				onChange({
					target: {
						value: Array.from(e.target.selectedOptions).map(
							(o) => o.value
						)
					}
				})
			}
		>
			{options.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
	)
}));

afterEach(cleanup);

const colleagues = [
	{
		id: 'kai',
		displayName: 'Kai Colleague',
		agencyName: 'Nord',
		relation: 'sameAgency' as const
	},
	{
		id: 'ada',
		displayName: 'Ada Beispiel',
		agencyName: 'Nord',
		relation: 'sameAgency' as const
	}
];

describe('AutoAcceptDialog (FE#2305)', () => {
	it('saves the chosen colleagues', () => {
		const onSave = vi.fn();
		render(
			<AutoAcceptDialog
				open
				colleagues={colleagues}
				selected={['kai']}
				onSave={onSave}
				onClose={() => undefined}
			/>
		);
		const select = screen.getByLabelText(
			'calendar.autoAccept.colleagues'
		) as HTMLSelectElement;
		Array.from(select.options).forEach((o) => (o.selected = true));
		fireEvent.change(select);
		fireEvent.click(screen.getByTestId('calendar-auto-accept-save'));
		expect(onSave).toHaveBeenCalledWith(['kai', 'ada']);
	});

	it('lists the colleagues by name and centre', () => {
		render(
			<AutoAcceptDialog
				open
				colleagues={colleagues}
				selected={[]}
				onSave={vi.fn()}
				onClose={() => undefined}
			/>
		);
		expect(
			screen.getByRole('option', { name: 'Ada Beispiel · Nord' })
		).toBeTruthy();
	});
});
