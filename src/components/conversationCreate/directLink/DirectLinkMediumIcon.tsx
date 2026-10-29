import * as React from 'react';
import {
	Audio400Icon,
	AudioFilledIcon,
	Chat400Icon,
	ChatFilledIcon,
	Video400Icon,
	VideoFilledIcon
} from '../../icons/conversationCreateIcons';
import { DirectLinkMedium } from './directLink';

const ICONS: Record<
	DirectLinkMedium,
	[
		React.FC<React.SVGProps<SVGSVGElement>>,
		React.FC<React.SVGProps<SVGSVGElement>>
	]
> = {
	CHAT: [Chat400Icon, ChatFilledIcon],
	AUDIO: [Audio400Icon, AudioFilledIcon],
	VIDEO: [Video400Icon, VideoFilledIcon]
};

export const DirectLinkMediumIcon = ({
	medium,
	filled = false
}: {
	medium: DirectLinkMedium;
	filled?: boolean;
}) => {
	const Icon = ICONS[medium][filled ? 1 : 0];
	return <Icon aria-hidden focusable="false" />;
};
