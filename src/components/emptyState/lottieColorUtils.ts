type LottieValue = Record<string, any> | any[];

const SOURCE_ACCENT_COLORS = new Set(['#33cccc', '#34cccc']);
const SOURCE_SECONDARY_COLORS = new Set(['#000000']);
const COLOR_PROPERTY_KEYS = new Set(['c', 'v']);

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
		(channel) => typeof channel === 'number' && channel >= 0 && channel <= 1
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

const replaceColorTuple = (
	value: unknown,
	replacementColors: Record<'accent' | 'secondary', number[]>
) => {
	const colorRole = getSourceColorRole(value);

	return colorRole
		? [...replacementColors[colorRole], ...(value as number[]).slice(3)]
		: null;
};

const replaceColorProperty = (
	propertyKey: string | undefined,
	value: Record<string, unknown>,
	replacementColors: Record<'accent' | 'secondary', number[]>
) => {
	if (!propertyKey || !COLOR_PROPERTY_KEYS.has(propertyKey)) {
		return null;
	}

	const replacement = replaceColorTuple(value.k, replacementColors);

	return replacement ? { ...value, k: replacement } : null;
};

const replaceSourceColors = (
	value: unknown,
	replacementColors: Record<'accent' | 'secondary', number[]>,
	propertyKey?: string
): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) =>
			replaceSourceColors(item, replacementColors)
		);
	}

	if (value && typeof value === 'object') {
		const colorProperty = replaceColorProperty(
			propertyKey,
			value as Record<string, unknown>,
			replacementColors
		);

		if (colorProperty) {
			return colorProperty;
		}

		const result: Record<string, unknown> = {};

		Object.entries(value as Record<string, unknown>).forEach(
			([key, item]) => {
				result[key] = replaceSourceColors(item, replacementColors, key);
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
