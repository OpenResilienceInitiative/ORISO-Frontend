import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useTranslation } from 'react-i18next';
import { StepTransition } from '../transition/StepTransition';
import { StepSegments } from '../stepper/atoms/StepSegments';
import { orisoInputColors } from '../form/orisoInputDesign';
import { JourneyQuestionField } from './JourneyQuestionField';
import { JourneyRatingField } from './JourneyRatingField';
import {
	OTHER_OPTION,
	isQuestionAnswered,
	type JourneyQuestion,
	type JourneyRating,
	type JourneyStep,
	type StepAnswers
} from './journeyModel';

/** One screen of the check-in: a question or a rating, with the hints placed before it. */
export type CheckInPage =
	| { kind: 'question'; item: JourneyQuestion; hints: JourneyQuestion[] }
	| { kind: 'rating'; item: JourneyRating; hints: JourneyQuestion[] };

/**
 * The screens of a step: one per question or rating, in order (Frank, 2026-11-20: "im Pre-Flight
 * immer eins"). A hint is not a question of its own; it travels with the question after it, or
 * with the last one when nothing follows.
 */
export const checkInPages = (step: JourneyStep): CheckInPage[] => {
	const pages: CheckInPage[] = [];
	let hints: JourneyQuestion[] = [];
	(step.questions ?? []).forEach((question) => {
		if (question.type === 'hint') {
			hints.push(question);
			return;
		}
		pages.push({ kind: 'question', item: question, hints });
		hints = [];
	});
	(step.ratings ?? []).forEach((rating) => {
		pages.push({ kind: 'rating', item: rating, hints });
		hints = [];
	});
	if (hints.length > 0 && pages.length > 0) {
		const last = pages[pages.length - 1];
		pages[pages.length - 1] = {
			...last,
			hints: [...last.hints, ...hints]
		} as CheckInPage;
	}
	return pages;
};

export const isPageAnswered = (page: CheckInPage, answers: StepAnswers) =>
	page.kind === 'question'
		? isQuestionAnswered(page.item, answers.questions[page.item.id])
		: answers.ratings[page.item.id] !== undefined;

/** A page is done when it is answered, or when it may be skipped and the person went past it. */
const pageDone = (page: CheckInPage, answers: StepAnswers) =>
	isPageAnswered(page, answers) || !page.item.required;

/** One tap answers it: a choice card or a star. Everything else waits for "Weiter". */
const answersInOneTap = (page: CheckInPage) =>
	page.kind === 'rating'
		? page.item.type === 'stars'
		: page.item.type === 'single' && page.item.display !== 'dropdown';

/** How long the chosen card stays visible before the next question slides in. */
const ADVANCE_DELAY_MS = 380;
/** A horizontal swipe longer than this goes back or on. */
const SWIPE_PX = 56;

export interface JourneyQuestionPagerProps {
	step: JourneyStep;
	answers: StepAnswers;
	language: string;
	onChange: (answers: StepAnswers) => void;
	/** Every required question of the step is answered: the registration may go on. */
	onCompleteChange?: (complete: boolean) => void;
	/** Shown above the question counter: the step's kicker, title and line (they stay on top). */
	header?: React.ReactNode;
}

/**
 * The check-in as questionnaire tools do it (ORISO-Frontend#2333, Frank 2026-11-20): one question
 * per screen, no scrolling. A one-tap answer moves on by itself, the next question slides in from
 * the right; "Zurück" or a swipe to the right goes back to change an answer. The step counts as
 * done — and the registration's own "Weiter" lights up — only when every required question is
 * answered.
 */
export const JourneyQuestionPager = ({
	header,
	step,
	answers,
	language,
	onChange,
	onCompleteChange
}: JourneyQuestionPagerProps) => {
	const { t } = useTranslation();
	const pages = checkInPages(step);
	const [index, setIndex] = useState(0);
	const page = pages[Math.min(index, pages.length - 1)];
	const complete = pages.every((candidate) => pageDone(candidate, answers));
	const isLast = index >= pages.length - 1;
	const timer = useRef<number | undefined>(undefined);
	const touchStart = useRef<number | undefined>(undefined);

	useEffect(() => onCompleteChange?.(complete), [complete, onCompleteChange]);
	useEffect(() => () => window.clearTimeout(timer.current), []);

	if (!page) return null;

	const go = (next: number) => {
		window.clearTimeout(timer.current);
		setIndex(Math.max(0, Math.min(next, pages.length - 1)));
	};
	const canGoOn = pageDone(page, answers);

	const update = (next: StepAnswers) => {
		onChange(next);
		// A one-tap answer moves on, after a moment to see what was chosen.
		// Not while "Etwas anderes" is chosen: the person is typing there.
		const typing =
			page.kind === 'question' &&
			(next.questions[page.item.id]?.choices ?? []).includes(
				OTHER_OPTION
			);
		if (
			answersInOneTap(page) &&
			!isLast &&
			!typing &&
			isPageAnswered(page, next)
		) {
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(
				() => setIndex((current) => current + 1),
				ADVANCE_DELAY_MS
			);
		}
	};

	return (
		<Box
			data-cy="journey-question-pager"
			onTouchStart={(event) => {
				touchStart.current = event.touches[0]?.clientX;
			}}
			onTouchEnd={(event) => {
				const start = touchStart.current;
				touchStart.current = undefined;
				if (start === undefined) return;
				const delta =
					(event.changedTouches[0]?.clientX ?? start) - start;
				if (delta > SWIPE_PX && index > 0) go(index - 1);
				if (delta < -SWIPE_PX && !isLast && canGoOn) go(index + 1);
			}}
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
				height: '100%',
				minHeight: 0,
				overflow: 'hidden'
			}}
		>
			{header}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1,
					minHeight: 40
				}}
			>
				<IconButton
					onClick={() => go(index - 1)}
					disabled={index === 0}
					aria-label={t('journey.checkIn.back')}
					sx={{
						visibility: index === 0 ? 'hidden' : 'visible',
						ml: -1
					}}
				>
					<ArrowBackRoundedIcon />
				</IconButton>
				<Typography
					aria-live="polite"
					sx={{
						fontSize: 14,
						fontWeight: 600,
						color: orisoInputColors.onSurfaceVariant
					}}
				>
					{t('journey.checkIn.progress', {
						current: index + 1,
						total: pages.length
					})}
				</Typography>
				<Box sx={{ ml: 'auto' }}>
					<StepSegments total={pages.length} current={index + 1} />
				</Box>
			</Box>

			{/*
			 * The question sits in the middle of the free space; when space is tight its auto
			 * margins give way and it moves up as far as it has to (Frank, 2026-11-20: not glued
			 * to the top left above a large empty area).
			 */}
			<Box
				data-cy="journey-question-area"
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column',
					// Last resort only: a question too long for the screen scrolls here rather than
					// being cut off. The text limits (journeyTextLimits) keep this from happening.
					overflowY: 'auto'
				}}
			>
				<Box sx={{ my: 'auto', width: '100%' }}>
					<StepTransition
						viewKey={`${step.id}:${page.item.id}`}
						order={index}
					>
						<Box sx={{ display: 'grid', gap: 2 }}>
							{page.hints.map((hint) => (
								<JourneyQuestionField
									key={hint.id}
									question={hint}
									language={language}
									onChange={() => undefined}
								/>
							))}
							{page.kind === 'question' ? (
								<JourneyQuestionField
									question={page.item}
									answer={answers.questions[page.item.id]}
									language={language}
									onChange={(answer) =>
										update({
											...answers,
											questions: {
												...answers.questions,
												[page.item.id]: answer
											}
										})
									}
								/>
							) : (
								<JourneyRatingField
									rating={page.item}
									value={answers.ratings[page.item.id]}
									language={language}
									onChange={(value) =>
										update({
											...answers,
											ratings: {
												...answers.ratings,
												[page.item.id]: value
											}
										})
									}
								/>
							)}
						</Box>
					</StepTransition>
				</Box>
			</Box>

			{!isLast &&
				(!answersInOneTap(page) || isPageAnswered(page, answers)) && (
					<Box>
						<Button
							variant="contained"
							disableElevation
							disabled={!canGoOn}
							onClick={() => go(index + 1)}
							sx={{
								'borderRadius': 100,
								'px': 3,
								'minHeight': 48,
								'textTransform': 'none',
								'fontSize': 16,
								'fontWeight': 600,
								'backgroundColor': orisoInputColors.primary,
								'color': orisoInputColors.onPrimary,
								'&:hover': {
									backgroundColor:
										orisoInputColors.primaryDark
								}
							}}
						>
							{isPageAnswered(page, answers) || page.item.required
								? t('journey.checkIn.next')
								: t('journey.checkIn.skip')}
						</Button>
					</Box>
				)}
			{!isLast &&
				answersInOneTap(page) &&
				!page.item.required &&
				!isPageAnswered(page, answers) && (
					<Box>
						<Button
							variant="text"
							onClick={() => go(index + 1)}
							sx={{
								textTransform: 'none',
								fontSize: 16,
								color: orisoInputColors.primary
							}}
						>
							{t('journey.checkIn.skip')}
						</Button>
					</Box>
				)}
			{isLast && complete && (
				<Typography
					role="status"
					sx={{
						fontSize: 14,
						color: orisoInputColors.onSurfaceVariant
					}}
				>
					{t('journey.checkIn.done')}
				</Typography>
			)}
		</Box>
	);
};
