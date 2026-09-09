// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduleRows } from './ScheduleRows';

afterEach(cleanup);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				'groupChat.create.modality.options.text': 'Text',
				'groupChat.create.modality.options.audio': 'Audio',
				'groupChat.create.modality.options.video': 'Video'
			})[key] ?? key
	})
}));

vi.mock('../../../resources/img/icons/calendar.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../../resources/img/icons/clock.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../../resources/img/icons/reload.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../../resources/img/icons/diversity-2.svg', () => ({
	ReactComponent: () => <span data-testid="neutral-medium-icon" />
}));
vi.mock('../../../resources/img/icons/language_outline.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../../resources/img/icons/chat.svg', () => ({
	ReactComponent: () => <span data-testid="text-medium-icon" />
}));
vi.mock('../../../resources/img/icons/call.svg', () => ({
	ReactComponent: () => <span data-testid="audio-medium-icon" />
}));
vi.mock('../../../resources/img/icons/video-call.svg', () => ({
	ReactComponent: () => <span data-testid="video-medium-icon" />
}));

vi.mock('../../form/OrisoCalendar', () => ({ OrisoCalendar: () => null }));
vi.mock('../../form/OrisoTimePicker', () => ({
	OrisoTimePicker: () => null
}));
vi.mock('../../splitButton/SplitButton', () => ({
	SplitButton: React.forwardRef(
		(
			{ label, icon }: { label: React.ReactNode; icon?: React.ReactNode },
			_ref
		) => (
			<div>
				{icon}
				<span>{label}</span>
			</div>
		)
	)
}));
vi.mock('../RowMenu', () => ({ RowMenu: () => null }));

const baseValue = {
	startDate: '2026-09-09',
	startTime: '10:38',
	duration: 5400,
	repeatCount: 2,
	interval: 'WEEKLY' as const,
	modality: 'TEXT' as const
};

describe('ScheduleRows medium selection', () => {
	it.each([
		['TEXT', 'Text', 'text-medium-icon'],
		['AUDIO', 'Audio', 'audio-medium-icon'],
		['VIDEO', 'Video', 'video-medium-icon']
	] as const)('shows %s with its matching icon', (modality, label, icon) => {
		render(
			<ScheduleRows
				value={{ ...baseValue, modality }}
				onChange={vi.fn()}
				language="de"
				onLanguageChange={vi.fn()}
				languageOptions={[{ value: 'de', label: 'Deutsch' }]}
			/>
		);

		expect(screen.getByText(label)).toBeTruthy();
		expect(screen.getByTestId(icon)).toBeTruthy();
		expect(screen.queryByTestId('neutral-medium-icon')).toBeNull();
	});
});
