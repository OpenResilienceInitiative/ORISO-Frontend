import * as React from 'react';

import {
	ActiveSessionContext,
	E2EEContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ConsultantListContext } from '../../globalState/provider/ConsultantListProvider';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import type { UserDataInterface } from '../../globalState/interfaces';
import {
	mockActiveSession1on1,
	mockConsultantListContext,
	mockE2EEContext,
	mockServerSettingsContext,
	mockUserData
} from './MessageItemComponent.mocks';

/**
 * Shared shell for the chat-message stories.
 *
 * Two things it standardises, so individual story files do not re-invent them:
 *
 * 1. **Viewport width.** `compact` renders at 390px — the width used by the
 *    existing `AndroidCompactKebabTouchZone` story and the narrowest phone the
 *    app targets. Wide renders at 1000px, matching the desktop session view.
 *    Pair `compact` with `parameters.viewport.defaultViewport: 'mobile1'` so the
 *    toolbar and the shell agree.
 * 2. **The provider stack** a message row sits inside in production. Components
 *    that read `UserDataContext` (delivery ticks) or `ActiveSessionContext`
 *    (read-status rules) render blank or throw without it.
 */

export const STORY_WIDTH_COMPACT = 390;
export const STORY_WIDTH_WIDE = 1000;

export function MessageStoryShell({
	children,
	compact = false,
	background = '#ffffff'
}: {
	children: React.ReactNode;
	compact?: boolean;
	background?: string;
}) {
	return (
		<div
			style={{
				maxWidth: compact ? STORY_WIDTH_COMPACT : STORY_WIDTH_WIDE,
				padding: compact ? '16px 12px' : '24px 16px',
				background
			}}
		>
			{children}
		</div>
	);
}

export function MessageContextShell({
	children,
	compact = false,
	activeSession = mockActiveSession1on1(),
	userData = mockUserData()
}: {
	children: React.ReactNode;
	compact?: boolean;
	activeSession?: ExtendedSessionInterface;
	userData?: UserDataInterface;
}) {
	return (
		<ServerSettingsContext.Provider value={mockServerSettingsContext()}>
			<ConsultantListContext.Provider value={mockConsultantListContext()}>
				<E2EEContext.Provider value={mockE2EEContext()}>
					<UserDataContext.Provider
						value={{
							userData,
							setUserData: () => {},
							reloadUserData: async () => null as any
						}}
					>
						<ActiveSessionContext.Provider
							value={{
								activeSession,
								reloadActiveSession: () => {},
								readActiveSession: () => {}
							}}
						>
							<MessageStoryShell compact={compact}>
								{children}
							</MessageStoryShell>
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</E2EEContext.Provider>
			</ConsultantListContext.Provider>
		</ServerSettingsContext.Provider>
	);
}

/** Story parameters honoured by the shared decorators below. */
export type MessageStoryParameters = {
	activeSession?: ExtendedSessionInterface;
	userData?: UserDataInterface;
	compactShell?: boolean;
};

/** Decorator for components that need no session context — layout only. */
export const withMessageShell = (
	Story: React.ComponentType,
	{ parameters }: { parameters: MessageStoryParameters }
) => (
	<MessageStoryShell compact={Boolean(parameters.compactShell)}>
		<Story />
	</MessageStoryShell>
);

/** Decorator for components that read user/session context. */
export const withMessageContexts = (
	Story: React.ComponentType,
	{ parameters }: { parameters: MessageStoryParameters }
) => (
	<MessageContextShell
		compact={Boolean(parameters.compactShell)}
		activeSession={parameters.activeSession ?? mockActiveSession1on1()}
		userData={parameters.userData ?? mockUserData()}
	>
		<Story />
	</MessageContextShell>
);

/** Shorthand for the mobile parameter block, so every story spells it the same. */
export const mobileParameters = {
	compactShell: true,
	viewport: { defaultViewport: 'mobile1' }
};
