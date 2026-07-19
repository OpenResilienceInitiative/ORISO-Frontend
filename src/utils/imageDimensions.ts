/**
 * Probes intrinsic pixel dimensions of an image file (for m.image info.w/h so
 * receivers can reserve correctly-sized, scaled thumbnails before the image
 * loads). Returns null for non-images or when probing fails — dimensions are
 * an enhancement, never a blocker for sending.
 */
export const getImageDimensions = async (
	file: File
): Promise<{ w: number; h: number } | null> => {
	if (!file.type.startsWith('image/')) {
		return null;
	}
	try {
		if (typeof createImageBitmap === 'function') {
			const bitmap = await createImageBitmap(file);
			const dimensions = { w: bitmap.width, h: bitmap.height };
			bitmap.close();
			return dimensions;
		}
	} catch {
		// fall through to the <img> probe
	}
	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const probe = new Image();
		probe.onload = () => {
			URL.revokeObjectURL(objectUrl);
			resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
		};
		probe.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve(null);
		};
		probe.src = objectUrl;
	});
};
