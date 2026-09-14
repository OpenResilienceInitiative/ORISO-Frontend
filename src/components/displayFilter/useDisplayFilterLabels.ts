import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DisplayFilterDialogLabels } from './DisplayFilterDialog';

export type DisplayFilterSection = 'timeline' | 'sessions' | 'requests';

/**
 * Translated strings for the display-filter button and dialog (#1377). Kept
 * out of the presentational components so they never call `t` themselves
 * (same rule as `M3Dialog`) and Storybook/unit tests can pass plain labels.
 */
export const useDisplayFilterLabels = (
	section: DisplayFilterSection
): {
	buttonLabel: string;
	buttonCustomisedLabel: string;
	dialogLabels: DisplayFilterDialogLabels;
} => {
	const { t } = useTranslation();
	return useMemo(
		() => ({
			buttonLabel: t('notifications.displayFilter.button'),
			buttonCustomisedLabel: t(
				'notifications.displayFilter.buttonCustomised'
			),
			dialogLabels: {
				title: `${t('notifications.displayFilter.title')} · ${t(
					`notifications.displayFilter.sections.${section}`
				)}`,
				description: t('notifications.displayFilter.description'),
				showColumn: t('notifications.displayFilter.showColumn'),
				pillColumn: t('notifications.displayFilter.pillColumn'),
				showKind: (kind: string) =>
					t('notifications.displayFilter.showKind', { kind }),
				pillKind: (kind: string) =>
					t('notifications.displayFilter.pillKind', { kind }),
				otherFixed: t('notifications.displayFilter.otherFixed'),
				pillNotApplicable: t(
					'notifications.displayFilter.pillNotApplicable'
				),
				// Gespräche (spec §6.2): the switch only excludes hidden chats
				// from the local unread count; nothing is marked read and no
				// receipt is sent, so the copy must not promise that.
				autoRead: t(
					section === 'sessions'
						? 'notifications.displayFilter.autoReadSessions'
						: 'notifications.displayFilter.autoRead'
				),
				autoReadDescription: t(
					section === 'sessions'
						? 'notifications.displayFilter.autoReadSessionsDescription'
						: 'notifications.displayFilter.autoReadDescription'
				),
				reset: t('notifications.displayFilter.reset'),
				done: t('notifications.displayFilter.done'),
				close: t('app.close'),
				profileLink: t('notifications.displayFilter.profileLink'),
				readOnlyHint: t('notifications.displayFilter.readOnlyHint')
			}
		}),
		[section, t]
	);
};
