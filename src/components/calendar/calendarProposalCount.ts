/**
 * How many move proposals wait for the counsellor's answer: "Meine Termine"
 * in the navigation shows it as a count. The calendar knows it first (it
 * loads the proposals and changes them), so it tells the navigation through
 * a window event, the way appointment changes reach the timeline.
 */
const COUNT_EVENT = 'oriso:calendar-received-proposals';

export const publishReceivedProposalCount = (count: number) => {
	window.dispatchEvent(
		new CustomEvent<number>(COUNT_EVENT, { detail: count })
	);
};

export const onReceivedProposalCount = (listener: (count: number) => void) => {
	const handle = (event: Event) => {
		const count = (event as CustomEvent<number>).detail;
		if (typeof count === 'number') listener(count);
	};
	window.addEventListener(COUNT_EVENT, handle);
	return () => window.removeEventListener(COUNT_EVENT, handle);
};
