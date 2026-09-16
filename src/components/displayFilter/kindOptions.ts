/**
 * Icons and labels of the display-filter kinds per section (#1377). One
 * place so the list dialogs (slices 3–5) and the profile page (slice 6)
 * name and draw a kind identically.
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { familyLabelKey } from '../notificationsCenter/eventDescriptors/registry';
import { ReactComponent as MessagesKindIcon } from '../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as RequestKindIcon } from '../../resources/img/icons/display-filter-request.svg';
import { ReactComponent as DraftKindIcon } from '../../resources/img/icons/display-filter-draft.svg';
import { ReactComponent as HandoverKindIcon } from '../../resources/img/icons/display-filter-handover.svg';
import { ReactComponent as CallKindIcon } from '../../resources/img/icons/display-filter-call.svg';
import { ReactComponent as SystemKindIcon } from '../../resources/img/icons/display-filter-system.svg';
import { ReactComponent as AppointmentKindIcon } from '../../resources/img/icons/display-filter-appointment.svg';
import { ReactComponent as OtherKindIcon } from '../../resources/img/icons/display-filter-other.svg';
import { ReactComponent as FutureTimelineKindIcon } from '../../resources/img/icons/calendar.svg';
import {
	ArchiveFilterIcon,
	CreateChatFilterIcon,
	DraftFilterIcon,
	GroupFilterIcon,
	InternalGroupFilterIcon,
	LiveChatFilterIcon,
	MailFilterIcon,
	SupervisionFilterIcon,
	UnreadFilterIcon
} from '../sessionsList/SessionToolbarFilterIcons';

export type KindIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/** Zeitstrahl kinds: Frank's `display-filter-*` set; "Nachrichten" keeps the rail's bubble. */
export const TIMELINE_KIND_ICONS: Record<string, KindIcon> = {
	requests: RequestKindIcon,
	messages: MessagesKindIcon,
	drafts: DraftKindIcon,
	handover: HandoverKindIcon,
	calls: CallKindIcon,
	system: SystemKindIcon,
	appointments: AppointmentKindIcon,
	other: OtherKindIcon
};

/** Gespräche/Anfragen kinds: the toolbar's own chip icons. */
export const SESSION_KIND_ICONS: Record<string, KindIcon> = {
	create: CreateChatFilterIcon as unknown as KindIcon,
	unread: UnreadFilterIcon as unknown as KindIcon,
	drafts: DraftFilterIcon as unknown as KindIcon,
	oneToOne: MailFilterIcon as unknown as KindIcon,
	nearby: MailFilterIcon as unknown as KindIcon,
	liveChat: LiveChatFilterIcon as unknown as KindIcon,
	internalGroup: InternalGroupFilterIcon as unknown as KindIcon,
	circle: GroupFilterIcon as unknown as KindIcon,
	supervision: SupervisionFilterIcon as unknown as KindIcon,
	archive: ArchiveFilterIcon as unknown as KindIcon,
	appointments: AppointmentKindIcon,
	futureTimeline: FutureTimelineKindIcon,
	other: OtherKindIcon
};

type Translate = TFunction | ((key: string) => string);

export const timelineKindLabel = (t: Translate, kind: string): string =>
	kind === 'other'
		? t('notifications.displayFilter.otherKind')
		: t(familyLabelKey(kind as never));

export const sessionKindLabel = (t: Translate, kind: string): string => {
	switch (kind) {
		case 'other':
			return t('notifications.displayFilter.otherKind');
		case 'futureTimeline':
			return t('groupChat.futureTimeline.ariaLabel');
		case 'circle':
			return t('sessionList.toolbar.chips.groups');
		case 'archive':
			return t('sessionList.toolbar.chips.archive');
		case 'create':
			return t('sessionList.toolbar.chips.createRow');
		case 'appointments':
			return t('notifications.families.appointments');
		default:
			return t(`sessionList.toolbar.chips.${kind}`);
	}
};
