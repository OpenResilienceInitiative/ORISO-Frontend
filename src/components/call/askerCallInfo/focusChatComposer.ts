/**
 * "Termin anfragen" without a booking flow yet: the advice seeker writes the
 * wish into the conversation. The composer lives in another branch of the
 * tree, so it is found by its stable class. Returns whether it was found.
 */
export const focusChatComposer = (): boolean => {
	const editor = document.querySelector<HTMLElement>(
		'.textarea__input [contenteditable="true"]'
	);
	if (!editor) return false;
	editor.focus();
	return true;
};
