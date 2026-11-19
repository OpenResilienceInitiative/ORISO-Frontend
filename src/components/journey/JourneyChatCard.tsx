import * as React from 'react';
import { useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from 'react-i18next';
import {
	CarimatMessageBubble,
	CarimatMessageFrame
} from '../carimat/CarimatMessageFrame';
import { orisoInputColors } from '../form/orisoInputDesign';
import { JourneyStepForm } from './JourneyStepForm';
import {
	answerSummary,
	emptyAnswers,
	missingRequired,
	textIn,
	type JourneyPhase,
	type JourneyStep,
	type StepAnswers
} from './journeyModel';

export interface JourneyChatCardProps {
	step: JourneyStep;
	/** `flight` while counselling, `arrival` after it (the follow-up survey). */
	phase: Exclude<JourneyPhase, 'departure'>;
	language: string;
	/** What was sent already: the card shows it folded and asks nothing again. */
	sent?: StepAnswers;
	/** Sends the answers; rejects to keep the card open with a message. */
	onSubmit: (answers: StepAnswers) => Promise<void>;
	/** Arrival with an anonymous survey: say that the answers are not tied to the conversation. */
	anonymous?: boolean;
}

/**
 * A journey step asked in the chat, presented by the assistant (ORISO-Frontend#2333): questions
 * and ratings in one card, "send" checks the required ones first, and once sent the card folds to
 * a short summary — nothing is asked twice, nothing is lost on a failed send.
 */
export const JourneyChatCard = ({
	step,
	phase,
	language,
	sent,
	onSubmit,
	anonymous = false
}: JourneyChatCardProps) => {
	const { t } = useTranslation();
	const [answers, setAnswers] = useState<StepAnswers>(emptyAnswers);
	const [showMissing, setShowMissing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const title = textIn(step.title, language);
	const description = textIn(step.description, language);
	const otherLabel = t('journey.question.other');

	const formRef = useRef<HTMLDivElement>(null);
	const submit = async () => {
		const open = missingRequired(step, answers);
		if (open.length > 0) {
			setShowMissing(true);
			// Straight to the first open question, so the person sees what is missing.
			formRef.current
				?.querySelector<HTMLElement>(
					`[data-question-id="${open[0]}"] :is(input, textarea, [role="combobox"])`
				)
				?.focus();
			return;
		}
		setBusy(true);
		setFailed(false);
		try {
			await onSubmit(answers);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};

	return (
		<CarimatMessageFrame
			data-cy="journey-chat-card"
			data-phase={phase}
			subtitle={t(`journey.chat.subtitle.${phase}`)}
		>
			<CarimatMessageBubble variant="guidance">
				<Box sx={{ display: 'grid', gap: 2 }}>
					{title && (
						<Typography
							component="h3"
							sx={{
								fontSize: 18,
								fontWeight: 700,
								lineHeight: '26px',
								color: orisoInputColors.onSurface
							}}
						>
							{title}
						</Typography>
					)}
					{description && (
						<Typography
							sx={{ color: orisoInputColors.onSurfaceVariant }}
						>
							{description}
						</Typography>
					)}
					{sent ? (
						<Box
							data-cy="journey-chat-sent"
							sx={{ display: 'grid', gap: 1 }}
						>
							<Typography
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									fontWeight: 600,
									color: orisoInputColors.onSurface
								}}
							>
								<CheckCircleRoundedIcon
									aria-hidden
									sx={{ color: orisoInputColors.primary }}
								/>
								{t('journey.chat.thanks')}
							</Typography>
							<Box
								component="dl"
								sx={{ m: 0, display: 'grid', gap: 0.75 }}
							>
								{answerSummary(
									step,
									sent,
									language,
									otherLabel
								).map((line) => (
									<Box
										key={line.id}
										sx={{
											display: 'grid',
											gridTemplateColumns: {
												xs: '1fr',
												sm: 'minmax(0, 2fr) minmax(0, 3fr)'
											},
											gap: { xs: 0, sm: 2 }
										}}
									>
										<Typography
											component="dt"
											sx={{
												fontSize: 14,
												color: orisoInputColors.onSurfaceVariant
											}}
										>
											{line.label}
										</Typography>
										<Typography
											component="dd"
											sx={{
												m: 0,
												fontSize: 14,
												color: orisoInputColors.onSurface
											}}
										>
											{line.value}
										</Typography>
									</Box>
								))}
							</Box>
						</Box>
					) : (
						<>
							<Box ref={formRef}>
								<JourneyStepForm
									step={step}
									answers={answers}
									language={language}
									showMissing={showMissing}
									disabled={busy}
									onChange={setAnswers}
								/>
							</Box>
							{phase === 'arrival' && anonymous && (
								<Typography
									sx={{
										fontSize: 14,
										color: orisoInputColors.onSurfaceVariant
									}}
								>
									{t('journey.chat.anonymous')}
								</Typography>
							)}
							{failed && (
								<Typography
									role="alert"
									sx={{
										fontSize: 14,
										color: orisoInputColors.error
									}}
								>
									{t('journey.chat.failed')}
								</Typography>
							)}
							<Box>
								<Button
									variant="contained"
									disableElevation
									onClick={submit}
									disabled={busy}
									startIcon={
										busy ? (
											<CircularProgress
												size={18}
												color="inherit"
											/>
										) : undefined
									}
									sx={{
										'borderRadius': 100,
										'px': 3,
										'minHeight': 48,
										'textTransform': 'none',
										'fontSize': 16,
										'fontWeight': 600,
										'backgroundColor':
											orisoInputColors.primary,
										'color': orisoInputColors.onPrimary,
										'&:hover': {
											backgroundColor:
												orisoInputColors.primaryDark
										}
									}}
								>
									{t('journey.chat.send')}
								</Button>
							</Box>
						</>
					)}
				</Box>
			</CarimatMessageBubble>
		</CarimatMessageFrame>
	);
};
