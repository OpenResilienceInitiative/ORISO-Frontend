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
import { OrisoTextField } from '../form/OrisoTextField';
import type {
	ErstantwortQuestion,
	ErstantwortQuestionsSection
} from './erstantwortModulePayload';

/**
 * One answer as it leaves the chat: the question id **and its version**, so a
 * later edit of the question never changes what an old answer meant
 * (ADR-036 decision 9).
 */
export interface ErstantwortAnswer {
	questionId: string;
	version: number;
	value: string | string[];
	/** The text of "Etwas anderes", when that option is among the value. */
	other?: string;
}

/** The value that stands for "Etwas anderes"; never an option id the configurator issues. */
export const OTHER_OPTION = '__other';

export interface ErstantwortQuestionBlockProps {
	section: ErstantwortQuestionsSection;
	/**
	 * No handler, no send button — same rule as the Erstantwort actions. A returned promise is
	 * awaited: the block thanks only after it resolved, and keeps the answers when it rejects.
	 */
	onAnswer?: (
		sectionId: string,
		answers: ErstantwortAnswer[]
	) => void | Promise<void>;
	/** Live state: the block was answered earlier (read by the caller, never stored in the event). */
	answered?: boolean;
}

type Values = Record<string, string | string[]>;

/** Question ids are free text from the payload, so a key such as `constructor` must not read Object.prototype. */
const own = <T,>(store: Record<string, T>, key: string): T | undefined =>
	Object.hasOwn(store, key) ? store[key] : undefined;

const isEmpty = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value.length === 0 : !value?.trim();

const choseOther = (value: string | string[] | undefined) =>
	Array.isArray(value)
		? value.includes(OTHER_OPTION)
		: value === OTHER_OPTION;

/**
 * The question block of a version-2 Erstantwort (ADR-036 part B): free text,
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
	const [others, setOthers] = useState<Record<string, string>>({});
	const [sent, setSent] = useState(false);
	const [sending, setSending] = useState(false);
	const [failed, setFailed] = useState(false);

	const done = answered || sent;
	const answerable = section.questions.filter(
		(question) => question.type !== 'hint'
	);

	const clearMissing = (questionId: string) => {
		setMissing((current) => {
			if (!current.has(questionId)) return current;
			const next = new Set(current);
			next.delete(questionId);
			return next;
		});
	};

	const setValue = (questionId: string, value: string | string[]) => {
		setValues((current) => ({ ...current, [questionId]: value }));
		clearMissing(questionId);
	};

	const otherBlank = (questionId: string) =>
		choseOther(own(values, questionId)) && !own(others, questionId)?.trim();

	/* Nothing chosen yet. A blank "Etwas anderes" is a separate problem: the other choices still count. */
	const isUnanswered = (questionId: string) =>
		isEmpty(own(values, questionId));

	const blocksSend = (question: ErstantwortQuestion) =>
		(question.required && isUnanswered(question.id)) ||
		otherBlank(question.id);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!onAnswer || sending) return;
		const open = answerable
			.filter(blocksSend)
			.map((question) => question.id);
		if (open.length) {
			setMissing(new Set(open));
			const wrapper = Array.from(
				formRef.current?.querySelectorAll<HTMLElement>(
					'[data-question-id]'
				) ?? []
			).find((node) => node.dataset.questionId === open[0]);
			wrapper
				?.querySelector<HTMLElement>(
					'input:not([aria-hidden="true"]), textarea:not([aria-hidden="true"]), [role="combobox"]'
				)
				?.focus();
			return;
		}
		setSending(true);
		setFailed(false);
		try {
			const answers: ErstantwortAnswer[] = [];
			for (const question of answerable) {
				const value = own(values, question.id);
				if (isUnanswered(question.id) || value === undefined) continue;
				const otherText = own(others, question.id)?.trim();
				answers.push({
					questionId: question.id,
					version: question.version,
					value,
					...(choseOther(value) && otherText
						? { other: otherText }
						: {})
				});
			}
			await onAnswer(section.id, answers);
			setSent(true);
		} catch {
			// The answers stay; the person can send again.
			setFailed(true);
		} finally {
			setSending(false);
		}
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

	const otherLabel = t('erstantwort.questions.other', 'Etwas anderes');
	/* The text of "Etwas anderes", right under the choice once it is picked. */
	const otherField = (question: ErstantwortQuestion) =>
		choseOther(own(values, question.id)) ? (
			<OrisoTextField
				fullWidth
				size="small"
				disabled={sending}
				value={own(others, question.id) ?? ''}
				placeholder={t(
					'erstantwort.questions.otherPlaceholder',
					'Was genau?'
				)}
				inputProps={{
					'aria-label': t(
						'erstantwort.questions.otherPlaceholder',
						'Was genau?'
					)
				}}
				onChange={(event) => {
					setOthers((current) => ({
						...current,
						[question.id]: event.target.value
					}));
					clearMissing(question.id);
				}}
			/>
		) : null;
	const otherOption = (question: ErstantwortQuestion) =>
		question.other ? [{ id: OTHER_OPTION, label: otherLabel }] : [];

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
						disabled={sending}
						value={(own(values, question.id) as string) ?? ''}
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
				<>
					<OrisoSelect
						id={id}
						disabled={sending}
						labelAbove
						placeholder={t(
							'erstantwort.questions.choose',
							'Bitte wählen'
						)}
						label={labelText(question)}
						value={(own(values, question.id) as string) ?? ''}
						error={invalid}
						helperText={helperText(question)}
						options={[
							...question.options,
							...otherOption(question)
						].map((option) => ({
							value: option.id,
							label: option.label
						}))}
						onChange={(event) =>
							setValue(question.id, event.target.value)
						}
					/>
					{otherField(question)}
				</>
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
						value={(own(values, question.id) as string) ?? ''}
						aria-labelledby={legendId}
						aria-describedby={helperId}
						aria-invalid={invalid || undefined}
						onChange={(_, value) => setValue(question.id, value)}
					>
						{[...question.options, ...otherOption(question)].map(
							(option) => (
								<FormControlLabel
									key={option.id}
									value={option.id}
									control={<Radio disabled={sending} />}
									label={option.label}
								/>
							)
						)}
					</RadioGroup>
					{otherField(question)}
					{helperNode}
				</FormControl>
			);
		}

		const stored = own(values, question.id);
		const selected = Array.isArray(stored) ? stored : [];
		return (
			<FormControl component="fieldset" error={invalid} fullWidth>
				{legend}
				<FormGroup
					role="group"
					aria-labelledby={legendId}
					aria-describedby={helperId}
				>
					{[...question.options, ...otherOption(question)].map(
						(option) => (
							<FormControlLabel
								key={option.id}
								label={option.label}
								control={
									<Checkbox
										disabled={sending}
										checked={selected.includes(option.id)}
										inputProps={{
											'aria-invalid':
												invalid || undefined,
											...(helperId
												? {
														'aria-describedby':
															helperId
													}
												: {})
										}}
										onChange={(event) =>
											setValue(
												question.id,
												event.target.checked
													? [...selected, option.id]
													: selected.filter(
															(entryId) =>
																entryId !==
																option.id
														)
											)
										}
									/>
								}
							/>
						)
					)}
				</FormGroup>
				{otherField(question)}
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
			{failed && (
				<p className="erstantwort__questionsFailed" role="alert">
					{t(
						'erstantwort.questions.failed',
						'Das hat nicht geklappt. Ihre Antworten sind noch da – bitte versuchen Sie es gleich noch einmal.'
					)}
				</p>
			)}
			{onAnswer && answerable.length > 0 && (
				<button
					type="submit"
					className="erstantwort__action"
					disabled={sending}
					aria-busy={sending || undefined}
				>
					{t('erstantwort.questions.send', 'Antworten senden')}
				</button>
			)}
		</form>
	);
};
