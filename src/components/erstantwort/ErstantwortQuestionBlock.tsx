import * as React from 'react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
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
				`[data-question-id="${open[0]}"] input, [data-question-id="${open[0]}"] select, [data-question-id="${open[0]}"] textarea`
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

	const requiredLabel = (
		<span className="erstantwort__questionRequired">
			{` (${t('erstantwort.questions.requiredMark', 'Pflichtangabe')})`}
		</span>
	);

	const errorFor = (question: ErstantwortQuestion) =>
		missing.has(question.id) ? (
			<p
				id={`${fieldId(question)}-error`}
				className="erstantwort__questionError"
			>
				{t(
					'erstantwort.questions.required',
					'Bitte beantworten Sie diese Frage.'
				)}
			</p>
		) : null;

	const describedBy = (question: ErstantwortQuestion) =>
		[
			question.help ? `${fieldId(question)}-help` : null,
			missing.has(question.id) ? `${fieldId(question)}-error` : null
		]
			.filter(Boolean)
			.join(' ') || undefined;

	const help = (question: ErstantwortQuestion) =>
		question.help ? (
			<p
				id={`${fieldId(question)}-help`}
				className="erstantwort__questionHelp"
			>
				{question.help}
			</p>
		) : null;

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
					<label htmlFor={id} className="erstantwort__questionLabel">
						{question.label}
						{question.required && requiredLabel}
					</label>
					{help(question)}
					<textarea
						id={id}
						className="erstantwort__questionInput"
						rows={3}
						value={(values[question.id] as string) ?? ''}
						aria-invalid={invalid || undefined}
						aria-describedby={describedBy(question)}
						onChange={(event) =>
							setValue(question.id, event.target.value)
						}
					/>
					{errorFor(question)}
				</>
			);
		}

		if (question.type === 'single' && question.display === 'dropdown') {
			return (
				<>
					<label htmlFor={id} className="erstantwort__questionLabel">
						{question.label}
						{question.required && requiredLabel}
					</label>
					{help(question)}
					<select
						id={id}
						className="erstantwort__questionInput"
						value={(values[question.id] as string) ?? ''}
						aria-invalid={invalid || undefined}
						aria-describedby={describedBy(question)}
						onChange={(event) =>
							setValue(question.id, event.target.value)
						}
					>
						<option value="">
							{t('erstantwort.questions.choose', 'Bitte wählen')}
						</option>
						{question.options.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
					{errorFor(question)}
				</>
			);
		}

		const multi = question.type === 'multi';
		const current = values[question.id];
		const selected = new Set(
			Array.isArray(current) ? current : current ? [current] : []
		);
		return (
			<fieldset
				className="erstantwort__questionGroup"
				role={multi ? 'group' : 'radiogroup'}
				aria-labelledby={`${id}-legend`}
				aria-invalid={invalid || undefined}
				aria-describedby={describedBy(question)}
			>
				<legend
					id={`${id}-legend`}
					className="erstantwort__questionLabel"
				>
					{question.label}
					{question.required && requiredLabel}
				</legend>
				{help(question)}
				{question.options.map((option) => (
					<label
						key={option.id}
						className="erstantwort__questionOption"
					>
						<input
							type={multi ? 'checkbox' : 'radio'}
							name={id}
							value={option.id}
							checked={selected.has(option.id)}
							onChange={(event) => {
								if (!multi) {
									setValue(question.id, option.id);
									return;
								}
								const next = new Set(selected);
								if (event.target.checked) next.add(option.id);
								else next.delete(option.id);
								setValue(
									question.id,
									question.options
										.map((entry) => entry.id)
										.filter((entryId) => next.has(entryId))
								);
							}}
						/>
						<span>{option.label}</span>
					</label>
				))}
				{errorFor(question)}
			</fieldset>
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
