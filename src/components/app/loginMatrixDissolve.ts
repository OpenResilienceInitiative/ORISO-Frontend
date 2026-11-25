// Re-encodes the form's own visible text in place: the sign-in label first,
// then every other line in reading order. There is no overlay and no canvas.
// Each letter keeps its box and fades out while a digit, drawn by a
// pseudo-element that assistive technology ignores, settles over it. CSS runs
// the whole timeline on the compositor (opacity and transform only).

const segmenter =
	typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
const graphemes = (value: string) =>
	segmenter
		? Array.from(segmenter.segment(value), ({ segment }) => segment)
		: Array.from(value);

const SKIPPED =
	'input, textarea, select, legend, [aria-hidden="true"], .sr-only, .loginForm__otp:not(.loginForm__otp--active)';
const BUTTON = 'button[type="submit"], .loginForm__actions button';
// MUI pads empty adornments and notches with zero-width spaces.
const readable = (value: string) => /[^\s\u200B-\u200D\uFEFF]/u.test(value);

/** Milliseconds: the button label, then one line after another. */
export const LOGIN_MATRIX_TIMING = {
	button: 420,
	lead: 300,
	line: 110,
	letters: 360,
	turn: 260,
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
	const button = form.querySelector(BUTTON);
	const first = (node: Text) => Number(!button?.contains(node));
	return found.sort((a, b) => first(a) - first(b));
}

/** Each letter turns once, in a different order on every line. */
function turns(length: number) {
	const slots = Array.from({ length }, (_, index) => index);
	for (let last = length - 1; last > 0; last--) {
		const pick = Math.floor(Math.random() * (last + 1));
		[slots[last], slots[pick]] = [slots[pick], slots[last]];
	}
	return slots;
}

export function startLoginMatrix(form: HTMLElement) {
	const T = LOGIN_MATRIX_TIMING;
	const button = form.querySelector(BUTTON);
	const glyphs: HTMLElement[] = [];
	const pace =
		parseFloat(
			getComputedStyle(form).getPropertyValue('--login-matrix-pace')
		) || 1;
	const restore: (() => void)[] = [];
	const texts = visibleText(form);
	const lines = texts.filter((text) => !button?.contains(text)).length;
	const started = performance.now();
	let line = 0;
	const encode = (text: Text) => {
		const isButton = Boolean(button?.contains(text));
		// Built a frame later than the button, still on the same timeline.
		const start =
			(isButton ? 0 : T.lead + line++ * T.line) -
			(performance.now() - started) / pace;
		const spread = isButton ? T.button : T.letters;
		const letters = graphemes(text.data);
		const order = turns(letters.length);
		const parts = letters.map((letter, index) => {
			if (!readable(letter)) return document.createTextNode(letter);
			const glyph = document.createElement('span');
			const ink = document.createElement('span');
			ink.textContent = letter;
			glyph.className = 'loginMatrixGlyph';
			glyph.dataset.digit = String(
				(index * 13 + (index >> 1) + line) % 2
			);
			glyph.style.setProperty(
				'--at',
				String(
					Math.round(start + (spread * order[index]) / letters.length)
				)
			);
			glyph.append(ink);
			glyphs.push(glyph);
			return glyph;
		});
		// React keeps owning the original node: it stays in place, only empty.
		const original = text.data;
		text.after(...parts);
		text.data = '';
		restore.push(() => {
			for (const part of parts) part.remove();
			if (!text.data) text.data = original;
		});
	};
	// The button turns on the submit frame; everything else is built on the
	// next one, so the first frame stays short.
	texts.filter((text) => button?.contains(text)).forEach(encode);
	const frame = requestAnimationFrame(() =>
		texts.filter((text) => !button?.contains(text)).forEach(encode)
	);

	const duration = T.lead + lines * T.line + T.letters + T.turn;
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
