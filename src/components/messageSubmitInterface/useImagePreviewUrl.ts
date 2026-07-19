import { useEffect, useState } from 'react';

/**
 * Object URL for a selected image file, for the pre-send attachment thumbnail.
 * Create and revoke live in the SAME effect so they are always paired: under
 * React StrictMode (mount → cleanup → mount) a fresh URL is created on remount
 * instead of the <img> pointing at an already-revoked blob (broken thumbnail).
 * Returns null for non-images or no selection.
 */
export const useImagePreviewUrl = (
	file: File | null | undefined
): string | null => {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!file?.type?.startsWith('image/')) {
			setPreviewUrl(null);
			return undefined;
		}
		const objectUrl = URL.createObjectURL(file);
		setPreviewUrl(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [file]);

	return previewUrl;
};
