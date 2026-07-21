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
			const dimensionsPromise = createImageBitmap(file).then((bitmap) => {
				const dimensions = { w: bitmap.width, h: bitmap.height };
				bitmap.close();
				return dimensions;
			});
			const dimensions = await Promise.race([
				dimensionsPromise,
				new Promise<null>((resolve) =>
					window.setTimeout(() => resolve(null), 3000)
				)
			]);
			return dimensions;
		}
	} catch {
		// fall through to the <img> probe
	}
	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const probe = new Image();
		let settled = false;
		const finish = (dimensions: { w: number; h: number } | null) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeoutId);
			URL.revokeObjectURL(objectUrl);
			resolve(dimensions);
		};
		const timeoutId = window.setTimeout(() => finish(null), 3000);
		probe.onload = () => {
			finish({ w: probe.naturalWidth, h: probe.naturalHeight });
		};
		probe.onerror = () => {
			finish(null);
		};
		probe.src = objectUrl;
	});
};
