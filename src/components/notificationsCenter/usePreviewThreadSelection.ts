import { useState } from 'react';

/** One thread selection shared by the visible preview and Timeline tracking. */
export const usePreviewThreadSelection = (
	visible: boolean,
	roomId: string | null | undefined,
	sourceThreadId: string | null | undefined
) => {
	const key = JSON.stringify([
		visible,
		roomId ?? null,
		sourceThreadId ?? null
	]);
	const [selection, setSelection] = useState<{
		key: string;
		threadRootId: string | null;
	} | null>(null);
	// Reset during render so effects cannot observe an obsolete selection.
	if (selection && selection.key !== key) setSelection(null);
	return {
		openedThreadRootId:
			selection?.key === key ? selection.threadRootId : null,
		setOpenedThreadRootId: (threadRootId: string | null) =>
			setSelection({ key, threadRootId })
	};
};
