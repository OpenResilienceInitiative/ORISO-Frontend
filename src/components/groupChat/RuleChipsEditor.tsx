import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus-mui.svg';

/**
 * Group rules editor (Figma 8482-30552, right column): one text area holding
 * the rule currently being written, the saved rules underneath as chips, and a
 * 48x48 add button — the size is the WCAG 2.2 target-size minimum the design
 * annotates explicitly.
 *
 * Selecting a chip loads that rule back into the editor so it can be changed;
 * the chip's × deletes it. Editing an existing rule replaces it in place
 * instead of appending a duplicate.
 *
 * Typing writes through to `rules` at once, like every other field of the
 * form: text the author never confirmed with "+" used to be dropped silently
 * on "Erstellen" (#1499). "+" only closes the rule and clears the field.
 */

export const RULE_MAX_LENGTH = 120;

interface RuleChipsEditorProps {
	rules: string[];
	onChange: (rules: string[]) => void;
	/** Reset the draft when the counsellor switches language tab. */
	resetKey?: string;
	maxRules?: number;
}

export const RuleChipsEditor = ({
	rules,
	onChange,
	resetKey,
	maxRules = 10
}: RuleChipsEditorProps) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState('');
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		setDraft('');
		setEditingIndex(null);
	}, [resetKey]);

	const updateDraft = (text: string) => {
		setDraft(text);
		if (editingIndex !== null) {
			onChange(
				rules.map((rule, index) =>
					index === editingIndex ? text : rule
				)
			);
			return;
		}
		if (!text.trim() || rules.length >= maxRules) {
			return;
		}
		setEditingIndex(rules.length);
		onChange([...rules, text]);
	};

	const commit = () => {
		const text = draft.trim();
		if (!text) {
			return;
		}
		if (editingIndex === null) {
			onChange([...rules, text]);
		} else {
			onChange(
				rules.map((rule, index) =>
					index === editingIndex ? text : rule
				)
			);
		}
		setDraft('');
		setEditingIndex(null);
	};

	/*
	 * The plus is an *add* action, not a commit: with an empty draft it appends
	 * a fresh rule and moves the caret into it. Previously it sat disabled until
	 * something was typed, which read as a dead control.
	 */
	const addOrCommit = () => {
		if (editingIndex === null && !draft.trim()) {
			if (rules.length >= maxRules) {
				return;
			}
			const nextIndex = rules.length;
			onChange([...rules, '']);
			setEditingIndex(nextIndex);
			inputRef.current?.focus();
			return;
		}
		commit();
	};

	const remove = (index: number) => {
		onChange(rules.filter((_, ruleIndex) => ruleIndex !== index));
		if (editingIndex === index) {
			setDraft('');
			setEditingIndex(null);
		}
	};

	const isFull = rules.length >= maxRules && editingIndex === null;

	return (
		<div className="ruleChipsEditor">
			<textarea
				ref={inputRef}
				className="ruleChipsEditor__input"
				aria-label={t('groupChat.create.authorContent.ruleEditorLabel')}
				maxLength={RULE_MAX_LENGTH}
				placeholder={t('groupChat.create.authorContent.rule')}
				value={draft}
				// At the limit a new rule has nowhere to go; a chip still opens
				// its rule for editing.
				disabled={isFull}
				onChange={(event) => updateDraft(event.target.value)}
			/>
			<div className="ruleChipsEditor__row">
				<ul className="ruleChipsEditor__chips">
					{rules.map((rule, index) => (
						<li
							key={`rule-${index}-${rule}`}
							className={`ruleChipsEditor__chip${
								editingIndex === index
									? ' ruleChipsEditor__chip--editing'
									: ''
							}`}
						>
							<button
								type="button"
								className="ruleChipsEditor__chipLabel"
								title={rule}
								aria-label={t(
									'groupChat.create.authorContent.editRule',
									{ index: index + 1 }
								)}
								onClick={() => {
									setDraft(rule);
									setEditingIndex(index);
								}}
							>
								{t(
									editingIndex === index
										? 'groupChat.create.authorContent.ruleChip'
										: 'groupChat.create.authorContent.ruleChipShort',
									{ index: index + 1 }
								)}
							</button>
							<button
								type="button"
								className="ruleChipsEditor__chipRemove"
								aria-label={t(
									'groupChat.create.authorContent.deleteRule',
									{ index: index + 1 }
								)}
								onClick={() => remove(index)}
							>
								<CloseIcon aria-hidden />
							</button>
						</li>
					))}
				</ul>
				<button
					type="button"
					className="ruleChipsEditor__add"
					aria-label={t('groupChat.create.authorContent.addRule')}
					disabled={
						isFull || (editingIndex !== null && !draft.trim())
					}
					onClick={addOrCommit}
				>
					<PlusIcon aria-hidden />
				</button>
			</div>
		</div>
	);
};
