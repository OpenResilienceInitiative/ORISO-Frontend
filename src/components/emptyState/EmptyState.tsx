import * as React from 'react';
import archiveAnimation from '../../resources/animations/emptyStates/archive.json';
import conversationHistoryAnimation from '../../resources/animations/emptyStates/conversation_history.json';
import conversationNothingToDoAnimation from '../../resources/animations/emptyStates/conversation_nothing_to_do.json';
import inquiryAnimation from '../../resources/animations/emptyStates/inquiry_json.json';
import noConversationsAnimation from '../../resources/animations/emptyStates/no_conversations.json';
import { EmptyStateAnimation } from './EmptyStateAnimation';
import './emptyState.styles';

export type EmptyStateVariant =
	| 'archive'
	| 'conversation-history'
	| 'conversation-nothing-to-do'
	| 'inquiry'
	| 'no-conversations';

const animationByVariant: Record<EmptyStateVariant, Record<string, any>> = {
	'archive': archiveAnimation,
	'conversation-history': conversationHistoryAnimation,
	'conversation-nothing-to-do': conversationNothingToDoAnimation,
	'inquiry': inquiryAnimation,
	'no-conversations': noConversationsAnimation
};

interface EmptyStateProps {
	headline: string;
	variant: EmptyStateVariant;
	className?: string;
}

export const EmptyState = ({
	headline,
	variant,
	className = ''
}: EmptyStateProps) => (
	<div
		aria-live="polite"
		className={`emptyState emptyState--${variant} ${className}`.trim()}
		data-cy="empty-state"
		data-empty-state={variant}
	>
		<EmptyStateAnimation
			animationData={animationByVariant[variant]}
			variant={variant}
		/>
		<p className="emptyState__headline">{headline}</p>
	</div>
);
