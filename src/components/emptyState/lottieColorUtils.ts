type LottieValue = Record<string, any> | any[];

const SOURCE_ACCENT_COLORS = new Set(['#33cccc', '#34cccc']);
const SOURCE_SECONDARY_COLORS = new Set(['#000000']);

const normalizeHex = (value: string) => value.trim().toLowerCase();

const hexToLottieColor = (hex: string) => {
	const normalized = normalizeHex(hex).replace('#', '');

	return [
		parseInt(normalized.slice(0, 2), 16) / 255,
		parseInt(normalized.slice(2, 4), 16) / 255,
		parseInt(normalized.slice(4, 6), 16) / 255
	];
};

const lottieColorToHex = (value: number[]) =>
	`#${value
		.slice(0, 3)
		.map((channel) =>
			Math.round(channel * 255)
				.toString(16)
				.padStart(2, '0')
			)
			.join('')}`;

const isNormalizedLottieColor = (value: unknown): value is number[] =>
	Array.isArray(value) &&
	value.length === 4 &&
	value.every(
		(channel) =>
			typeof channel === 'number' && channel >= 0 && channel <= 1
	);

const getSourceColorRole = (value: unknown) => {
	if (!isNormalizedLottieColor(value)) {
		return null;
	}

	const sourceHex = lottieColorToHex(value);

	if (SOURCE_ACCENT_COLORS.has(sourceHex)) {
		return 'accent';
	}

	if (SOURCE_SECONDARY_COLORS.has(sourceHex)) {
		return 'secondary';
	}

	return null;
};

const replaceSourceColors = (
	value: unknown,
	replacementColors: Record<'accent' | 'secondary', number[]>
): unknown => {
	const colorRole = getSourceColorRole(value);

	if (colorRole) {
		return [
			...replacementColors[colorRole],
			...(value as number[]).slice(3)
		];
	}

	if (Array.isArray(value)) {
		return value.map((item) => replaceSourceColors(item, replacementColors));
	}

	if (value && typeof value === 'object') {
		const result: Record<string, unknown> = {};

		Object.entries(value as Record<string, unknown>).forEach(
			([key, item]) => {
				result[key] = replaceSourceColors(item, replacementColors);
			}
		);

		return result;
	}

	return value;
};

export const recolorLottieAccent = <T extends LottieValue>(
	animationData: T,
	accentColor: string,
	secondaryColor: string
): T => {
	const replacementColors = {
		accent: hexToLottieColor(accentColor),
		secondary: hexToLottieColor(secondaryColor)
	};

	return replaceSourceColors(animationData, replacementColors) as T;
};
