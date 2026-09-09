// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleChipsEditor } from './RuleChipsEditor';

afterEach(cleanup);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { index?: number }) =>
			({
				'groupChat.create.authorContent.ruleEditorLabel':
					'Regel bearbeiten',
				'groupChat.create.authorContent.rule': 'Regel',
				'groupChat.create.authorContent.editRule': `Regel ${options?.index} bearbeiten`,
				'groupChat.create.authorContent.deleteRule': `Regel ${options?.index} löschen`,
				'groupChat.create.authorContent.ruleChip': `Regel Nr. ${options?.index}`,
				'groupChat.create.authorContent.addRule': 'Regel hinzufügen'
			})[key] ?? key
	})
}));

vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/plus-mui.svg', () => ({
	ReactComponent: () => <span />
}));

const Harness = () => {
	const [rules, setRules] = useState([
		'Sprich von dir selbst.',
		'Was hier geteilt wird, bleibt hier.'
	]);
	return <RuleChipsEditor rules={rules} onChange={setRules} />;
};

describe('RuleChipsEditor', () => {
	it('starts a visible third rule before its text is entered', () => {
		render(<Harness />);

		const addRule = screen.getByRole('button', {
			name: 'Regel hinzufügen'
		}) as HTMLButtonElement;
		expect(addRule.disabled).toBe(false);

		fireEvent.click(addRule);

		expect(
			screen.getByRole('button', { name: 'Regel 3 bearbeiten' })
		).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole('textbox', { name: 'Regel bearbeiten' })
		);
	});

	it('saves the text entered for the new rule', () => {
		render(<Harness />);
		const addRule = screen.getByRole('button', {
			name: 'Regel hinzufügen'
		});
		fireEvent.click(addRule);
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Regel bearbeiten' }),
			{ target: { value: 'Sei freundlich.' } }
		);
		fireEvent.click(addRule);

		expect(
			screen
				.getByRole('button', { name: 'Regel 3 bearbeiten' })
				.getAttribute('title')
		).toBe('Sei freundlich.');
	});
});
