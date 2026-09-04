/**
 * WP-B2 — lets the session header menu (`SessionMenu`, three components deep)
 * expand the panel without threading props through `SessionHeaderComponent`.
 * Provided by `SessionItemComponent`; absent (null) everywhere else.
 */
import { createContext, useContext } from 'react';

export interface SupervisionPanelContextValue {
	/** The viewer may see the entry at all (consultant or supervisor, never an asker). */
	visible: boolean;
	/** A side room exists → the entry is enabled. Disabled otherwise (never hidden). */
	available: boolean;
	isExpanded: boolean;
	unreadCount: number;
	expand: () => void;
}

export const SupervisionPanelContext =
	createContext<SupervisionPanelContextValue | null>(null);

export const useSupervisionPanel = () => useContext(SupervisionPanelContext);
