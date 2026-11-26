// Re-encodes the form in place while sign-in is pending, like the code rain
// in The Matrix: what is being sent (the name and the password) turns first,
// then the button and the heading, then the other words at random places.
// Every sign rattles through a few cipher signs before it settles, stands
// still on its letter and only fades. Icons become small sign grids, outlines
// turn into strokes and then signs, and a faint curtain of tiny signs falls
// from the top and rises from the bottom behind the text. The letters stay in
// the DOM, so assistive technology reads the page unchanged. CSS runs the
// timeline (opacity and transform only); one frame loop swaps signs.

const segmenter =
	typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
const graphemes = (value: string) =>
	segmenter
		? Array.from(segmenter.segment(value), ({ segment }) => segment)
		: Array.from(value);

const SKIPPED =
	'input, textarea, select, legend, [aria-hidden="true"], .sr-only, .loginForm__otp:not(.loginForm__otp--active)';
const BUTTON = 'button[type="submit"], .loginForm__actions button';
const SVG = 'http://www.w3.org/2000/svg';
// Half-width katakana, digits and a few signs, as in the film's rain.
const SIGNS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:=*+<>¦';
const sign = () => SIGNS[Math.floor(Math.random() * SIGNS.length)];
const signs = (count: number) => Array.from({ length: count }, sign).join('');
// MUI pads empty adornments and notches with zero-width spaces.
const readable = (value: string) => /[^\s​-‍﻿]/u.test(value);

let warmed = false;
/**
 * Lays the signs out once while the form is idle. The system looks up a font
 * for the katakana the first time; done on submit, that costs a long frame.
 */
export function warmSigns() {
	if (warmed) return;
	warmed = true;
	const probe = document.createElement('span');
	probe.setAttribute('aria-hidden', 'true');
	probe.style.cssText =
		'position:fixed;top:0;opacity:0.01;pointer-events:none;font:9px ui-monospace,monospace';
	probe.textContent = SIGNS;
	document.body.append(probe);
	probe.getBoundingClientRect();
	requestAnimationFrame(() => requestAnimationFrame(() => probe.remove()));
}

/** Milliseconds on one timeline, before `--login-matrix-pace` stretches it. */
export const LOGIN_MATRIX_TIMING = {
	values: 0,
	button: 420,
	heading: 160,
	lead: 420,
	drift: 60,
	scatter: 720,
	letters: 380,
	field: 160,
	outline: 640,
	turn: 300,
	rattle: 70,
	rain: 900,
	pulse: 1100
};

function visibleText(form: HTMLElement) {
	const found: Text[] = [];
	const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (
			readable(node.nodeValue ?? '') &&
			parent &&
			!parent.closest(SKIPPED) &&
			parent.getClientRects().length
		)
			found.push(node as Text);
	}
	return found;
}

/** One even cell per letter across each word, so the signs stand in a row. */
function align(glyphs: HTMLElement[]) {
	const words: HTMLElement[][] = [];
	for (const glyph of glyphs) {
		const word = words.at(-1);
		if (word && word.at(-1) === glyph.previousSibling) word.push(glyph);
		else words.push([glyph]);
	}
	// Read everything first, then write, so layout is computed once.
	const plan = words.map((word) => {
		const boxes = word.map((glyph) => glyph.getBoundingClientRect());
		const scale = boxes[0].width / (word[0].offsetWidth || 1) || 1;
		const left = boxes[0].left;
		const cell = (boxes.at(-1)!.right - left) / word.length;
		return word.map(
			(glyph, index) =>
				[
					glyph,
					(left +
						cell * (index + 0.5) -
						boxes[index].left -
						boxes[index].width / 2) /
						scale
				] as const
		);
	});
	for (const [glyph, shift] of plan.flat())
		glyph.style.setProperty('--shift', `${shift.toFixed(2)}px`);
}

/**
 * The field's own outline turns into small strokes, then into signs. Reads the
 * geometry now and returns the builder, so all reads come before any write.
 */
function outline(field: HTMLElement, id: string) {
	const set = field.querySelector<HTMLElement>(':scope > fieldset');
	if (!set) return () => undefined;
	const w = set.offsetWidth;
	const h = set.offsetHeight;
	const x = set.offsetLeft;
	const y = set.offsetTop;
	const r = Math.min(
		parseFloat(getComputedStyle(set).borderTopLeftRadius) || 0,
		h / 2
	);
	const legend = set.querySelector('legend');
	const gap = legend && legend.offsetWidth > 2 ? legend : null;
	const from = gap ? gap.offsetLeft + gap.offsetWidth : r;
	const to = gap ? gap.offsetLeft : r;
	// The rounded rectangle's perimeter, less the notch for the label.
	const length = 2 * (w + h) - 8 * r + 2 * Math.PI * r - (from - to);
	return () => build(field, id, { w, h, x, y, r, from, to, length });
}

function build(
	field: HTMLElement,
	id: string,
	{ w, h, x, y, r, from, to, length }: Record<string, number>
) {
	const svg = document.createElementNS(SVG, 'svg');
	svg.setAttribute('class', 'loginMatrixEdge');
	svg.setAttribute('aria-hidden', 'true');
	svg.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
	const arc = `A${r} ${r} 0 0 1`;
	svg.innerHTML = `<path id="${id}" d="M${from} 0H${w - r}${arc} ${w} ${r}V${h - r}${arc} ${w - r} ${h}H${r}${arc} 0 ${h - r}V${r}${arc} ${r} 0H${to}"/><text><textPath href="#${id}"></textPath></text>`;
	field.append(svg);
	const ring = svg.querySelector('textPath')!;
	const count = Math.max(4, Math.floor(length / 7));
	ring.setAttribute('textLength', String(length));
	ring.setAttribute('lengthAdjust', 'spacing');
	for (let i = 0; i < count; i++) {
		const cell = document.createElementNS(SVG, 'tspan');
		cell.textContent = sign();
		cell.style.setProperty('--run', Math.random().toFixed(3));
		ring.append(cell);
	}
	return svg;
}

export function startLoginMatrix(form: HTMLElement) {
	const T = LOGIN_MATRIX_TIMING;
	const style = getComputedStyle(form);
	const pace = parseFloat(style.getPropertyValue('--login-matrix-pace')) || 1;
	const button = form.querySelector(BUTTON);
	// Every sign that rattles, with its turn on the timeline.
	const turning: [HTMLElement, number][] = [];
	const columns: Text[] = [];
	const restore: (() => void)[] = [];
	const texts = visibleText(form);
	const inButton = (text: Text) => Boolean(button?.contains(text));
	const inHeading = (text: Text) =>
		Boolean(text.parentElement?.closest('h1, h2'));
	const first = texts.filter(inButton);
	const rest = texts.filter((text) => !inButton(text));
	const lines = rest.filter((text) => !inHeading(text)).length;
	const fields = [
		...form.querySelectorAll<HTMLElement>('.MuiOutlinedInput-root')
	].filter(
		(field) =>
			!field.closest('.loginForm__otp:not(.loginForm__otp--active)')
	);
	const started = performance.now();
	// Pieces built a frame late still land on the same timeline.
	const offset = () => (performance.now() - started) / pace;
	let line = 0;

	/** A sign that turns at `turn` ms; it rattles until it settles. */
	const cipher = (element: HTMLElement, turn: number, shift: number) => {
		element.dataset.digit = sign();
		element.style.setProperty('--at', String(Math.round(turn - shift)));
		turning.push([element, turn]);
		return element;
	};

	const encode = (text: Text) => {
		const [lead, spread] = inButton(text)
			? [0, T.button]
			: inHeading(text)
				? [T.heading, T.letters]
				: [T.lead + line++ * T.drift, T.scatter];
		const shift = offset();
		const built: HTMLElement[] = [];
		const parts = graphemes(text.data).map((letter) => {
			if (!readable(letter)) return document.createTextNode(letter);
			const glyph = document.createElement('span');
			const ink = document.createElement('span');
			ink.textContent = letter;
			glyph.className = 'loginMatrixGlyph';
			glyph.append(ink);
			built.push(cipher(glyph, lead + spread * Math.random(), shift));
			return glyph;
		});
		// One inline box for the whole text, so a flex parent still sees one
		// item and keeps the spaces. React keeps owning the original node: it
		// stays in place, only empty.
		const box = document.createElement('span');
		box.append(...parts);
		const original = text.data;
		text.after(box);
		text.data = '';
		restore.push(() => {
			box.remove();
			if (!text.data) text.data = original;
		});
		return built;
	};

	/** What is being sent turns first: one sign per typed character. */
	const value = (field: HTMLElement) => {
		const input = field.querySelector('input');
		// Only the length is read; the characters never reach the DOM.
		const count = Math.min(input?.value.length ?? 0, 40);
		if (!input || !count) return () => undefined;
		const place = `left:${input.offsetLeft}px;top:${input.offsetTop}px;width:${input.offsetWidth}px;height:${input.offsetHeight}px;padding-inline-start:${getComputedStyle(input).paddingLeft}`;
		return (shift: number) => {
			const row = document.createElement('span');
			row.className = 'loginMatrixValue';
			row.setAttribute('aria-hidden', 'true');
			row.style.cssText = place;
			for (let i = 0; i < count; i++)
				row.append(
					cipher(
						document.createElement('span'),
						T.values + T.letters * Math.random(),
						shift
					)
				);
			field.style.setProperty(
				'--value-at',
				String(Math.round(T.values - shift))
			);
			field.append(row);
			return row;
		};
	};

	/** A faint curtain of tiny signs falls from the top and rises from below. */
	const curtain = () => {
		const shift = offset();
		const rain = document.createElement('div');
		rain.className = 'loginMatrixRain';
		rain.setAttribute('aria-hidden', 'true');
		const count = Math.ceil(form.clientWidth / 11);
		const rows = Math.ceil(form.clientHeight / 16) + 2;
		for (const side of ['top', 'bottom']) {
			const half = document.createElement('div');
			half.dataset.side = side;
			for (let i = 0; i < count; i++) {
				const column = document.createElement('span');
				const text = document.createTextNode(signs(rows));
				column.style.setProperty(
					'--at',
					String(
						Math.round(
							T.lead / 2 + T.scatter * Math.random() - shift
						)
					)
				);
				column.append(text);
				columns.push(text);
				half.append(column);
			}
			rain.append(half);
		}
		form.prepend(rain);
		restore.push(() => rain.remove());
	};

	const lastLine = T.lead + lines * T.drift + T.scatter / 2;
	// Read every position before the first write, so layout runs once.
	const plans = fields.map(
		(field, index) =>
			[
				value(field),
				outline(field, `login-matrix-edge-${index}`)
			] as const
	);
	const pieces: (Element | undefined)[] = [];
	restore.push(() => {
		for (const piece of pieces) piece?.remove();
		for (const field of fields) {
			delete field.dataset.matrixField;
			delete field.querySelector<HTMLElement>(
				'.MuiInputAdornment-positionStart'
			)?.dataset.grid;
			field.style.removeProperty('--at');
			field.style.removeProperty('--value-at');
			if (!field.getAttribute('style')) field.removeAttribute('style');
		}
	});
	const values = () => {
		const shift = offset();
		pieces.push(...plans.map(([row]) => row(shift)));
	};
	const words = () => align(rest.flatMap(encode));
	const edges = () =>
		fields.forEach((field, index) => {
			const at = lastLine + index * T.field - offset();
			field.style.setProperty('--at', String(Math.round(at)));
			field.dataset.matrixField = '';
			const icon = field.querySelector<HTMLElement>(
				'.MuiInputAdornment-positionStart'
			);
			if (icon)
				icon.dataset.grid = `${signs(3)}\n${signs(3)}\n${signs(3)}`;
			pieces.push(plans[index][1]());
		});

	const duration = lastLine + fields.length * T.field + T.outline + T.turn;
	// One piece per frame keeps every frame short: what is sent, the words,
	// the fields, then the rain.
	const steps = [values, words, edges, curtain];
	let last = -Infinity;
	let pulse = duration;
	let frame = 0;
	// One loop: rattle the signs that are turning, keep the rain alive, and
	// in long waits flip one settled sign now and then.
	const tick = (now: number) => {
		steps.shift()?.();
		const t = (now - started) / pace;
		if (t - last >= T.rattle) {
			last = t;
			for (const [element, turn] of turning)
				if (t >= turn && t < turn + T.turn * 1.5)
					element.dataset.digit = sign();
			const column = columns[Math.floor(Math.random() * columns.length)];
			if (column) {
				const at = Math.floor(Math.random() * column.length);
				column.replaceData(at, 1, sign());
			}
			if (t >= pulse && turning.length) {
				pulse = t + T.pulse;
				const [element] =
					turning[Math.floor(Math.random() * turning.length)];
				// Always a different sign, so the flip shows.
				const index = SIGNS.indexOf(element.dataset.digit ?? '');
				element.dataset.digit =
					SIGNS[
						(index +
							1 +
							Math.floor(Math.random() * (SIGNS.length - 1))) %
							SIGNS.length
					];
			}
		}
		frame = requestAnimationFrame(tick);
	};
	// The button turns on the submit frame; everything else is built on the
	// next one, so the first frame stays short.
	align(first.flatMap(encode));
	frame = requestAnimationFrame(tick);

	const pause = () => cancelAnimationFrame(frame);
	return {
		duration,
		pause,
		dispose() {
			pause();
			restore.forEach((reset) => reset());
		}
	};
}
