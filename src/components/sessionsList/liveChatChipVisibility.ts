/**
 * Whether the Live-Chat chip / display-filter kind belongs on the toolbar.
 *
 * Availability answers "may NEW live chats be routed to me"; it must never
 * decide whether an EXISTING one stays reachable (#1404). A consultant who
 * flips the rail toggle off — or whose availability lease simply expires
 * while they are counselling — otherwise loses the chip that leads back into
 * the live chat they are in.
 */
export const isLiveChatChipVisible = ({
	available,
	hasLiveChatRow
}: {
	/** Backend-authoritative live-chat availability of this consultant. */
	available: boolean;
	/** The list currently holds at least one live-chat conversation. */
	hasLiveChatRow: boolean;
}): boolean => available || hasLiveChatRow;
