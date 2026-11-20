/**
 * A received task list keeps its checkboxes (#1079), but the checkbox and its
 * text are siblings (`li > label > input` next to `li > div`), so a screen
 * reader announced "checkbox, checked" without saying which task. This copies
 * each item's text onto its checkbox as `aria-label`. Runs on already
 * sanitized HTML; the text is set as an attribute value, never parsed as HTML.
 */
export const nameTaskListCheckboxes = (html: string): string => {
	if (
		!/data-type="taskList"/.test(html) ||
		typeof DOMParser === 'undefined'
	) {
		return html;
	}

	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll('ul[data-type="taskList"] > li').forEach((item) => {
		const checkbox = item.querySelector(':scope > label > input');
		const text = item.querySelector(':scope > div')?.textContent?.trim();
		if (checkbox && text) {
			checkbox.setAttribute('aria-label', text);
		}
	});
	return doc.body.innerHTML;
};
