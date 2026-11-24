interface CurtainRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface CurtainHeading {
	text: string;
	rect: CurtainRect;
	fontSize: number;
	align?: 'left' | 'center' | 'right';
	lineHeight?: number;
}

/** Restores the public artwork only. The credential fields never cross the page boundary. */
export interface LoginHandoverCurtain {
	axis: 'horizontal' | 'vertical';
	split: number;
	radius: number;
	stageColor: string;
	stageTint: string;
	stageShade: string;
	stageFill?: string;
	panelColor: string;
	sheetColor?: string;
	inkColor: string;
	stageInk?: string;
	title?: CurtainHeading;
	claim?: CurtainHeading;
	sheet?: CurtainRect;
	fields: CurtainRect[];
	button?: CurtainRect;
}

const boundedNumber = (
	value: unknown,
	min: number,
	max: number
): value is number =>
	typeof value === 'number' &&
	Number.isFinite(value) &&
	value >= min &&
	value <= max;

const cssColor = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length <= 96 &&
	/^(?:#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|rgba?\([\d.,% /]+\)|color\(srgb [\d.% /]+\))$/i.test(
		value
	);

const readRect = (value: unknown): CurtainRect | undefined => {
	if (!value || typeof value !== 'object') return;
	const { x, y, w, h } = value as Partial<CurtainRect>;
	if (
		boundedNumber(x, 0, 100) &&
		boundedNumber(y, 0, 100) &&
		boundedNumber(w, 0.1, 100) &&
		boundedNumber(h, 0.1, 100)
	) {
		return { x, y, w, h };
	}
};

const readHeading = (value: unknown): CurtainHeading | undefined => {
	if (!value || typeof value !== 'object') return;
	const { text, rect, fontSize, align, lineHeight } =
		value as Partial<CurtainHeading>;
	const box = readRect(rect);
	if (
		box &&
		typeof text === 'string' &&
		text.length &&
		text.length <= 100 &&
		boundedNumber(fontSize, 10, 96)
	) {
		return {
			text,
			rect: box,
			fontSize,
			...(align === 'left' || align === 'center' || align === 'right'
				? { align }
				: {}),
			...(boundedNumber(lineHeight, 10, 116) && { lineHeight })
		};
	}
};

export const readLoginCurtain = (
	value: unknown
): LoginHandoverCurtain | undefined => {
	if (!value || typeof value !== 'object') return;
	const {
		axis,
		split,
		radius,
		stageColor,
		stageTint,
		stageShade,
		stageFill,
		panelColor,
		sheetColor,
		inkColor,
		stageInk,
		title,
		claim,
		sheet,
		fields,
		button
	} = value as Partial<LoginHandoverCurtain>;
	if (
		(axis !== 'horizontal' && axis !== 'vertical') ||
		!boundedNumber(split, 12, 72) ||
		!boundedNumber(radius, 0, 40) ||
		!cssColor(stageColor) ||
		!cssColor(stageTint) ||
		!cssColor(stageShade) ||
		!cssColor(panelColor) ||
		!cssColor(inkColor)
	) {
		return;
	}
	return {
		axis,
		split,
		radius,
		stageColor,
		stageTint,
		stageShade,
		...(cssColor(stageFill) && { stageFill }),
		panelColor,
		inkColor,
		...(cssColor(sheetColor) && { sheetColor }),
		...(cssColor(stageInk) && { stageInk }),
		title: readHeading(title),
		claim: readHeading(claim),
		sheet: readRect(sheet),
		fields: Array.isArray(fields)
			? fields
					.slice(0, 3)
					.map(readRect)
					.filter((rect) => rect !== undefined)
			: [],
		button: readRect(button)
	};
};

/** Read only geometry from form controls, never their attributes or contents. */
export const captureLoginCurtain = (
	root: HTMLElement
): LoginHandoverCurtain => {
	const width = window.innerWidth;
	const height = window.innerHeight;
	const desktop = root.querySelector<HTMLElement>('.stageLayout__stage');
	const mobile = root.querySelector<HTMLElement>('.stageMobileHero');
	const isDesktop = Boolean(desktop?.offsetWidth);
	const stage = isDesktop ? desktop : mobile;
	const stageBounds = stage?.getBoundingClientRect();
	const stageStyle = stage && getComputedStyle(stage);
	const stageFill =
		stageStyle?.backgroundImage === 'none'
			? stageStyle.backgroundColor
			: undefined;
	const style = getComputedStyle(root);
	const quantize = (value: number) => Math.round(value * 10) / 10;
	const measuredSplit =
		stageBounds &&
		(isDesktop
			? (stageBounds.right / width) * 100
			: (stageBounds.bottom / height) * 100);
	const split = boundedNumber(measuredSplit, 12, 72)
		? quantize(measuredSplit)
		: isDesktop
			? 40
			: 32;
	const geometry = (node: Element | null | undefined) => {
		if (!node) return;
		const rect = node.getBoundingClientRect();
		return readRect({
			x: quantize((rect.left / width) * 100),
			y: quantize((rect.top / height) * 100),
			w: quantize((rect.width / width) * 100),
			h: quantize((rect.height / height) * 100)
		});
	};
	const getHeading = (query: string, title: boolean) => {
		const node = stage?.querySelector(query);
		if (!(node instanceof HTMLElement)) return;
		const nodeStyle = getComputedStyle(node);
		// The desktop intro can still be arranging the title as a fast
		// sign-in starts. Keep its public copy even if it is just offscreen.
		const measured = geometry(node);
		const fits =
			measured &&
			(isDesktop
				? measured.x + measured.w <= split + 0.2
				: measured.y + measured.h <= split + 0.2);
		const rect = fits
			? measured
			: isDesktop
				? { x: 0, y: title ? 34 : 49, w: split, h: title ? 10 : 4 }
				: { x: 6, y: title ? 13 : 21, w: 88, h: title ? 5 : 3 };
		return readHeading({
			text: (node.innerText || node.textContent)
				?.replace(/[ \t]+/g, ' ')
				.trim(),
			rect,
			fontSize:
				parseFloat(nodeStyle.fontSize) ||
				(title ? (isDesktop ? 40 : 27) : 14),
			align:
				nodeStyle.textAlign === 'center'
					? 'center'
					: nodeStyle.textAlign === 'right' ||
						  nodeStyle.textAlign === 'end'
						? 'right'
						: 'left',
			lineHeight: parseFloat(nodeStyle.lineHeight)
		});
	};
	const color = (property: string, fallback: string) => {
		const token = style.getPropertyValue(property).trim();
		return cssColor(token) ? token : fallback;
	};
	const radius = parseFloat(stageStyle?.borderBottomLeftRadius ?? '');
	const stageColor = color('--m3-primary', '#a5000a');
	const panelColor = color('--m3-background', '#fcf9f9');
	const sheet = root.querySelector('.loginForm');
	const sheetColor = sheet && getComputedStyle(sheet).backgroundColor;
	return {
		axis: isDesktop ? 'horizontal' : 'vertical',
		split,
		radius: isDesktop ? 0 : Math.min(40, Math.max(0, radius || 0)),
		stageColor,
		stageTint: color('--m3-primary-container', stageColor),
		stageShade: color('--m3-primary-hover', stageColor),
		...(cssColor(stageFill) &&
			stageFill !== 'rgba(0, 0, 0, 0)' && { stageFill }),
		panelColor,
		sheetColor:
			cssColor(sheetColor) && sheetColor !== 'rgba(0, 0, 0, 0)'
				? sheetColor
				: color('--m3-surface-container-lowest', panelColor),
		inkColor: color('--m3-on-surface-variant', '#454545'),
		stageInk: cssColor(stageStyle?.color)
			? stageStyle.color
			: color('--m3-on-primary', '#fff'),
		title: getHeading('.stage__title, .stageMobileHero__headline', true),
		claim: getHeading('.stage__claim, .stageMobileHero__claim', false),
		sheet: geometry(sheet),
		fields: [
			...root.querySelectorAll(
				'.loginForm__fields .MuiOutlinedInput-root'
			)
		]
			.filter(
				(node) =>
					!node.closest(
						'.loginForm__otp:not(.loginForm__otp--active)'
					)
			)
			.slice(0, 3)
			.map(geometry)
			.filter((rect) => rect !== undefined),
		button: geometry(
			root.querySelector('.loginForm__actions .button__item')
		)
	};
};
