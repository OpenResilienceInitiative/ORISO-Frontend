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
 * 1. **Viewport width, taken from the stylesheet rather than guessed.** The
 *    message layer switches layout at **900px**: `message.styles.scss` carries
 *    nine `@media screen and (width <= 899px)` blocks against one
 *    `(width >= 900px)`. The bubble itself caps at
 *    `min(calc(100% - 41px), 834px)`, so a desktop frame only shows something
 *    new up to roughly 900px — beyond that the bubble stops growing.
 *    Pair `compact` with `parameters.viewport.defaultViewport: 'mobile1'` so the
 *    toolbar and the shell agree.
 * 2. **The provider stack** a message row sits inside in production. Components
 *    that read `UserDataContext` (delivery ticks) or `ActiveSessionContext`
 *    (read-status rules) render blank or throw without it.
 */

/** Smallest phone still in use (iPhone SE / 8). Several layouts break here. */
export const STORY_WIDTH_PHONE_SMALL = 375;
/** Common phone width; the shell's `compact` default. */
export const STORY_WIDTH_COMPACT = 390;
/** Last pixel of the narrow layout — `width <= 899px` in message.styles.scss. */
export const STORY_WIDTH_NARROW_MAX = 899;
/** First pixel of the desktop layout — `width >= 900px`. */
export const STORY_WIDTH_WIDE = 900;
/** The bubble's own cap: `min(calc(100% - 41px), 834px)`. */
export const BUBBLE_MAX_WIDTH = 834;

/**
 * Realistic generated display names, computed from the shipped tables in
 * `utils/anonName/data.ts` rather than invented.
 *
 * German worst case is **31 characters**: longest adjective (12, "absichtslose")
 * + longest animal (11, "Schildkröte") + longest given name (6, "Andrea").
 * Anything longer cannot occur, so testing wrapping with a 50-character name
 * exercises a case the product never produces.
 *
 * Note this is the **display** name. The separate *login* name is capped at
 * `USERNAME_MAX_LENGTH` (30) and drops the adjective — "katze_mika_1234".
 */
export const PSEUDONYM_TYPICAL = 'sanftes Alpaka Mika';
export const PSEUDONYM_LONGEST = 'absichtslose Schildkröte Andrea';
export const LOGIN_NAME_EXAMPLE = 'schildkroete_andrea_1234';

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
