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

/**
 * D7 (Frank, 05.09.2026 / 24.11.2026): on the phone the composer's action bar
 * leads with the back arrow, so the room header drops its own and the avatar
 * and name get the width. Where no composer is shown (an enquiry, a
 * supervisor's or read-only view, a closed conversation) the header keeps the
 * arrow — it is then the only way back to the list.
 */
export const shouldHideHeaderBackOnPhone = ({
	isPhoneLayout,
	mainComposerShown
}: {
	isPhoneLayout: boolean;
	mainComposerShown: boolean;
}): boolean => isPhoneLayout && mainComposerShown;
