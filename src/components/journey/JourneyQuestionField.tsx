import * as React from 'react';
import { useEffect, useId, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import { orisoInputColors } from '../form/orisoInputDesign';
import { TEXT_LINES, clampLines } from './journeyTextLimits';
import { OrisoSelect } from '../form/OrisoSelect';
import { OrisoTextarea } from '../form/OrisoTextarea';
import {
	OTHER_OPTION,
	choose,
	textIn,
	type JourneyQuestion,
	type QuestionAnswer
} from './journeyModel';

export interface JourneyQuestionFieldProps {
	question: JourneyQuestion;
	answer?: QuestionAnswer;
	language: string;
	onChange: (answer: QuestionAnswer) => void;
	/** Shown once the person tried to go on without a required answer. */
	showMissing?: boolean;
	disabled?: boolean;
}

const MAX_TEXT = 2000;

/** The words above an answer: the question, "optional" where it is, and its help. */
const QuestionHead = ({
	id,
	question,
	language,
	as = 'legend'
}: {
	id: string;
	question: JourneyQuestion;
	language: string;
	as?: 'legend' | 'label';
}) => {
	const { t } = useTranslation();
	const help = textIn(question.help, language);
	return (
		<Box
			component={as}
			id={id}
			sx={{ p: 0, mb: 1.5, display: 'block', width: '100%' }}
		>
			<Typography
				component="span"
				title={textIn(question.label, language)}
				sx={{
					fontSize: { xs: 18, sm: 20 },
					fontWeight: 600,
					lineHeight: { xs: '26px', sm: '28px' },
					color: orisoInputColors.onSurface,
					...clampLines(TEXT_LINES.question)
				}}
			>
				{textIn(question.label, language)}
				{!question.required && (
					<Typography
						component="span"
						sx={{
							ml: 1,
							fontSize: 14,
							fontWeight: 400,
							color: orisoInputColors.onSurfaceVariant
						}}
					>
						{t('journey.question.optional')}
					</Typography>
				)}
			</Typography>
			{help && (
				<Typography
					component="span"
					title={help}
					sx={{
						mt: 0.5,
						fontSize: 14,
						lineHeight: '20px',
						color: orisoInputColors.onSurfaceVariant,
						...clampLines(TEXT_LINES.help)
					}}
				>
					{help}
				</Typography>
			)}
		</Box>
	);
};

/**
 * One answer as a card in the look of the registration's topic cards (Frank, 2026-11-20): round,
 * large, easy to hit, lifted a little under the pointer. The whole card is the target; a real
 * radio (single choice) or checkbox (multiple choice) sits under it, so keyboard and screen
 * readers work as with any form, and the mark on the left keeps the two told apart.
 */
const ChoiceCard = ({
	type,
	name,
	label,
	checked,
	disabled,
	required,
	onSelect,
	children
}: {
	type: 'radio' | 'checkbox';
	name: string;
	label: string;
	checked: boolean;
	disabled?: boolean;
	/** A required single choice: the radios say so themselves. */
	required?: boolean;
	onSelect: () => void;
	children?: React.ReactNode;
}) => (
	<Box
		component="label"
		data-cy="journey-choice"
		data-checked={checked || undefined}
		sx={{
			'display': 'block',
			'position': 'relative',
			'borderRadius': '32px',
			'border': `${checked ? 2 : 1}px solid ${checked ? orisoInputColors.primary : orisoInputColors.outline}`,
			'margin': checked ? 0 : '1px',
			'background': checked
				? orisoInputColors.selectedLayer
				: `linear-gradient(100deg, ${orisoInputColors.surfaceContainerHigh} 0%, ${orisoInputColors.surfaceContainerLow} 90%)`,
			'cursor': disabled ? 'default' : 'pointer',
			'transition':
				'transform 240ms cubic-bezier(0.34, 1.24, 0.44, 1), box-shadow 240ms, border-color 160ms, background 160ms',
			'&:hover': disabled
				? undefined
				: {
						transform: 'translateY(-2px)',
						boxShadow: '0 12px 28px rgba(27, 27, 28, 0.10)'
					},
			'&:has(input:focus-visible)': {
				outline: `3px solid ${orisoInputColors.focus}`,
				outlineOffset: '2px'
			},
			'@media (hover: none)': {
				'&:hover': { transform: 'none', boxShadow: 'none' }
			},
			'@media (prefers-reduced-motion: reduce)': {
				'transition': 'none',
				'&:hover': { transform: 'none' }
			}
		}}
	>
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.5,
				minHeight: { xs: 54, sm: 64 },
				px: { xs: 2, sm: 2.5 },
				py: { xs: 1, sm: 1.5 }
			}}
		>
			<input
				type={type}
				name={name}
				checked={checked}
				disabled={disabled}
				required={required}
				// Its own name: the card may hold a text field, which must not become part of it.
				aria-label={label}
				// A radio that is already chosen fires no change: a tap on it must still count, so
				// a person who went back can confirm the same answer and move on.
				onChange={type === 'checkbox' ? onSelect : () => undefined}
				onClick={type === 'radio' ? onSelect : undefined}
				style={{
					position: 'absolute',
					opacity: 0,
					width: 1,
					height: 1,
					margin: 0
				}}
			/>
			<Box
				aria-hidden
				sx={{
					width: 22,
					height: 22,
					flexShrink: 0,
					display: 'grid',
					placeItems: 'center',
					borderRadius: type === 'radio' ? '50%' : '6px',
					border: `2px solid ${checked ? orisoInputColors.primary : orisoInputColors.outline}`,
					backgroundColor:
						checked && type === 'checkbox'
							? orisoInputColors.primary
							: 'transparent',
					color: orisoInputColors.onPrimary
				}}
			>
				{checked && type === 'radio' && (
					<Box
						sx={{
							width: 10,
							height: 10,
							borderRadius: '50%',
							backgroundColor: orisoInputColors.primary
						}}
					/>
				)}
				{checked && type === 'checkbox' && (
					<CheckRoundedIcon sx={{ fontSize: 16 }} />
				)}
			</Box>
			<Typography
				sx={{
					fontSize: { xs: 16, sm: 17 },
					fontWeight: 500,
					lineHeight: '24px',
					color: orisoInputColors.onSurface
				}}
			>
				{label}
			</Typography>
		</Box>
		{children}
	</Box>
);

/**
 * One question of a journey, answered in the check-in or in the chat (ORISO-Frontend#2333):
 * free text, single choice (cards or a dropdown), multiple choice, each with "something else"
 * and its own text where the editor allows it, or a hint to read.
 */
export const JourneyQuestionField = ({
	question,
	answer,
	language,
	onChange,
	showMissing = false,
	disabled = false
}: JourneyQuestionFieldProps) => {
	const { t } = useTranslation();
	const headId = useId();
	const errorId = useId();
	const name = useId();
	const otherRef = useRef<HTMLInputElement>(null);
	const choices = answer?.choices ?? [];
	const otherChosen = choices.includes(OTHER_OPTION);
	const wasOther = useRef(otherChosen);

	// Choosing "something else" opens its text field and puts the cursor there.
	useEffect(() => {
		if (otherChosen && !wasOther.current) otherRef.current?.focus();
		wasOther.current = otherChosen;
	}, [otherChosen]);

	if (question.type === 'hint') {
		return (
			<Box
				role="note"
				sx={{
					display: 'flex',
					gap: 1.5,
					p: 2,
					borderRadius: '12px',
					backgroundColor: orisoInputColors.surfaceContainer,
					color: orisoInputColors.onSurface
				}}
			>
				<InfoOutlinedIcon
					aria-hidden
					sx={{ color: orisoInputColors.onSurfaceVariant }}
				/>
				<Box>
					<Typography sx={{ fontWeight: 600 }}>
						{textIn(question.label, language)}
					</Typography>
					{textIn(question.help, language) && (
						<Typography
							sx={{
								mt: 0.5,
								fontSize: 14,
								color: orisoInputColors.onSurfaceVariant
							}}
						>
							{textIn(question.help, language)}
						</Typography>
					)}
				</Box>
			</Box>
		);
	}

	const missingText = showMissing ? t('journey.question.missing') : undefined;
	const missing = missingText && (
		<Typography
			id={errorId}
			role="alert"
			sx={{ mt: 1, fontSize: 14, color: orisoInputColors.error }}
		>
			{missingText}
		</Typography>
	);

	if (question.type === 'text') {
		return (
			<Box
				data-cy="journey-question"
				data-question-id={question.id}
				data-question-type="text"
			>
				<QuestionHead
					id={headId}
					question={question}
					language={language}
					as="label"
				/>
				<OrisoTextarea
					fullWidth
					minRows={3}
					disabled={disabled}
					value={answer?.text ?? ''}
					onChange={(event) =>
						onChange({
							text: event.target.value.slice(0, MAX_TEXT)
						})
					}
					placeholder={t('journey.question.textPlaceholder')}
					inputProps={{
						'aria-labelledby': headId,
						'aria-required': question.required,
						'aria-invalid': Boolean(missingText),
						'aria-describedby': missingText ? errorId : undefined
					}}
					sx={{ '&': { marginTop: 0 } }}
				/>
				{missing}
			</Box>
		);
	}

	const otherLabel = t('journey.question.other');
	/*
	 * "Etwas anderes" brings its text area along at once, so the person can just start typing
	 * (Frank, 2026-11-20); typing picks the option. Clicks in it stay in it: the card around it
	 * is a label and would toggle the option otherwise.
	 */
	const otherField = (
		<Box
			sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 1.25, sm: 1.75 } }}
			onClick={(event) => event.preventDefault()}
		>
			<OrisoTextarea
				inputRef={otherRef}
				fullWidth
				minRows={1}
				maxRows={4}
				disabled={disabled}
				value={otherChosen ? (answer?.text ?? '') : ''}
				placeholder={t('journey.question.otherPlaceholder')}
				onChange={(event) => {
					const text = event.target.value.slice(0, MAX_TEXT);
					const picked = otherChosen
						? { choices }
						: choose(question, answer, OTHER_OPTION);
					onChange({ ...picked, text });
				}}
				inputProps={{
					'aria-label': t('journey.question.otherPlaceholder')
				}}
				sx={{ '&': { marginTop: 0 } }}
			/>
		</Box>
	);

	if (question.type === 'single' && question.display === 'dropdown') {
		return (
			<Box
				data-cy="journey-question"
				data-question-id={question.id}
				data-question-type="dropdown"
			>
				<QuestionHead
					id={headId}
					question={question}
					language={language}
					as="label"
				/>
				<OrisoSelect
					label={t('journey.question.choose')}
					disabled={disabled}
					value={choices[0] ?? ''}
					onChange={(event) =>
						onChange(choose(question, answer, event.target.value))
					}
					required={question.required}
					// The question above names the field; "Bitte auswählen" only floats in it.
					SelectDisplayProps={
						{
							'aria-labelledby': headId
						} as React.HTMLAttributes<HTMLDivElement>
					}
					options={[
						...question.options.map((option) => ({
							value: option.id,
							label: textIn(option.label, language)
						})),
						...(question.other
							? [{ value: OTHER_OPTION, label: otherLabel }]
							: [])
					]}
				/>
				{otherChosen && (
					<Box sx={{ mt: 1.5, mx: -2.5 }}>{otherField}</Box>
				)}
				{missing}
			</Box>
		);
	}

	const type = question.type === 'multi' ? 'checkbox' : 'radio';
	return (
		<Box
			component="fieldset"
			data-cy="journey-question"
			data-question-id={question.id}
			data-question-type={question.type}
			aria-describedby={missingText ? errorId : undefined}
			sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}
		>
			<QuestionHead id={headId} question={question} language={language} />
			{question.type === 'multi' && (
				<Typography
					sx={{
						mt: -1,
						mb: 1.5,
						fontSize: 14,
						color: orisoInputColors.onSurfaceVariant
					}}
				>
					{t('journey.question.multiHint')}
				</Typography>
			)}
			<Box sx={{ display: 'grid', gap: 1 }}>
				{question.options.map((option) => (
					<ChoiceCard
						key={option.id}
						type={type}
						name={name}
						label={textIn(option.label, language)}
						checked={choices.includes(option.id)}
						disabled={disabled}
						required={question.required && type === 'radio'}
						onSelect={() =>
							onChange(choose(question, answer, option.id))
						}
					/>
				))}
				{question.other && (
					<ChoiceCard
						type={type}
						name={name}
						label={otherLabel}
						checked={otherChosen}
						disabled={disabled}
						required={question.required && type === 'radio'}
						onSelect={() =>
							onChange(choose(question, answer, OTHER_OPTION))
						}
					>
						{otherField}
					</ChoiceCard>
				)}
			</Box>
			{missing}
		</Box>
	);
};
