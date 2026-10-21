/** Classification only. The backend authorizes the actual encrypted event. */
export const resolveFeedbackMailIntent = ({
	explicitFeedbackComposer = false,
	supervisorFeedbackAction = false,
	teamDiscussion = false,
	retry
}: {
	explicitFeedbackComposer?: boolean;
	supervisorFeedbackAction?: boolean;
	teamDiscussion?: boolean;
	retry?: { feedbackMailIntent?: boolean };
}): boolean =>
	!teamDiscussion &&
	(retry
		? retry.feedbackMailIntent === true
		: explicitFeedbackComposer || supervisorFeedbackAction);
