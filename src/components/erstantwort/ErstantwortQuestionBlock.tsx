import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import {
	Checkbox,
	FormControl,
	FormControlLabel,
	FormGroup,
	FormHelperText,
	FormLabel,
	Radio,
	RadioGroup
} from '@mui/material';
import { OrisoSelect } from '../form/OrisoSelect';
import { OrisoTextarea } from '../form/OrisoTextarea';
import type {
	ErstantwortQuestion,
	ErstantwortQuestionsSection
} from './erstantwortModulePayload';

/**
 * One answer as it leaves the chat: the question id **and its version**, so a
 * later edit of the question never changes what an old answer meant
 * (ADR-035 decision 9).
 */
export interface ErstantwortAnswer {
	questionId: string;
	version: number;
	value: string | string[];
}

export interface ErstantwortQuestionBlockProps {
	section: ErstantwortQuestionsSection;
	/** No handler, no send button — same rule as the Erstantwort actions. */
	onAnswer?: (sectionId: string, answers: ErstantwortAnswer[]) => void;
	/** Live state: the block was answered earlier (read by the caller, never stored in the event). */
	answered?: boolean;
}

type Values = Record<string, string | string[]>;

const isEmpty = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value.length === 0 : !value?.trim();

/**
 * The question block of a version-2 Erstantwort (ADR-035 part B): free text,
 * single select as radio buttons or a select field, multi select, and hints.
 *
 * A plain form inside the Carimat bubble, not a dialog: the person keeps the
 * conversation in view and can scroll past it. Required questions are marked
 * in words, not colour alone, and a failed send names every open question.
 */
export const ErstantwortQuestionBlock: React.FC<
	ErstantwortQuestionBlockProps
> = ({ section, onAnswer, answered = false }) => {
	const { t } = useTranslation();
	const baseId = useId();
	const formRef = useRef<HTMLFormElement>(null);
	const [values, setValues] = useState<Values>({});
	const [missing, setMissing] = useState<Set<string>>(new Set());
	const [sent, setSent] = useState(false);

	const done = answered || sent;
	const answerable = section.questions.filter(
		(question) => question.type !== 'hint'
	);

	const setValue = (questionId: string, value: string | string[]) => {
		setValues((current) => ({ ...current, [questionId]: value }));
		setMissing((current) => {
			if (!current.has(questionId)) return current;
			const next = new Set(current);
			next.delete(questionId);
			return next;
		});
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!onAnswer) return;
		const open = answerable
			.filter(
				(question) => question.required && isEmpty(values[question.id])
			)
			.map((question) => question.id);
		if (open.length) {
			setMissing(new Set(open));
			const first = formRef.current?.querySelector<HTMLElement>(
				`[data-question-id="${open[0]}"] :is(input, textarea, [role="combobox"])`
			);
			first?.focus();
			return;
		}
		onAnswer(
			section.id,
			answerable
				.filter((question) => !isEmpty(values[question.id]))
				.map((question) => ({
					questionId: question.id,
					version: question.version,
					value: values[question.id]
				}))
		);
		setSent(true);
	};

	if (done) {
		return (
			<p className="erstantwort__questionsDone" role="status">
				<CheckCircleOutlineRoundedIcon aria-hidden="true" />
				{t('erstantwort.questions.thanks', 'Danke für Ihre Antworten.')}
			</p>
		);
	}

	const fieldId = (question: ErstantwortQuestion) =>
		`${baseId}-${question.id}`;

	/* The required mark is part of the label text, so it is read out and not
	   carried by colour or an asterisk alone. */
	const labelText = (question: ErstantwortQuestion) =>
		question.required
			? `${question.label} (${t('erstantwort.questions.requiredMark', 'Pflichtangabe')})`
			: question.label;

	const errorText = t(
		'erstantwort.questions.required',
		'Bitte beantworten Sie diese Frage.'
	);

	/* Help text, replaced by the error while the question is still open. */
	const helperText = (question: ErstantwortQuestion) =>
		missing.has(question.id) ? errorText : question.help;

	const renderQuestion = (question: ErstantwortQuestion) => {
		const id = fieldId(question);
		const invalid = missing.has(question.id);

		if (question.type === 'hint') {
			return (
				<p className="erstantwort__questionHint">{question.label}</p>
			);
		}

		if (question.type === 'text') {
			return (
				<>
					<FormLabel
						htmlFor={id}
						error={invalid}
						className="erstantwort__questionLabel"
					>
						{labelText(question)}
					</FormLabel>
					<OrisoTextarea
						id={id}
						value={(values[question.id] as string) ?? ''}
						error={invalid}
						helperText={helperText(question)}
						minRows={3}
						fullWidth
						onChange={(event) =>
							setValue(question.id, event.target.value)
						}
					/>
				</>
			);
		}

		if (question.type === 'single' && question.display === 'dropdown') {
			return (
				<OrisoSelect
					id={id}
					labelAbove
					placeholder={t(
						'erstantwort.questions.choose',
						'Bitte wählen'
					)}
					label={labelText(question)}
					value={(values[question.id] as string) ?? ''}
					error={invalid}
					helperText={helperText(question)}
					options={question.options.map((option) => ({
						value: option.id,
						label: option.label
					}))}
					onChange={(event) =>
						setValue(question.id, event.target.value)
					}
				/>
			);
		}

		const legendId = `${id}-legend`;
		const helper = helperText(question);
		const helperId = helper ? `${id}-helper` : undefined;
		const legend = (
			<FormLabel
				id={legendId}
				component="legend"
				className="erstantwort__questionLabel"
			>
				{labelText(question)}
			</FormLabel>
		);
		const helperNode = helper ? (
			<FormHelperText id={helperId} error={invalid}>
				{helper}
			</FormHelperText>
		) : null;

		if (question.type === 'single') {
			return (
				<FormControl component="fieldset" error={invalid} fullWidth>
					{legend}
					<RadioGroup
						name={id}
						value={(values[question.id] as string) ?? ''}
						aria-labelledby={legendId}
						aria-describedby={helperId}
						aria-invalid={invalid || undefined}
						onChange={(_, value) => setValue(question.id, value)}
					>
						{question.options.map((option) => (
							<FormControlLabel
								key={option.id}
								value={option.id}
								control={<Radio />}
								label={option.label}
							/>
						))}
					</RadioGroup>
					{helperNode}
				</FormControl>
			);
		}

		const selected = Array.isArray(values[question.id])
			? (values[question.id] as string[])
			: [];
		return (
			<FormControl component="fieldset" error={invalid} fullWidth>
				{legend}
				<FormGroup
					role="group"
					aria-labelledby={legendId}
					aria-describedby={helperId}
				>
					{question.options.map((option) => (
						<FormControlLabel
							key={option.id}
							label={option.label}
							control={
								<Checkbox
									checked={selected.includes(option.id)}
									onChange={(event) =>
										setValue(
											question.id,
											question.options
												.map((entry) => entry.id)
												.filter((entryId) =>
													entryId === option.id
														? event.target.checked
														: selected.includes(
																entryId
															)
												)
										)
									}
								/>
							}
						/>
					))}
				</FormGroup>
				{helperNode}
			</FormControl>
		);
	};

	return (
		<form
			ref={formRef}
			className="erstantwort__questionForm"
			onSubmit={submit}
			noValidate
		>
			{section.questions.map((question) => (
				<div
					key={question.id}
					className="erstantwort__question"
					data-question-id={question.id}
				>
					{renderQuestion(question)}
				</div>
			))}
			{onAnswer && answerable.length > 0 && (
				<button type="submit" className="erstantwort__action">
					{t('erstantwort.questions.send', 'Antworten senden')}
				</button>
			)}
		</form>
	);
};
