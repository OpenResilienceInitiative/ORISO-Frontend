import * as React from 'react';
import { useTranslation } from 'react-i18next';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
	CarimatMessageBubble,
	CarimatMessageFrame
} from '../carimat/CarimatMessageFrame';
import type {
	ErstantwortFixedModule,
	ErstantwortPanelSection,
	ErstantwortQuestionsSection,
	ErstantwortSection
} from './erstantwortModulePayload';
import {
	ErstantwortQuestionBlock,
	type ErstantwortAnswer
} from './ErstantwortQuestionBlock';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * ADR-035: renders a **version-2** Erstantwort — the resolved conversation
 * module — in exactly the order the editor arranged it.
 *
 * Grouping keeps Frank's "one complete message" rule from version 1 (15.10.):
 * consecutive messages and panels share one Carimat bubble. A fixed module or
 * a question block is something the person does, so it gets its own bubble
 * and splits the message there.
 *
 * Nothing is re-resolved here: the wording arrives frozen in the event. The
 * only live inputs are completion state — which blocks were answered, whether
 * a counsellor has replied yet — and the fixed modules themselves, which the
 * caller supplies as `slots` because their data comes from the system.
 */
export interface ErstantwortModuleSequenceProps {
	sections: ErstantwortSection[];
	/**
	 * Platform components by module id (`email`, `consent`,
	 * `accountCompletion`). A fixed section without a slot renders nothing —
	 * an empty card would promise something the chat cannot do.
	 */
	slots?: Partial<Record<ErstantwortFixedModule, React.ReactNode>>;
	onAnswer?: (sectionId: string, answers: ErstantwortAnswer[]) => void;
	/** Live state: question blocks already answered. */
	answeredSectionIds?: string[];
	/** Live state: releases blocks whose trigger is "after the first reply". */
	counsellorReplied?: boolean;
	/** Sender shown in the kicker line; defaults to the platform name. */
	name?: string;
	subtitle?: string;
}

type Bubble =
	| { key: string; kind: 'message'; sections: ErstantwortSection[] }
	| {
			key: string;
			kind: 'fixed';
			section: ErstantwortSection & { kind: 'fixed' };
	  }
	| { key: string; kind: 'questions'; section: ErstantwortQuestionsSection };

const toBubbles = (
	sections: ErstantwortSection[],
	hasSlot: (module: ErstantwortFixedModule) => boolean,
	counsellorReplied: boolean
): Bubble[] =>
	sections.reduce<Bubble[]>((bubbles, section) => {
		if (section.kind === 'message' || section.kind === 'panel') {
			const last = bubbles[bubbles.length - 1];
			if (last?.kind === 'message') {
				last.sections.push(section);
			} else {
				bubbles.push({
					key: `message-${section.id}`,
					kind: 'message',
					sections: [section]
				});
			}
			return bubbles;
		}
		if (section.kind === 'fixed') {
			if (hasSlot(section.module)) {
				bubbles.push({ key: section.id, kind: 'fixed', section });
			}
			return bubbles;
		}
		if (section.trigger === 'afterFirstReply' && !counsellorReplied) {
			return bubbles;
		}
		bubbles.push({ key: section.id, kind: 'questions', section });
		return bubbles;
	}, []);

const Panel = ({ section }: { section: ErstantwortPanelSection }) => {
	const body = (
		<p className="pseudonymCard__bubbleText erstantwort__body">
			{section.body}
		</p>
	);
	if (section.display === 'open') {
		return (
			<div className="erstantwort__part">
				<h4
					className={`erstantwort__headline${
						section.safety
							? ' erstantwort__headline--emergency'
							: ''
					}`}
				>
					{section.safety && (
						<CallRoundedIcon
							className="erstantwort__faqIcon"
							aria-hidden="true"
						/>
					)}
					{section.title}
				</h4>
				{body}
			</div>
		);
	}
	return (
		<details
			className={`erstantwort__faq${
				section.safety ? ' erstantwort__faq--emergency' : ''
			}`}
		>
			<summary>
				{section.safety && (
					<CallRoundedIcon
						className="erstantwort__faqIcon"
						aria-hidden="true"
					/>
				)}
				<span className="erstantwort__faqLabel">{section.title}</span>
				<ExpandMoreRoundedIcon
					className="erstantwort__faqChevron"
					aria-hidden="true"
				/>
			</summary>
			{body}
		</details>
	);
};

export const ErstantwortModuleSequence: React.FC<
	ErstantwortModuleSequenceProps
> = ({
	sections,
	slots,
	onAnswer,
	answeredSectionIds = [],
	counsellorReplied = false,
	name,
	subtitle
}) => {
	const { t } = useTranslation();
	const bubbles = toBubbles(
		sections,
		(module) => slots?.[module] != null,
		counsellorReplied
	);
	if (!bubbles.length) return null;

	return (
		<CarimatMessageFrame
			className="erstantwort"
			subtitle={subtitle ?? t('erstantwort.subtitle')}
			aria-live="polite"
			data-testid="erstantwort-module-sequence"
		>
			{bubbles.map((bubble, index) => {
				const topic = index === 0 ? name : undefined;
				if (bubble.kind === 'message') {
					return (
						<CarimatMessageBubble
							key={bubble.key}
							topic={topic}
							className="erstantwort__bubble erstantwort__bubble--message"
							data-testid="erstantwort-module-bubble"
						>
							{bubble.sections.map((section) => {
								if (section.kind === 'panel') {
									return (
										<Panel
											key={section.id}
											section={section}
										/>
									);
								}
								return section.kind === 'message' ? (
									<p
										key={section.id}
										className="pseudonymCard__bubbleText erstantwort__body"
									>
										{section.body}
									</p>
								) : null;
							})}
						</CarimatMessageBubble>
					);
				}
				if (bubble.kind === 'fixed') {
					return (
						<CarimatMessageBubble
							key={bubble.key}
							topic={topic}
							className="erstantwort__bubble"
							data-testid="erstantwort-module-bubble"
						>
							{bubble.section.title && (
								<h4 className="erstantwort__headline">
									{bubble.section.title}
								</h4>
							)}
							{slots?.[bubble.section.module]}
						</CarimatMessageBubble>
					);
				}
				const { section } = bubble;
				const block = (
					<ErstantwortQuestionBlock
						section={section}
						onAnswer={onAnswer}
						answered={answeredSectionIds.includes(section.id)}
					/>
				);
				const title =
					section.title ??
					t('erstantwort.questions.title', 'Ein paar Fragen');
				return (
					<CarimatMessageBubble
						key={bubble.key}
						topic={topic}
						className="erstantwort__bubble erstantwort__bubble--questions"
						data-testid="erstantwort-module-bubble"
					>
						<section
							aria-label={title}
							data-testid={`erstantwort-questions-${section.id}`}
						>
							{section.display === 'collapsed' ? (
								<details className="erstantwort__faq">
									<summary>
										<span className="erstantwort__faqLabel">
											{title}
										</span>
										<ExpandMoreRoundedIcon
											className="erstantwort__faqChevron"
											aria-hidden="true"
										/>
									</summary>
									{block}
								</details>
							) : (
								<>
									<h4 className="erstantwort__headline">
										{title}
									</h4>
									{block}
								</>
							)}
						</section>
					</CarimatMessageBubble>
				);
			})}
		</CarimatMessageFrame>
	);
};
