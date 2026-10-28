// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { PseudonymCard } from './PseudonymCard';
import type { Pseudonym } from '../../utils/pseudonymGenerator';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('./AnimalAvatar', () => ({ AnimalAvatar: () => null }));
afterEach(cleanup);
const identity: Pseudonym = {
	displayName: 'freundliche Katze Mika',
	animalLabel: 'Katze',
	name: 'Mika',
	avatar: { file: 'cat.svg', bg: '#ffffff', iconColor: '#000000' }
};
describe('the legacy pseudonym card name control', () => {
	it('allows typing without replacing the chosen identity', () => {
		const onChange = vi.fn();
		render(
			<PseudonymCard
				pseudonym={identity}
				skipTyping
				editable
				onNameChange={onChange}
			/>
		);
		fireEvent.change(
			screen.getByRole('textbox', { name: 'profile.data.displayName' }),
			{ target: { value: 'My alias' } }
		);
		expect(onChange).toHaveBeenCalledWith('My alias');
	});
	it('prevents typing while retaining the generated name when typing is off', () => {
		const onChange = vi.fn();
		render(
			<PseudonymCard
				pseudonym={identity}
				skipTyping
				editable={false}
				onNameChange={onChange}
			/>
		);
		const input = screen.getByRole<HTMLInputElement>('textbox', {
			name: 'profile.data.displayName'
		});
		expect(input.readOnly).toBe(true);
		expect(input.value).toBe('freundliche Katze Mika');
		fireEvent.change(input, { target: { value: 'Cannot type this' } });
		expect(onChange).not.toHaveBeenCalled();
	});
});
