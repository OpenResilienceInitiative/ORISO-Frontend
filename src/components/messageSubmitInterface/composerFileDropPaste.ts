/**
 * WP-4 (epic ORISO-Admin#366): files dropped or pasted into the TipTap
 * composer route into the existing single-attachment flow. Pure helpers so
 * the ProseMirror handlers stay trivially testable.
 */
export const filesFromDataTransfer = (
	dataTransfer: { files?: FileList | null } | null | undefined
): File[] => Array.from(dataTransfer?.files ?? []);

/** True when the event carries files the composer should intercept. */
export const hasComposerFiles = (
	dataTransfer: { files?: FileList | null } | null | undefined
): boolean => filesFromDataTransfer(dataTransfer).length > 0;
