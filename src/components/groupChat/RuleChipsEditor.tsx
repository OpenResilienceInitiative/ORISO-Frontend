import * as React from 'react';
import { useEffect, useState } from 'react';
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

	useEffect(() => {
		setDraft('');
		setEditingIndex(null);
	}, [resetKey]);

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
				className="ruleChipsEditor__input"
				aria-label={t('groupChat.create.authorContent.ruleEditorLabel')}
				maxLength={RULE_MAX_LENGTH}
				placeholder={t('groupChat.create.authorContent.rule')}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
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
								{t('groupChat.create.authorContent.ruleChip', {
									index: index + 1
								})}
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
					disabled={!draft.trim() || isFull}
					onClick={commit}
				>
					<PlusIcon aria-hidden />
				</button>
			</div>
		</div>
	);
};
