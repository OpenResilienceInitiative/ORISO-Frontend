export const buildEncryptedEnquiryFinalizationPayload = (
	matrixEventId: string,
	language?: string
) => ({
	// The initial enquiry plaintext exists only inside the encrypted Matrix
	// event. UserService receives the event reference, never the content.
	message: '',
	t: 'e2e',
	matrixEventId,
	...(language ? { language } : {})
});
