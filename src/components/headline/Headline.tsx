import * as React from 'react';
import './headline.styles';

export type HeadlineLevel = '1' | '2' | '3' | '4' | '5';
interface HeadlineProps {
	plainText?: boolean;
	text: string;
	semanticLevel: HeadlineLevel;
	styleLevel?: HeadlineLevel;
	className?: string;
}

export const Headline = (props: HeadlineProps) => {
	const Tag = ('h' +
		props.semanticLevel) as keyof React.JSX.IntrinsicElements;
	const levelBasedClass = props.styleLevel
		? props.styleLevel
		: props.semanticLevel;

	return (
		<Tag
			className={`headline headline--${levelBasedClass} ${
				props.className ? props.className : ''
			}`}
			dangerouslySetInnerHTML={
				props.plainText ? undefined : { __html: props.text }
			}
		>
			{props.plainText ? props.text : undefined}
		</Tag>
	);
};
