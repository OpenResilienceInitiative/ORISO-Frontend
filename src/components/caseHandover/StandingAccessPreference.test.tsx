// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StandingAccessPreference } from './StandingAccessPreference';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
afterEach(cleanup);
it('keeps the saved value until readback confirms the new conversation preference', async () => {
	let complete!: (saved: boolean) => void;
	const save = vi.fn(
		() =>
			new Promise<boolean>((resolve) => {
				complete = resolve;
			})
	);
	render(
		<StandingAccessPreference
			conversationId="one"
			alwaysAsk={false}
			onSave={save}
		/>
	);
	fireEvent.click(screen.getByRole('switch'));
	expect(save).toHaveBeenCalledWith(true);
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	expect(screen.getByRole('switch').matches(':disabled')).toBe(true);
	await act(async () => complete(true));
	expect(screen.getByRole('switch').matches(':checked')).toBe(true);
	expect(screen.getByRole('status').textContent).toBe(
		'caseHandover.standingPreference.saved'
	);
});
it('does not claim success when saving fails and allows retry', async () => {
	const save = vi
		.fn()
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValue(true);
	render(
		<StandingAccessPreference
			conversationId="one"
			alwaysAsk={false}
			onSave={save}
		/>
	);
	fireEvent.click(screen.getByRole('switch'));
	await screen.findByRole('alert');
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	fireEvent.click(screen.getByRole('switch'));
	await screen.findByRole('status');
	expect(screen.getByRole('switch').matches(':checked')).toBe(true);
});
it('reports rejected readback instead of a fabricated saved preference', async () => {
	const completed = vi.fn();
	render(
		<StandingAccessPreference
			conversationId="one"
			alwaysAsk={false}
			onSave={async () => false}
			onSaved={completed}
		/>
	);
	fireEvent.click(screen.getByRole('switch'));
	await screen.findByRole('alert');
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	expect(completed).not.toHaveBeenCalled();
});
it('does not apply a previous conversation save to a newly displayed conversation', async () => {
	let complete!: (saved: boolean) => void;
	const completed = vi.fn();
	const save = () =>
		new Promise<boolean>((resolve) => {
			complete = resolve;
		});
	const view = render(
		<StandingAccessPreference
			conversationId="one"
			alwaysAsk={false}
			onSave={save}
			onSaved={completed}
		/>
	);
	fireEvent.click(screen.getByRole('switch'));
	view.rerender(
		<StandingAccessPreference
			conversationId="two"
			alwaysAsk={false}
			onSave={save}
			onSaved={completed}
		/>
	);
	await act(async () => complete(true));
	expect(screen.getByRole('switch').matches(':checked')).toBe(false);
	expect(screen.queryByRole('status')).toBeNull();
	expect(completed).not.toHaveBeenCalled();
});
it('reading a persisted preference does not save or approve an individual request', () => {
	const save = vi.fn();
	render(
		<StandingAccessPreference
			conversationId="one"
			alwaysAsk={true}
			onSave={save}
		/>
	);
	expect(screen.getByRole('switch').matches(':checked')).toBe(true);
	expect(save).not.toHaveBeenCalled();
});
it('still reports successful readback when the caller reloads the persisted input', async () => {
	const completed = vi.fn();
	const Host = () => {
		const [value, setValue] = React.useState(false);
		return (
			<StandingAccessPreference
				conversationId="one"
				alwaysAsk={value}
				onSave={async (requested) => {
					setValue(requested);
					return requested;
				}}
				onSaved={completed}
			/>
		);
	};
	render(<Host />);
	fireEvent.click(screen.getByRole('switch'));
	await screen.findByRole('status');
	expect(completed).toHaveBeenCalledWith(true);
});
