import { useEffect, useState } from 'react';

export const FOREIGN_MUI_MODAL_SELECTOR = '.MuiModal-root';

export const hasForeignMuiModal = (root: ParentNode = document) =>
	root.querySelectorAll(FOREIGN_MUI_MODAL_SELECTOR).length > 0;

export const shouldActivateOverlayFocusTrap = (
	wantsTrap: boolean,
	foreignModalOpen: boolean
) => wantsTrap && !foreignModalOpen;

/**
 * #1326: a MUI `Dialog` (e.g. the key-backup recovery prompt) can be open
 * at the same time as Overlay, each running its own focus trap. The two
 * mount from unrelated parts of the tree, so a query at render time can be
 * stale. This observer stays current for both the synchronous Storybook
 * case and the racy real-app case where the MUI dialog appears later.
 */
export const useForeignMuiModalOpen = () => {
	const [foreignModalOpen, setForeignModalOpen] = useState(false);
	useEffect(() => {
		const checkForeignModal = () =>
			setForeignModalOpen(hasForeignMuiModal());
		checkForeignModal();
		const observer = new MutationObserver(checkForeignModal);
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, []);
	return foreignModalOpen;
};
