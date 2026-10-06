import { ReactComponent as Date400Icon } from '../../resources/img/icons/schedule-date.svg';
import { ReactComponent as StartTime400Icon } from '../../resources/img/icons/schedule-start.svg';
import { ReactComponent as Duration400Icon } from '../../resources/img/icons/schedule-duration.svg';
import { ReactComponent as Repeat400Icon } from '../../resources/img/icons/schedule-repeat.svg';
import { ReactComponent as Interval400Icon } from '../../resources/img/icons/interval-cycle-400.svg';
import { ReactComponent as IntervalFilledIcon } from '../../resources/img/icons/interval-cycle-filled.svg';
import { ReactComponent as Medium400Icon } from '../../resources/img/icons/schedule-medium.svg';
import { ReactComponent as Video400Icon } from '../../resources/img/icons/modality-video.svg';
import { ReactComponent as VideoFilledIcon } from '../../resources/img/icons/modality-video-filled.svg';
import { ReactComponent as Audio400Icon } from '../../resources/img/icons/modality-audio.svg';
import { ReactComponent as AudioFilledIcon } from '../../resources/img/icons/modality-audio-filled.svg';
import { ReactComponent as Chat400Icon } from '../../resources/img/icons/modality-chat.svg';
import { ReactComponent as ChatFilledIcon } from '../../resources/img/icons/modality-chat-filled.svg';
import { ReactComponent as Language400Icon } from '../../resources/img/icons/schedule-language.svg';

export {
	Audio400Icon,
	AudioFilledIcon,
	Chat400Icon,
	ChatFilledIcon,
	Date400Icon,
	Duration400Icon,
	Interval400Icon,
	IntervalFilledIcon,
	Language400Icon,
	Medium400Icon,
	Repeat400Icon,
	StartTime400Icon,
	Video400Icon,
	VideoFilledIcon
};

/**
 * Canonical icon inventory for the reusable Gesprächskreis controls.
 * A `400` suffix denotes the resting outline glyph; `Filled` is its selected
 * partner. Icons without a selected variant are intentionally listed once.
 */
export const conversationCreateIconCatalog = [
	{ name: 'Datum', weight: '400 / Outline', Icon: Date400Icon },
	{ name: 'Startzeit', weight: '400 / Outline', Icon: StartTime400Icon },
	{ name: 'Dauer', weight: '400 / Outline', Icon: Duration400Icon },
	{ name: 'Intervall', weight: '400 / Outline', Icon: Interval400Icon },
	{
		name: 'Intervall',
		weight: 'Filled / Selected',
		Icon: IntervalFilledIcon
	},
	{ name: 'Wiederholungen', weight: '400 / Outline', Icon: Repeat400Icon },
	{ name: 'Primäres Medium', weight: '400 / Outline', Icon: Medium400Icon },
	{ name: 'Textnachrichten', weight: '400 / Outline', Icon: Chat400Icon },
	{
		name: 'Textnachrichten',
		weight: 'Filled / Selected',
		Icon: ChatFilledIcon
	},
	{ name: 'Audio', weight: '400 / Outline', Icon: Audio400Icon },
	{ name: 'Audio', weight: 'Filled / Selected', Icon: AudioFilledIcon },
	{ name: 'Video', weight: '400 / Outline', Icon: Video400Icon },
	{ name: 'Video', weight: 'Filled / Selected', Icon: VideoFilledIcon },
	{ name: 'Sprache', weight: '400 / Outline', Icon: Language400Icon }
] as const;
