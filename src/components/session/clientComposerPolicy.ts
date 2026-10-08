export const canRenderClientComposer = ({
	canWriteMessage,
	isSupervisor,
	shouldBlockAnonymousInquiryChat
}: {
	canWriteMessage: boolean;
	isSupervisor: boolean;
	shouldBlockAnonymousInquiryChat: boolean;
}): boolean =>
	canWriteMessage && !isSupervisor && !shouldBlockAnonymousInquiryChat;
