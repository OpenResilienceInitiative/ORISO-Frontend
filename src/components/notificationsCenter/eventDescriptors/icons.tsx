/**
 * WP-06 Activity Timeline — Event-descriptor icons (Slice 0a).
 *
 * Resolves an {@link EventIconId} to its SVG React component. Kept separate from
 * the (pure) registry so `registry.ts` / `types.ts` stay free of SVG/React
 * imports and remain unit-testable in isolation.
 */

import * as React from 'react';
import { ReactComponent as RequestNewIcon } from '../../../resources/img/icons/speech-bubble-plus.svg';
import { ReactComponent as RequestAcceptedIcon } from '../../../resources/img/icons/checkmark_circle.svg';
import { ReactComponent as MessageIcon } from '../../../resources/img/icons/speech-bubble.svg';
import { ReactComponent as ThreadReplyIcon } from '../../../resources/img/icons/corner-up-left.svg';
import { ReactComponent as DraftIcon } from '../../../resources/img/icons/pen-paper.svg';
import { ReactComponent as HandoverIcon } from '../../../resources/img/icons/persons-two.svg';
import { ReactComponent as CallStartedIcon } from '../../../resources/img/icons/call-on.svg';
import { ReactComponent as CallEndedIcon } from '../../../resources/img/icons/call.svg';
import { ReactComponent as CallMissedIcon } from '../../../resources/img/icons/call-off.svg';
import { ReactComponent as SupervisorIcon } from '../../../resources/img/icons/shield.svg';
import { ReactComponent as RenameIcon } from '../../../resources/img/icons/pen.svg';
import { ReactComponent as SystemIcon } from '../../../resources/img/icons/notification_bell.svg';
import { EventIconId } from './types';

type SvgIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export const EVENT_ICONS: Record<EventIconId, SvgIcon> = {
	requestNew: RequestNewIcon,
	requestAccepted: RequestAcceptedIcon,
	message: MessageIcon,
	threadReply: ThreadReplyIcon,
	draft: DraftIcon,
	handover: HandoverIcon,
	callStarted: CallStartedIcon,
	callEnded: CallEndedIcon,
	callMissed: CallMissedIcon,
	supervisor: SupervisorIcon,
	rename: RenameIcon,
	system: SystemIcon
};

/** Resolve an icon component by id, falling back to the generic system icon. */
export const getEventIcon = (iconId: EventIconId): SvgIcon =>
	EVENT_ICONS[iconId] || EVENT_ICONS.system;
