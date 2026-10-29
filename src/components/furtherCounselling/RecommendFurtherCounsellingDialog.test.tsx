// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { RecommendFurtherCounsellingDialog } from './RecommendFurtherCounsellingDialog';

const apiRecommend = vi.fn();
const apiTopics = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.count !== undefined
				? `${key}[${options.count}/${options.max}]`
				: key,
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('../../api/apiFurtherCounselling', () => ({
	apiPostFurtherCounsellingRecommendation: (...args: unknown[]) =>
		apiRecommend(...args)
}));
vi.mock('../../api/apiGetTopicsData', () => ({
	apiGetTopicsData: () => apiTopics()
}));
vi.mock('../form/OrisoSelect', () => ({
	OrisoSelect: ({ label, options, value, onChange }: any) => (
		<select
			aria-label={label}
			value={value}
			onChange={(event) =>
				onChange({ target: { value: event.target.value } })
			}
		>
			<option value="" />
			{options.map((option: any) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	)
}));

const renderDialog = (
	props: Partial<
		React.ComponentProps<typeof RecommendFurtherCounsellingDialog>
	> = {}
) =>
	render(
		<RecommendFurtherCounsellingDialog
			open
			sessionId={12}
			onClose={() => {}}
			onSent={() => {}}
			{...props}
		/>
	);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('RecommendFurtherCounsellingDialog', () => {
	it('lists every topic, the current one included, and preselects nothing else', async () => {
		apiTopics.mockResolvedValue([
			{ id: 7, name: 'Schulden' },
			{ id: 9, name: 'Familie' }
		]);
		renderDialog();
		await waitFor(() =>
			expect(
				screen.getAllByRole('option').filter((o) => o.textContent)
			).toHaveLength(2)
		);
		expect(
			screen.getByRole('button', {
				name: 'furtherCounselling.recommend.submit'
			})
		).toHaveProperty('disabled', true);
	});

	it('sends topic and trimmed note, then reports success', async () => {
		apiTopics.mockResolvedValue([{ id: 9, name: 'Familie' }]);
		apiRecommend.mockResolvedValue(undefined);
		const onSent = vi.fn();
		renderDialog({ onSent });
		await screen.findByRole('option', { name: 'Familie' });
		fireEvent.change(
			screen.getByLabelText('furtherCounselling.recommend.topicLabel'),
			{ target: { value: '9' } }
		);
		fireEvent.change(
			screen.getByLabelText('furtherCounselling.recommend.noteLabel'),
			{ target: { value: '  Bitte dort melden  ' } }
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherCounselling.recommend.submit'
			})
		);
		await waitFor(() => expect(onSent).toHaveBeenCalled());
		expect(apiRecommend).toHaveBeenCalledWith(12, 9, 'Bitte dort melden');
	});

	it('counts the note and caps it at 1000 characters', async () => {
		apiTopics.mockResolvedValue([]);
		renderDialog();
		const note = screen.getByLabelText(
			'furtherCounselling.recommend.noteLabel'
		) as HTMLTextAreaElement;
		expect(note.maxLength).toBe(1000);
		fireEvent.change(note, { target: { value: 'x'.repeat(1200) } });
		expect(note.value).toHaveLength(1000);
		expect(
			screen.getByText(
				'furtherCounselling.recommend.noteCounter[1000/1000]'
			)
		).toBeTruthy();
	});

	it.each([
		['FORBIDDEN', 'furtherCounselling.recommend.errorForbidden'],
		['CONFLICT', 'furtherCounselling.recommend.errorConflict'],
		['CATCH_ALL', 'furtherCounselling.recommend.error']
	])('explains a %s failure and keeps the input', async (reason, text) => {
		apiTopics.mockResolvedValue([{ id: 9, name: 'Familie' }]);
		apiRecommend.mockRejectedValue(new Error(reason));
		const onSent = vi.fn();
		renderDialog({ onSent });
		await screen.findByRole('option', { name: 'Familie' });
		fireEvent.change(
			screen.getByLabelText('furtherCounselling.recommend.topicLabel'),
			{ target: { value: '9' } }
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherCounselling.recommend.submit'
			})
		);
		expect(await screen.findByText(text)).toBeTruthy();
		expect(onSent).not.toHaveBeenCalled();
		expect(
			(
				screen.getByLabelText(
					'furtherCounselling.recommend.topicLabel'
				) as HTMLSelectElement
			).value
		).toBe('9');
	});
});
