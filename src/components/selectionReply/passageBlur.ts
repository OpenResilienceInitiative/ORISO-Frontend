/**
 * Blurring a passage of a chat message.
 *
 * A moderator marks a passage and picks "Blur". The passage is stored as a
 * position in the message's own text (whitespace collapsed, the same text the
 * selection reply reads), never as the passage itself, so the annotation does
 * not repeat what it hides.
 *
 * Rendering replaces the passage's characters with random ones of the same
 * shape ("Zahlensalat") and blurs them. The real words never reach the DOM of
 * a reader, so copying, the accessibility tree or zooming in reveal nothing.
 */
import { collectText, type Mapped } from './passageRange';

/** One blurred passage of one message. */
export interface PassageBlur {
	/** Stable id, used to remove this blur again. */
	id: string;
	/** Start in the message's collapsed-whitespace text. */
	start: number;
	/** Length in the message's collapsed-whitespace text. */
	length: number;
}

/** Where `range` sits in the bubble's own text, or null when outside it. */
export const passageBlurFromRange = (
	bubble: Element,
	range: Range
): Pick<PassageBlur, 'start' | 'length'> | null => {
	const { map } = collectText(bubble);
	const inRange = (entry: Mapped) => {
		const point = bubble.ownerDocument.createRange();
		point.setStart(entry.node, entry.offset);
		point.setEnd(entry.node, entry.offset + 1);
		return (
			range.compareBoundaryPoints(Range.START_TO_START, point) <= 0 &&
			range.compareBoundaryPoints(Range.END_TO_END, point) >= 0
		);
	};
	let start = -1;
	let end = -1;
	map.forEach((entry, index) => {
		// A line break's space has no DOM character; it only counts inside.
		if (!entry.virtual && inRange(entry)) {
			if (start < 0) start = index;
			end = index;
		}
	});
	if (start < 0) {
		return null;
	}
	return { start, length: end - start + 1 };
};

const SCRAMBLE_ALPHABET =
	'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

const hashSeed = (seed: string): number => {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index++) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

/**
 * Random characters in the shape of `text`: every non-space character becomes
 * a letter or digit, spaces and line breaks stay. The same seed gives the
 * same salad, so the passage does not flicker between renders.
 */
export const scramblePassage = (text: string, seed: string): string => {
	let state = hashSeed(seed) || 1;
	const next = () => {
		// xorshift32
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return (state >>> 0) / 4294967296;
	};
	// One salad character per UTF-16 code unit: an emoji (two units) becomes
	// two characters, so the text length and every later offset stay put.
	let salad = '';
	for (let index = 0; index < text.length; index++) {
		const unit = text[index];
		salad += /\s/.test(unit)
			? unit
			: SCRAMBLE_ALPHABET[Math.floor(next() * SCRAMBLE_ALPHABET.length)];
	}
	return salad;
};

export interface ApplyPassageBlursOptions {
	/** Read by screen readers instead of the salad ("Blurred passage"). */
	label: string;
	/**
	 * Moderators can remove a blur: the passage becomes a button with this
	 * accessible name ("Remove blur").
	 */
	removeLabel?: string;
	/** Mixed into the scramble seed, usually the message's event id. */
	seed?: string;
}

const MENTION_ATTRIBUTES = ['data-id', 'data-label', 'title'];

/** Removes who a mention pill names; other elements are left alone. */
const stripMention = (element: Element) => {
	const mentionAttributes = element
		.getAttributeNames()
		.filter((name) => name.startsWith('data-mention'));
	if (
		!mentionAttributes.length &&
		element.getAttribute('data-type') !== 'mention'
	) {
		return;
	}
	[...mentionAttributes, ...MENTION_ATTRIBUTES].forEach((name) =>
		element.removeAttribute(name)
	);
};

/**
 * A task-list checkbox carries its task's text as `aria-label`
 * (nameTaskListCheckboxes). When that text is blurred, the label is rebuilt
 * from what is shown, with the blurred part read as `label`.
 */
const nameBlurredTasks = (root: Element, label: string) => {
	root.querySelectorAll('ul[data-type="taskList"] > li').forEach((item) => {
		const checkbox = item.querySelector(':scope > label > input');
		const task = item.querySelector(':scope > div');
		if (!checkbox || !task?.querySelector('.passageBlur')) {
			return;
		}
		const shown = task.cloneNode(true) as Element;
		shown
			.querySelectorAll('.passageBlur__srLabel')
			.forEach((node) => node.remove());
		shown
			.querySelectorAll('.passageBlur')
			.forEach((node) => node.replaceWith(` ${label} `));
		const text = (shown.textContent ?? '').replace(/\s+/g, ' ').trim();
		if (text) {
			checkbox.setAttribute('aria-label', text);
		} else {
			checkbox.removeAttribute('aria-label');
		}
	});
};

/** Text-node pieces one blur covers: node, first and last offset. */
type Piece = { node: Text; from: number; to: number; blur: PassageBlur };

/**
 * Splits the blurs into text-node pieces that never overlap. Where two blurs
 * cover the same character, the one that starts first owns it; the other
 * keeps the rest of its range, so either can still be removed on its own.
 */
const piecesOf = (map: Mapped[], blurs: PassageBlur[]): Piece[] => {
	const owner: (PassageBlur | undefined)[] = new Array(map.length);
	[...blurs]
		.sort((a, b) => a.start - b.start)
		.forEach((blur) => {
			for (
				let index = blur.start;
				index < blur.start + blur.length;
				index++
			) {
				owner[index] ??= blur;
			}
		});
	const pieces: Piece[] = [];
	let last: Piece | undefined;
	for (let index = 0; index < map.length; index++) {
		const blur = owner[index];
		// A line break's space has no DOM character to replace.
		if (!blur || map[index].virtual) {
			last = undefined;
			continue;
		}
		const { node, offset } = map[index];
		if (
			last &&
			last.node === node &&
			last.blur === blur &&
			last.to === offset - 1
		) {
			last.to = offset;
		} else {
			last = { node, from: offset, to: offset, blur };
			pieces.push(last);
		}
	}
	return pieces;
};

/**
 * Returns `html` with every blur's passage replaced by blurred random
 * characters. Blurs that no longer fit the text (an edited message) are
 * skipped rather than guessed.
 */
export const applyPassageBlursToHtml = (
	html: string,
	blurs: PassageBlur[] | null | undefined,
	{ label, removeLabel, seed = '' }: ApplyPassageBlursOptions
): string => {
	if (!blurs?.length || typeof document === 'undefined') {
		return html;
	}
	// A template parses without running scripts or loading images.
	const template = document.createElement('template');
	template.innerHTML = html;
	const root = document.createElement('div');
	root.appendChild(template.content);
	const { map } = collectText(root);

	const pieces = piecesOf(
		map,
		blurs.filter(
			(blur) =>
				blur.length > 0 &&
				blur.start >= 0 &&
				blur.start + blur.length <= map.length
		)
	);
	const firstPieceOf = new Set<Piece>();
	const seen = new Set<string>();
	pieces.forEach((piece) => {
		if (!seen.has(piece.blur.id)) {
			seen.add(piece.blur.id);
			firstPieceOf.add(piece);
		}
	});

	// Split from the end of each node backwards, so earlier offsets hold.
	[...pieces]
		.sort((a, b) =>
			a.node === b.node
				? b.from - a.from
				: a.node.compareDocumentPosition(b.node) &
					  Node.DOCUMENT_POSITION_FOLLOWING
					? 1
					: -1
		)
		.forEach((piece) => {
			const { node, from, to, blur } = piece;
			const middle = node.splitText(from);
			middle.splitText(to - from + 1);
			const span = document.createElement('span');
			span.className = 'passageBlur';
			span.dataset.passageBlurId = blur.id;
			span.textContent = scramblePassage(
				middle.data,
				`${seed}|${blur.id}|${from}`
			);
			if (removeLabel) {
				span.setAttribute('role', 'button');
				span.setAttribute('tabindex', '0');
				span.setAttribute('aria-label', removeLabel);
				span.classList.add('passageBlur--removable');
			} else {
				span.setAttribute('aria-hidden', 'true');
			}
			middle.replaceWith(span);
			// A blurred link must not lead anywhere: its target is the
			// hidden text (a phone number, an e-mail address).
			const link = span.closest('a');
			if (link) {
				link.removeAttribute('href');
				link.removeAttribute('target');
			}
			// A blurred @mention must not keep the person in its attributes
			// (data-mention-username, data-mention-matrix-id, data-label).
			for (
				let element = span.parentElement;
				element && element !== root;
				element = element.parentElement
			) {
				stripMention(element);
			}
			if (!removeLabel && firstPieceOf.has(piece)) {
				const srLabel = document.createElement('span');
				srLabel.className = 'passageBlur__srLabel';
				srLabel.textContent = label;
				span.before(srLabel);
			}
		});

	nameBlurredTasks(root, label);
	return root.innerHTML;
};
