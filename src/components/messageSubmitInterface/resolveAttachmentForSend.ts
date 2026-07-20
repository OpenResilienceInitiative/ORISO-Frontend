export const resolveAttachmentForSend = (
	preselectedFile: File | null | undefined,
	selectedFile: File | null | undefined,
	attachmentSelected: File | null | undefined
): File | null | undefined =>
	preselectedFile || selectedFile || attachmentSelected;
