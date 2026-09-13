/**
 * Which side pane the chat card ACTUALLY shows (review B2 D-4).
 *
 * `?channel=` in the URL is the request; the card resolves it against what
 * exists (an asker never gets supervision, a thread needs its root in the
 * loaded history, the side room may be missing). The list column must snap
 * to the icon rail only for a pane that is really open, so the card reports
 * the resolved pane here and `SessionsListWrapper` reads it — never the URL.
 *
 * Provided once above both columns (`SessionsZone`); absent elsewhere, in
 * which case nothing is open.
 */
import * as React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

export type ChatStageOpenPanel = 'supervision' | 'thread' | null;

export interface ChatStagePanelContextValue {
	openPanel: ChatStageOpenPanel;
	setOpenPanel: (panel: ChatStageOpenPanel) => void;
}

const noop = () => undefined;

export const ChatStagePanelContext =
	createContext<ChatStagePanelContextValue | null>(null);

export const ChatStagePanelProvider = ({
	children,
	initialOpenPanel = null
}: {
	children: React.ReactNode;
	/** Tests only — the card reports the live value. */
	initialOpenPanel?: ChatStageOpenPanel;
}) => {
	const [openPanel, setOpenPanel] =
		useState<ChatStageOpenPanel>(initialOpenPanel);
	const value = useMemo(() => ({ openPanel, setOpenPanel }), [openPanel]);
	return (
		<ChatStagePanelContext.Provider value={value}>
			{children}
		</ChatStagePanelContext.Provider>
	);
};

/** The pane the card shows right now; `null` outside the provider. */
export const useChatStageOpenPanel = (): ChatStageOpenPanel =>
	useContext(ChatStagePanelContext)?.openPanel ?? null;

/** For the card: report the resolved pane (no-op outside the provider). */
export const useReportChatStagePanel = (): ((
	panel: ChatStageOpenPanel
) => void) => useContext(ChatStagePanelContext)?.setOpenPanel ?? noop;
