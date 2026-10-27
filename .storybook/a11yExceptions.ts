/*
 * Elements the accessibility gate leaves as designed (#1338). axe still
 * audits everything else: each entry takes one element out of one rule, with
 * the reason beside it.
 *
 * Storybook replaces arrays instead of merging them, so a story that set its
 * own `a11y.config.rules` would silently drop these. A story adds its own
 * exceptions through `a11yExcept`, which always carries the shared ones:
 *
 *   parameters: { a11y: a11yExcept({ 'color-contrast': ['.chip__date'] }) }
 */
const designed: Record<string, string[]> = {
	// Each language chip holds its remove button next to the tab, inside the
	// tablist. Moving it out changes the chip and its keyboard path.
	'aria-required-children': ['.createChat__languageTabs'],
	// Carousel dots (6 px) and the voice message's waveform bars are smaller
	// than 24 px by design.
	'target-size': [
		'[data-cy="handover-carousel-dots"] button',
		'.voicePlayer__tile'
	],
	// The handover carousel scrolls with its dots, which take the focus.
	'scrollable-region-focusable': ['[data-cy="handover-carousel"]']
};

export const a11yExcept = (own: Record<string, string[]> = {}) => ({
	config: {
		rules: [
			...new Set([...Object.keys(designed), ...Object.keys(own)])
		].map((id) => ({
			id,
			selector:
				'*' +
				[...(designed[id] ?? []), ...(own[id] ?? [])]
					.map((element) => `:not(${element})`)
					.join('')
		}))
	}
});
