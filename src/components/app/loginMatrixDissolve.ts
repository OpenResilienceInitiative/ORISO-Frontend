// The button, labels and heading own these text nodes. Only ornamental marks
// (field edges, icons and the space around the form) are painted on canvas.
import { startLoginMatrixDetails } from './loginMatrixDetails';

const segmenter =
	typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
const graphemes = (value: string) =>
	segmenter
		? Array.from(segmenter.segment(value), ({ segment }) => segment)
		: Array.from(value);

// Shuffle once per row. Each grapheme changes once, with quiet intervals between changes.
function shuffledSlots(length: number) {
	const slots = Array.from({ length }, (_, index) => index);
	for (let last = slots.length - 1; last > 0; last--) {
		const pick = Math.floor(Math.random() * (last + 1));
		[slots[last], slots[pick]] = [slots[pick], slots[last]];
	}
	return slots;
}

type Row = {
	isButton?: boolean;
	start: number;
	size: number;
	write: (index: number, digit: string) => void;
};

/** Give every letter its own original advance before substituting its digit. */
function measureText(host: HTMLElement, start: number) {
	const original = host.firstChild;
	if (
		!(original instanceof Text) ||
		host.closest('legend, .loginForm__otp:not(.loginForm__otp--active)')
	)
		return;
	const range = document.createRange();
	if (!range.getBoundingClientRect) return;
	const source = graphemes(original.data);
	const label = host.closest('label');
	const transform = label && getComputedStyle(label).transform;
	const scale =
		transform && transform !== 'none' && typeof DOMMatrix !== 'undefined'
			? new DOMMatrix(transform).a || 1
			: 1;
	let offset = 0;
	const widths = source.map((letter) => {
		range.setStart(original, offset);
		offset += letter.length;
		range.setEnd(original, offset);
		return range.getBoundingClientRect().width / scale;
	});
	return {
		host,
		start,
		original,
		source,
		widths,
		fontSize: parseFloat(getComputedStyle(host).fontSize)
	};
}

export function startLoginMatrix(canvas: HTMLCanvasElement, form: HTMLElement) {
	const details = startLoginMatrixDetails(canvas, form);
	const rows: Row[] = [];
	const restore: (() => void)[] = [];
	// Read the layout of every translated word before touching the DOM.
	const measured = Array.from(
		form.querySelectorAll<HTMLElement>('[data-cipher-at]'),
		(host) => measureText(host, Number(host.dataset.cipherAt))
	);
	// OrisoTextField may obtain its floating label from the placeholder.
	// Work on the visible label only; MUI also renders a sizing copy in legend.
	for (const label of form.querySelectorAll<HTMLLabelElement>('label[for]')) {
		if (label.querySelector('[data-cipher-at]')) continue;
		const input = label.control;
		if (
			input instanceof HTMLInputElement &&
			input.hasAttribute('data-cipher-input')
		) {
			measured.push(
				measureText(label, Number(input.dataset.cipherInput) + 140)
			);
		}
	}
	for (const run of measured) {
		if (!run) continue;
		const { host, original, source, widths, fontSize } = run;
		const fragment = document.createDocumentFragment();
		const slots: {
			character: Text;
			slot: HTMLElement;
			transform: string;
		}[] = [];
		let index = 0;
		while (index < source.length) {
			if (/^\s+$/u.test(source[index])) {
				fragment.append(document.createTextNode(source[index++]));
				continue;
			}
			const first = index;
			let total = 0;
			while (index < source.length && source[index].trim()) {
				total += widths[index++];
			}
			const word = document.createElement('span');
			word.className = 'loginMatrixWord';
			const advance = total / (index - first);
			const scale = Math.min(1, advance / (fontSize * 0.62));
			let left = 0;
			for (let i = first; i < index; i++) {
				const slot = document.createElement('span');
				slot.className = 'loginMatrixGlyph';
				slot.style.width = widths[i] + 'px';
				const character = document.createTextNode(source[i]);
				slot.append(character);
				word.append(slot);
				const shift =
					(i - first + 0.5) * advance - (left + widths[i] / 2);
				slots.push({
					character,
					slot,
					transform: `translateX(${shift}px) scaleX(${scale})`
				});
				left += widths[i];
			}
			fragment.append(word);
		}
		const contents = Array.from(fragment.childNodes);
		original.replaceWith(fragment);
		restore.push(() => {
			if (!contents[0]?.parentNode) return;
			contents[0].replaceWith(original);
			for (const child of contents.slice(1)) child.remove();
		});
		rows.push({
			start: run.start,
			isButton: Boolean(host.closest('button')),
			size: slots.length,
			write: (index, digit) => {
				const { character, slot, transform } = slots[index];
				character.data = digit;
				if (!slot.style.transform) {
					slot.style.transform = transform;
					slot.dataset.encoded = '';
				}
			}
		});
	}
	// Only display lengths cross this boundary. The browser retains the
	// original controls, selection, autofill and credential values throughout.
	const displays: { input: HTMLInputElement; mask: HTMLSpanElement }[] = [];
	for (const input of form.querySelectorAll<HTMLInputElement>(
		'input[data-cipher-input]'
	)) {
		const field = input.parentElement;
		if (
			!field ||
			input.closest('.loginForm__otp:not(.loginForm__otp--active)')
		)
			continue;
		const size = Math.min(
			96,
			Math.max(0, Number(input.dataset.cipherLength) || 0)
		);
		if (!size) continue;
		const mask = document.createElement('span');
		mask.className = 'loginMatrixFieldMask';
		mask.setAttribute('aria-hidden', 'true');
		const letters = Array<string>(size).fill('•');
		const text = document.createTextNode('');
		mask.append(text);
		displays.push({ input, mask });
		rows.push({
			start: Number(input.dataset.cipherInput),
			size,
			write(index, digit) {
				if (!mask.isConnected) {
					field.append(mask);
					input.setAttribute('data-cipher-masked', '');
				}
				letters[index] = digit;
				text.data = letters.join('');
			}
		});
	}

	function positionMasks() {
		for (const { input, mask } of displays) {
			const style = getComputedStyle(input);
			const left = parseFloat(style.paddingLeft) || 0;
			const right = parseFloat(style.paddingRight) || 0;
			mask.style.left = input.offsetLeft + left + 'px';
			mask.style.top = input.offsetTop + 'px';
			mask.style.height = input.offsetHeight + 'px';
			mask.style.width =
				Math.max(0, input.clientWidth - left - right) + 'px';
			mask.style.font = style.font;
			mask.style.fontVariantNumeric = 'tabular-nums';
			mask.style.letterSpacing = style.letterSpacing;
		}
	}
	positionMasks();
	const maskObserver =
		typeof ResizeObserver === 'function'
			? new ResizeObserver(positionMasks)
			: undefined;
	for (const { input } of displays) maskObserver?.observe(input);
	restore.push(() => {
		maskObserver?.disconnect();
		for (const { input, mask } of displays) {
			input.removeAttribute('data-cipher-masked');
			mask.remove();
		}
	});
	let frame = 0;
	let timer = 0;
	let beat = 0;
	let last = -Infinity;
	const started = performance.now();
	const sequences = rows.map((row) => shuffledSlots(row.size));
	const cursors = rows.map(() => 0);
	const bit = (i: number, row: number) => (i * 13 + (i >> 1) + row) % 2;
	const resting = rows.filter((row) => row.size);
	function pulse() {
		beat++;
		if (resting.length) {
			const group = beat % resting.length;
			const row = resting[group];
			const cycle = Math.floor(beat / resting.length);
			const index = cycle % row.size;
			row.write(
				index,
				String(
					bit(index, rows.indexOf(row)) ^
						(1 - (Math.floor(cycle / row.size) % 2))
				)
			);
		}
		details.paint(performance.now() - started, beat);
		timer = window.setTimeout(pulse, 1800);
	}
	function tick(now: number) {
		const elapsed = now - started;
		if (now - last >= 32 || elapsed >= 1970) {
			rows.forEach((row, group) => {
				const progress = Math.max(
					0,
					Math.min(
						1,
						(elapsed - row.start) / (row.isButton ? 790 : 360)
					)
				);
				const end = Math.ceil(row.size * progress);
				while (cursors[group] < end) {
					const index = sequences[group][cursors[group]++];
					row.write(index, String(bit(index, group)));
				}
			});
			details.paint(elapsed, 0);
			last = now;
		}
		if (elapsed < 1970) frame = requestAnimationFrame(tick);
		else timer = window.setTimeout(pulse, 1800);
	}
	frame = requestAnimationFrame(tick);
	function pause() {
		cancelAnimationFrame(frame);
		window.clearTimeout(timer);
	}
	return {
		pause,
		dispose() {
			pause();
			details.stop();
			restore.forEach((reset) => reset());
		}
	};
}
