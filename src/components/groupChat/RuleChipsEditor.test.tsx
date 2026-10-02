// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleChipsEditor } from './RuleChipsEditor';
import { buildGroupChatSeriesRequest } from './createChatHelpers';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { index?: number }) =>
			options?.index ? `${key} ${options.index}` : key
	})
}));
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/plus-mui.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));

const DEFAULT_RULES = ['Sprich von dir selbst.', 'Was hier geteilt wird …'];

/** The form holds the rules; the editor only reports changes. */
const Harness = ({
	initial = DEFAULT_RULES,
	maxRules,
	onRules
}: {
	initial?: string[];
	maxRules?: number;
	onRules: (rules: string[]) => void;
}) => {
	const [rules, setRules] = useState(initial);
	return (
		<RuleChipsEditor
			rules={rules}
			maxRules={maxRules}
			onChange={(next) => {
				setRules(next);
				onRules(next);
			}}
		/>
	);
};

const ruleInput = () =>
	screen.getByLabelText('groupChat.create.authorContent.ruleEditorLabel');

/** What "Erstellen" sends: the create request built from the form's rules. */
const submittedRules = (rules: string[]) =>
	buildGroupChatSeriesRequest({
		topic: 'Gesprächskreis',
		agencyId: 1,
		startDate: '2026-09-25',
		startTime: '18:00',
		duration: 60,
		repeatCount: 1,
		chatInterval: 'WEEKLY',
		modality: 'TEXT',
		timezone: 'Europe/Berlin',
		hintMessage: '',
		groupChatRulesTranslations: { de: rules },
		consultantIds: []
	}).groupChatRulesTranslations?.de;

describe('RuleChipsEditor', () => {
	afterEach(cleanup);

	it('keeps a typed rule that was never confirmed with "+" (#1499)', () => {
		let latest = DEFAULT_RULES;
		render(<Harness onRules={(rules) => (latest = rules)} />);

		fireEvent.change(ruleInput(), {
			target: { value: '  Handys bleiben stumm.  ' }
		});

		expect(submittedRules(latest)).toEqual([
			...DEFAULT_RULES,
			'Handys bleiben stumm.'
		]);
		// The rule shows up as a chip while it is being written.
		expect(
			screen.getByRole('button', {
				name: 'groupChat.create.authorContent.editRule 3'
			})
		).toBeTruthy();
	});

	it('updates the same rule while typing instead of adding one per keystroke', () => {
		let latest = DEFAULT_RULES;
		render(<Harness onRules={(rules) => (latest = rules)} />);

		fireEvent.change(ruleInput(), { target: { value: 'H' } });
		fireEvent.change(ruleInput(), { target: { value: 'Handys aus.' } });

		expect(latest).toEqual([...DEFAULT_RULES, 'Handys aus.']);
	});

	it('"+" still finishes the rule and clears the field for the next one', () => {
		let latest = DEFAULT_RULES;
		render(<Harness onRules={(rules) => (latest = rules)} />);

		fireEvent.change(ruleInput(), { target: { value: 'Handys aus. ' } });
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.create.authorContent.addRule'
			})
		);

		expect(latest).toEqual([...DEFAULT_RULES, 'Handys aus.']);
		expect((ruleInput() as HTMLTextAreaElement).value).toBe('');
	});

	it('keeps an edit of an existing rule without "+"', () => {
		let latest = DEFAULT_RULES;
		render(<Harness onRules={(rules) => (latest = rules)} />);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.create.authorContent.editRule 1'
			})
		);
		fireEvent.change(ruleInput(), {
			target: { value: 'Sprich nur von dir.' }
		});

		expect(latest).toEqual(['Sprich nur von dir.', DEFAULT_RULES[1]]);
	});

	it('does not add an empty rule when the typed text is deleted again', () => {
		let latest = DEFAULT_RULES;
		render(<Harness onRules={(rules) => (latest = rules)} />);

		fireEvent.change(ruleInput(), { target: { value: '   ' } });

		expect(latest).toEqual(DEFAULT_RULES);
	});

	it('locks the field once the rule limit is reached, so nothing typed is lost', () => {
		render(<Harness maxRules={2} onRules={() => {}} />);

		expect((ruleInput() as HTMLTextAreaElement).disabled).toBe(true);
	});
});
