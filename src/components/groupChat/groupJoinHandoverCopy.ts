import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegistrationHandoverProps } from '../app/registrationLoader/RegistrationHandover';
import { SELF_HELP_INFO_STEPS } from './entryRoom/GroupInfoGallery';

/**
 * The handover screen's words while someone joins a self-help group (#1499).
 * Joining a group opens no counselling enquiry, so nothing here may promise an
 * answer from a counselling centre; the cards are the group's own three.
 */
export const useGroupJoinHandoverCopy = (): NonNullable<
	RegistrationHandoverProps['copy']
> => {
	const { t } = useTranslation();
	return useMemo(
		() => ({
			badge: t('groupChat.joinHandover.badge', 'Gesprächskreis'),
			subline: t(
				'groupChat.joinHandover.subline',
				'So läuft es in der Gruppe:'
			),
			encryption: t(
				'groupChat.joinHandover.encryption',
				'Verschlüsselt: Was in der Gruppe geschrieben wird, sehen nur ihre Mitglieder.'
			),
			cta: t('groupChat.joinHandover.cta', 'Zur Gruppe'),
			status: {
				preparing: t(
					'groupChat.joinHandover.status.preparing',
					'Gruppenraum wird vorbereitet …'
				),
				ready: t(
					'groupChat.joinHandover.status.ready',
					'Alles bereit — Sie können zur Gruppe'
				),
				slow: t(
					'groupChat.joinHandover.status.slow',
					'Das dauert länger als gewohnt'
				),
				entering: t(
					'groupChat.joinHandover.status.entering',
					'Der Gruppenraum wird geöffnet …'
				)
			},
			steps: SELF_HELP_INFO_STEPS
		}),
		[t]
	);
};
