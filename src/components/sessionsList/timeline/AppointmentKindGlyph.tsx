/**
 * The symbol of one appointment: what kind it is (chat, audio, video, on site),
 * or a plain calendar while the kind is unknown. Weight 400, so it still reads
 * at the small size of a rail mark.
 */
import * as React from 'react';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { ReactComponent as ChatIcon } from '../../../resources/img/icons/modality-chat.svg';
import { ReactComponent as AudioIcon } from '../../../resources/img/icons/modality-audio.svg';
import { ReactComponent as VideoIcon } from '../../../resources/img/icons/modality-video.svg';
import { ReactComponent as LocationIcon } from '../../../resources/img/icons/location.svg';
import type { EntryModality } from './timelineModel';

export const MODALITY_ICON: Record<
	EntryModality,
	React.FC<React.SVGProps<SVGSVGElement>>
> = {
	chat: ChatIcon,
	audio: AudioIcon,
	video: VideoIcon,
	location: LocationIcon
};

export const AppointmentKindGlyph = ({
	modality
}: {
	modality?: EntryModality;
}) => {
	const Icon = modality ? MODALITY_ICON[modality] : EventOutlinedIcon;
	return <Icon aria-hidden="true" focusable="false" />;
};
