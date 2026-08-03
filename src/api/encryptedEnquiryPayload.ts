export const buildEncryptedEnquiryFinalizationPayload = (
	matrixEventId: string,
	language?: string
) => ({
	// The initial enquiry plaintext exists only inside the encrypted Matrix
	// event. UserService receives the event reference, never the content.
	message: '',
	matrixEventId,
	sendNotification: true,
	...(language ? { language } : {})
});
