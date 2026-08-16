import {
	ContentState,
	convertToRaw,
	convertFromHTML,
	DraftHandleValue,
	Modifier,
	SelectionState,
	EditorState
} from 'draft-js';
import sanitizeHtml from 'sanitize-html';

export const emojiPickerCustomClasses = {
	emojiSelect: 'emoji__select',
	emojiSelectButton: 'emoji__selectButton',
	emojiSelectButtonPressed: 'emoji__selectButton--pressed',
	emojiSelectPopover: 'emoji__selectPopover',
	emojiSelectPopoverClosed: 'emoji__selectPopover--closed',
	emojiSelectPopoverTitle: 'emoji__selectPopover__title',
	emojiSelectPopoverGroups: 'emoji__selectPopover__groups',
	emojiSelectPopoverGroup: 'emoji__selectPopover__group',
	emojiSelectPopoverGroupTitle: 'emoji__selectPopover__groupTitle',
	emojiSelectPopoverGroupList: 'emoji__selectPopover__groupList',
	emojiSelectPopoverGroupItem: 'emoji__selectPopover__groupItem',
	emojiSelectPopoverToneSelect: 'emoji__selectPopover__toneSelect',
	emojiSelectPopoverToneSelectList: 'emoji__selectPopover__toneSelectList',
	emojiSelectPopoverToneSelectItem: 'emoji__selectPopover__toneSelectItem',
	emojiSelectPopoverEntry: 'emoji__selectPopover__entry',
	emojiSelectPopoverEntryFocused: 'emoji__selectPopover__entry--focused',
	emojiSelectPopoverEntryIcon: 'emoji__selectPopover__entryIcon',
	emojiSelectPopoverNav: 'emoji__selectPopover__nav',
	emojiSelectPopoverNavItem: 'emoji__selectPopover__navItem',
	emojiSelectPopoverNavEntry: 'emoji__selectPopover__navEntry',
	emojiSelectPopoverNavEntryActive: 'emoji__selectPopover__navEntry--active',
	emojiSelectPopoverScrollbar: 'emoji__selectPopover__scrollbar',
	emojiSelectPopoverScrollbarThumb: 'emoji__selectPopover__scrollbarThumb',
	emoji: 'emoji',
	emojiSuggestionsEntry: 'emoji__suggestionsEntry',
	emojiSuggestionsEntryFocused: 'emoji__suggestionsEntry--focused',
	emojiSuggestionsEntryText: 'emoji__suggestionsEntry__text',
	emojiSuggestionsEntryIcon: 'emoji__suggestionsEntry__icon',
	emojiSuggestions: 'emoji__suggestions'
};

export const toolbarCustomClasses = {
	toolbarStyles: {
		toolbar: 'textarea__toolbar'
	},
	buttonStyles: {
		button: 'textarea__toolbar__button',
		active: 'textarea__toolbar__button--active'
	}
};

export const INPUT_MAX_LENGTH = 7500;

export const handleEditorBeforeInput = (editorState): DraftHandleValue => {
	const currentContent = editorState.getCurrentContent();
	const currentContentLength = currentContent.getPlainText('').length;

	if (currentContentLength > INPUT_MAX_LENGTH - 1) {
		return 'handled';
	} else {
		return 'not-handled';
	}
};

export const handleEditorPastedText = (
	editorState: EditorState,
	text: string,
	html?: string
): EditorState => {
	const pastedContent = html ?? text;
	const currentContent = editorState.getCurrentContent();
	const currentContentLength = currentContent.getPlainText('').length;

	if (currentContentLength + text.length > INPUT_MAX_LENGTH) {
		return null;
	} else {
		const { contentBlocks, entityMap } = convertFromHTML(
			sanitizeHtml(pastedContent, sanitizeHtmlPasteOptions)
		);
		const contentState = Modifier.replaceWithFragment(
			editorState.getCurrentContent(),
			editorState.getSelection(),
			ContentState.createFromBlockArray(
				contentBlocks,
				entityMap
			).getBlockMap()
		);
		return EditorState.push(editorState, contentState, 'insert-fragment');
	}
};

export const urlifyLinksInText = (text) => {
	var urlRegex =
		/(?:([Hh]ttps?:\/\/|[Rr]tsp:\/\/)|([Mm]ailto:)(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?(?:(?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|digital|live|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]|localhost|local))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?(?:\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi; // eslint-disable-line
	return text.replace(urlRegex, function (url, protocol, mailto) {
		const target = mailto ? '_self' : '_blank';
		const href = protocol || mailto ? url : `http://${url}`; // eslint-disable-line
		return `<a href="${href}" target=${target}>${url.replace(mailto, '')}</a>`;
	});
};

export const markdownToDraftDefaultOptions = {
	remarkablePreset: 'commonmark',
	remarkableOptions: {
		html: true,
		breaks: true
	}
};

export const sanitizeHtmlPasteOptions = {
	allowedTags: ['em', 'p', 'div', 'b', 'i', 'ol', 'ul', 'li', 'strong', 'br']
};

export const sanitizeHtmlExtendedPasteOptions = {
	allowedTags: [
		...sanitizeHtmlPasteOptions.allowedTags,
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'a'
	]
};

export const sanitizeHtmlDefaultOptions = {
	parseStyleAttributes: true,
	allowedTags: [
		...sanitizeHtmlPasteOptions.allowedTags,
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'a',
		'blockquote',
		'u',
		'sup',
		'sub',
		'code',
		'pre',
		'mark',
		'span',
		's',
		'strike',
		'img',
		// Task lists (#1079): without these the checkbox structure is stripped
		// and a list the sender saw as ☑ / ☐ arrives as plain bullets. Both are
		// forced inert by `transformTags` below.
		'input',
		'label'
	],
	allowedAttributes: {
		...sanitizeHtml.defaults.allowedAttributes,
		// #1080: `rel` has to be allowed before `transformTags` can force it.
		a: ['href', 'name', 'target', 'rel'],
		div: ['style', 'class'],
		// Task-list state travels on the list item and its checkbox.
		ul: ['data-type'],
		li: ['data-checked', 'data-type'],
		input: ['type', 'checked', 'disabled'],
		p: ['style'],
		h1: ['style'],
		h2: ['style'],
		h3: ['style'],
		h4: ['style'],
		h5: ['style'],
		h6: ['style'],
		mark: ['style', 'data-color'],
		span: [
			'style',
			'class',
			'data-color',
			'data-mention-id',
			'data-mention-username',
			'data-mention-matrix-id'
		],
		img: [
			'src',
			'alt',
			'title',
			'width',
			'height',
			'loading',
			'decoding',
			'class'
		]
	},
	allowedStyles: {
		div: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		p: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h1: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h2: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h3: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h4: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h5: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		h6: {
			'text-align': [/^left$/i, /^center$/i, /^right$/i]
		},
		mark: {
			'background-color': [
				/^#[0-9a-fA-F]{3,8}$/,
				/^rgb\(/,
				/^rgba\(/,
				/^hsl\(/,
				/^hsla\(/
			]
		},
		span: {
			'color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/],
			'background-color': [
				/^#[0-9a-fA-F]{3,8}$/,
				/^rgb\(/,
				/^rgba\(/,
				/^hsl\(/,
				/^hsla\(/
			]
		}
	},
	transformTags: {
		/**
		 * #1080 — every rendered link is forced to `rel="noopener noreferrer
		 * nofollow"`, whatever the sender's client produced. Forced rather than
		 * merely allowed: an old message, or a hostile body, must not be able
		 * to opt out and hand the opened page a live `window.opener` handle on
		 * the counselling tab.
		 */
		a: (tagName, attribs) => ({
			tagName,
			attribs: {
				...attribs,
				rel: 'noopener noreferrer nofollow'
			}
		}),
		/**
		 * #1079 — a task-list checkbox may be *displayed* but never operated:
		 * the reader is looking at the sender's list, not their own. Type and
		 * disabled state are forced so no other input kind can slip through the
		 * newly allowed `input` tag.
		 */
		input: (tagName, attribs) => ({
			tagName,
			attribs: {
				type: 'checkbox',
				disabled: 'disabled',
				...(attribs.checked !== undefined ? { checked: 'checked' } : {})
			}
		}),
		mark: (tagName, attribs) => {
			const dataColor = attribs['data-color'] || '';
			const extractedFromStyle =
				attribs.style?.match(/background-color\s*:\s*([^;]+)/i)?.[1] ||
				'';
			const candidate = normalizeHighlightColor(
				dataColor || extractedFromStyle
			);
			if (!candidate) {
				return { tagName, attribs: { ...attribs } };
			}
			return {
				tagName,
				attribs: {
					...attribs,
					'data-color': candidate
				}
			};
		}
	}
};

export function normalizeHighlightColor(
	rawValue?: string | null
): string | null {
	const highlightColorMap: Record<string, string> = {
		yellow: '#fff59d',
		orange: '#ffcc80',
		rose: '#ffcdd2',
		mint: '#b2f2bb',
		blue: '#b3e5fc'
	};
	const normalizeHex = (input: string): string => {
		const hex = input.toLowerCase();
		if (hex.length === 4) {
			return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
		}
		return hex;
	};
	const toHex = (num: number): string =>
		Math.max(0, Math.min(255, num)).toString(16).padStart(2, '0');
	const rgbStringToHex = (input: string): string | null => {
		const rgbMatch = input.match(
			/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i
		);
		if (!rgbMatch) {
			return null;
		}
		return `#${toHex(Number(rgbMatch[1]))}${toHex(Number(rgbMatch[2]))}${toHex(
			Number(rgbMatch[3])
		)}`;
	};
	if (!rawValue) {
		return null;
	}

	const value = rawValue.trim();
	const lowerValue = value.toLowerCase();

	if (highlightColorMap[lowerValue]) {
		return highlightColorMap[lowerValue];
	}

	for (const [name, hex] of Object.entries(highlightColorMap)) {
		if (lowerValue.includes(name)) {
			return hex;
		}
	}

	const fallbackHexMatch = lowerValue.match(/#[0-9a-f]{3,8}/);
	if (fallbackHexMatch) {
		return normalizeHex(fallbackHexMatch[0]);
	}

	const rgbHex = rgbStringToHex(lowerValue);
	if (rgbHex) {
		return rgbHex;
	}

	if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
		return normalizeHex(value);
	}

	if (/^rgba?\(/i.test(value) || /^hsla?\(/i.test(value)) {
		return value;
	}

	return null;
}

export const sanitizeHtmlExtendedOptions = {
	allowedTags: [...sanitizeHtmlExtendedPasteOptions.allowedTags],
	allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
	transformTags: {
		a: sanitizeHtml.simpleTransform('a', { target: '_blank' })
	}
};

/**
 * Escape markdown characters typed by the user
 * @param contentState
 */
export const escapeMarkdownChars = (contentState: ContentState) => {
	let newContentState = contentState;
	const rawDraftObject = convertToRaw(contentState);

	rawDraftObject.blocks.forEach((block) => {
		const selectionState = SelectionState.createEmpty(block.key);
		let counter = 0;
		newContentState = [...block.text].reduce(
			(contentState, char, charIndex) => {
				if (['*', '_', '~', '`'].indexOf(char) < 0) return contentState;

				const selection = selectionState.merge({
					focusOffset: charIndex + counter,
					anchorOffset: charIndex + counter
				});
				counter++;
				return Modifier.insertText(contentState, selection, '\\');
			},
			newContentState
		);
	});

	return newContentState;
};
