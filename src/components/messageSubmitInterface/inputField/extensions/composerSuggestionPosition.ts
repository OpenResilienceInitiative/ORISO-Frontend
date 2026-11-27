import { shift, size } from '@floating-ui/dom';
import type { SuggestionOptions } from '@tiptap/suggestion';

export const composerSuggestionPosition = {
	placement: 'top-start',
	offset: { mainAxis: 6 },
	floatingUi: {
		strategy: 'fixed',
		middleware: [
			shift({ padding: 8 }),
			size({
				padding: 8,
				apply: ({ availableHeight, elements }) => {
					elements.floating.style.setProperty(
						'--composer-suggestion-height',
						`${Math.max(0, availableHeight)}px`
					);
				}
			})
		]
	}
} satisfies Pick<SuggestionOptions, 'placement' | 'offset' | 'floatingUi'>;
