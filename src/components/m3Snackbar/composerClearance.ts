/** A floating notice must leave every visible conversation's input usable. */
export const COMPOSER_BOTTOM_CLEARANCE_PROPERTY =
	'--oriso-composer-bottom-clearance';
export const COMPOSER_BOTTOM_CLEARANCE = `var(${COMPOSER_BOTTOM_CLEARANCE_PROPERTY}, 0px)`;

const docks = new Map<HTMLElement, number>();

const publishClearance = () => {
	let clearance = 0;
	for (const [dock, noticeGap] of docks) {
		const rect = dock.getBoundingClientRect();
		if (
			dock.isConnected &&
			rect.width > 0 &&
			rect.height > 0 &&
			rect.bottom > 0 &&
			rect.top < window.innerHeight &&
			rect.right > 0 &&
			rect.left < window.innerWidth
		) {
			clearance = Math.max(
				clearance,
				window.innerHeight - rect.top + noticeGap
			);
		}
	}
	if (clearance) {
		document.documentElement.style.setProperty(
			COMPOSER_BOTTOM_CLEARANCE_PROPERTY,
			`${Math.ceil(clearance)}px`
		);
	} else {
		document.documentElement.style.removeProperty(
			COMPOSER_BOTTOM_CLEARANCE_PROPERTY
		);
	}
};

/** Called by the existing dock observer, including auto-grow and side panels. */
export const updateComposerClearance = (
	dock: HTMLElement,
	noticeGap: number
) => {
	docks.set(dock, noticeGap);
	publishClearance();
};

export const removeComposerClearance = (dock: HTMLElement) => {
	docks.delete(dock);
	publishClearance();
};
