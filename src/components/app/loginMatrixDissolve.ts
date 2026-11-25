// Re-encodes the form's own visible text in place: the sign-in label and the
// heading first, then every other line in reading order, then each field's
// icon and outline. There is no overlay over the panel. Each letter keeps its
// box and fades out while a digit, drawn by a pseudo-element that assistive
// technology ignores, settles over it. CSS runs the whole timeline (opacity and
// transform only); JS only builds the pieces and says when each one turns.

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
// MUI pads empty adornments and notches with zero-width spaces.
const readable = (value: string) => /[^\s​-‍﻿]/u.test(value);

/** Milliseconds on one timeline, before `--login-matrix-pace` stretches it. */
export const LOGIN_MATRIX_TIMING = {
	button: 420,
	heading: 120,
	lead: 380,
	line: 120,
	letters: 380,
	field: 160,
	outline: 640,
	turn: 360,
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

/** Left to right with a little jitter, or fully shuffled like the study. */
function turns(length: number, shuffled: boolean) {
	const slots = Array.from({ length }, (_, index) => index);
	if (!shuffled)
		return slots.map((index) =>
			index ? Math.min(length - 1, index + Math.random() * 1.6) : 0
		);
	for (let last = length - 1; last > 0; last--) {
		const pick = Math.floor(Math.random() * (last + 1));
		[slots[last], slots[pick]] = [slots[pick], slots[last]];
	}
	return slots;
}

/** Spread each word's digits evenly over the word, like a fixed-width cell. */
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
		const size = parseFloat(getComputedStyle(word[0]).fontSize) || 16;
		return word.map(
			(glyph, index) =>
				[
					glyph,
					(left +
						cell * (index + 0.5) -
						boxes[index].left -
						boxes[index].width / 2) /
						scale,
					Math.min(1, cell / scale / (size * 0.6))
				] as const
		);
	});
	for (const [glyph, shift, squeeze] of plan.flat()) {
		glyph.style.setProperty('--shift', `${shift.toFixed(2)}px`);
		glyph.style.setProperty('--squeeze', squeeze.toFixed(3));
	}
}

/** The field's own outline turns into small strokes, then into digits. */
function outline(field: HTMLElement, id: string, digit: (i: number) => string) {
	const set = field.querySelector<HTMLElement>(':scope > fieldset');
	if (!set) return;
	const w = set.offsetWidth;
	const h = set.offsetHeight;
	const r = Math.min(
		parseFloat(getComputedStyle(set).borderTopLeftRadius) || 0,
		h / 2
	);
	const legend = set.querySelector('legend');
	const gap = legend && legend.offsetWidth > 2 ? legend : null;
	const from = gap ? gap.offsetLeft + gap.offsetWidth : r;
	const svg = document.createElementNS(SVG, 'svg');
	svg.setAttribute('class', 'loginMatrixEdge');
	svg.setAttribute('aria-hidden', 'true');
	svg.style.cssText = `left:${set.offsetLeft}px;top:${set.offsetTop}px;width:${w}px;height:${h}px`;
	const arc = `A${r} ${r} 0 0 1`;
	svg.innerHTML = `<path id="${id}" d="M${from} 0H${w - r}${arc} ${w} ${r}V${h - r}${arc} ${w - r} ${h}H${r}${arc} 0 ${h - r}V${r}${arc} ${r} 0H${gap ? gap.offsetLeft : r}"/><text><textPath href="#${id}"></textPath></text>`;
	field.append(svg);
	const path = svg.querySelector('path')!;
	const ring = svg.querySelector('textPath')!;
	const length = path.getTotalLength?.() || 2 * (w + h);
	const count = Math.max(4, Math.floor(length / 7));
	ring.setAttribute('textLength', String(length));
	ring.setAttribute('lengthAdjust', 'spacing');
	for (let i = 0; i < count; i++) {
		const cell = document.createElementNS(SVG, 'tspan');
		cell.textContent = digit(i);
		cell.style.setProperty('--run', (i / count).toFixed(3));
		ring.append(cell);
	}
	return svg;
}

export function startLoginMatrix(form: HTMLElement) {
	const T = LOGIN_MATRIX_TIMING;
	const style = getComputedStyle(form);
	const pace = parseFloat(style.getPropertyValue('--login-matrix-pace')) || 1;
	const shuffled =
		style.getPropertyValue('--login-matrix-order').trim() === 'random';
	const button = form.querySelector(BUTTON);
	const glyphs: HTMLElement[] = [];
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
	const digit = (index: number, seed: number) =>
		String((index * 13 + (index >> 1) + seed) % 2);
	let line = 0;

	const encode = (text: Text) => {
		const lead = inButton(text)
			? 0
			: inHeading(text)
				? T.heading
				: T.lead + line++ * T.line;
		// Pieces built a frame late still land on the same timeline.
		const start = lead - (performance.now() - started) / pace;
		const spread = inButton(text) ? T.button : T.letters;
		const letters = graphemes(text.data);
		const order = turns(letters.length, shuffled);
		const built: HTMLElement[] = [];
		const parts = letters.map((letter, index) => {
			if (!readable(letter)) return document.createTextNode(letter);
			const glyph = document.createElement('span');
			const ink = document.createElement('span');
			ink.textContent = letter;
			glyph.className = 'loginMatrixGlyph';
			glyph.dataset.digit = digit(index, line);
			glyph.style.setProperty(
				'--at',
				String(
					Math.round(start + (spread * order[index]) / letters.length)
				)
			);
			glyph.append(ink);
			built.push(glyph);
			return glyph;
		});
		// React keeps owning the original node: it stays in place, only empty.
		const original = text.data;
		text.after(...parts);
		text.data = '';
		glyphs.push(...built);
		restore.push(() => {
			for (const part of parts) part.remove();
			if (!text.data) text.data = original;
		});
		return built;
	};

	const lastLine = T.lead + lines * T.line;
	const later = () => {
		const built = rest.flatMap(encode);
		const edges = fields.map((field, index) => {
			const at =
				lastLine +
				index * T.field -
				(performance.now() - started) / pace;
			field.style.setProperty('--at', String(Math.round(at)));
			field.dataset.matrixField = '';
			return outline(field, `login-matrix-edge-${index}`, (i) =>
				digit(i, index)
			);
		});
		align(built);
		restore.push(() => {
			for (const edge of edges) edge?.remove();
			for (const field of fields) {
				delete field.dataset.matrixField;
				field.style.removeProperty('--at');
				if (!field.getAttribute('style'))
					field.removeAttribute('style');
			}
		});
	};
	// The button turns on the submit frame; everything else is built on the
	// next one, so the first frame stays short.
	align(first.flatMap(encode));
	const frame = requestAnimationFrame(later);

	const duration = lastLine + fields.length * T.field + T.outline + T.turn;
	// Longer waits: now and then one digit flips, nothing else moves.
	let timer = window.setTimeout(function pulse() {
		const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
		if (glyph)
			glyph.dataset.digit = glyph.dataset.digit === '1' ? '0' : '1';
		timer = window.setTimeout(pulse, T.pulse * pace);
	}, duration * pace);

	const pause = () => {
		cancelAnimationFrame(frame);
		window.clearTimeout(timer);
	};
	return {
		duration,
		pause,
		dispose() {
			pause();
			restore.forEach((reset) => reset());
		}
	};
}
