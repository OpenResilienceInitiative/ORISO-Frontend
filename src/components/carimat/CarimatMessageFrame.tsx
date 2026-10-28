import * as React from 'react';
import { useAssistantIdentity, CarimatRobotIcon } from './AssistantIdentity';
import { CarimatMessageContainer } from './CarimatMessageContainer';
import './CarimatMessageFrame.styles.scss';

export interface CarimatMessageFrameProps
	extends React.HTMLAttributes<HTMLDivElement> {
	authorName?: string;
	subtitle?: React.ReactNode;
	menu?: React.ReactNode;
}

/** Assistant identity is presentation, never a Matrix sender or event author. */
export const CarimatAvatar = ({ menu }: { menu?: React.ReactNode }) => (
	<div className="carimatMessageFrame__avatarColumn pseudonymCard__avatarCol">
		<div className="carimatMessageFrame__avatar pseudonymCard__avatarFrame">
			<span
				className="carimatMessageFrame__avatarIcon pseudonymCard__avatarIcon"
				aria-hidden="true"
			>
				<CarimatRobotIcon />
			</span>
		</div>
		{menu}
	</div>
);

export const CarimatHeader = ({
	authorName,
	subtitle
}: Pick<CarimatMessageFrameProps, 'authorName' | 'subtitle'>) => {
	const assistant = useAssistantIdentity();
	return (
		<div className="carimatMessageFrame__header pseudonymCard__header">
			<span className="carimatMessageFrame__name pseudonymCard__headerName">
				{authorName ?? assistant.name}
			</span>
			{subtitle && (
				<span className="carimatMessageFrame__subtitle pseudonymCard__headerSubtitle">
					{subtitle}
				</span>
			)}
		</div>
	);
};

export const CarimatMessageBubble = ({
	children,
	footer,
	variant = 'guidance',
	topic,
	topicIcon,
	className = '',
	...props
}: React.HTMLAttributes<HTMLDivElement> & {
	footer?: React.ReactNode;
	variant?: 'guidance' | 'notice';
	topic?: React.ReactNode;
	topicIcon?: React.ReactNode;
}) => (
	<div
		{...props}
		className={`carimatMessageFrame__bubble carimatMessageFrame__bubble--${variant} pseudonymCard__bubble ${className}`}
	>
		{topic && (
			<div className="carimatMessageFrame__topic">
				{topicIcon && (
					<span
						className="carimatMessageFrame__topicIcon"
						aria-hidden="true"
					>
						{topicIcon}
					</span>
				)}
				<span>{topic}</span>
			</div>
		)}
		{children}
		{footer}
	</div>
);

/** One geometry for messages presented by the assistant; payload/state stays with callers. */
export const CarimatMessageFrame = React.forwardRef<
	HTMLDivElement,
	CarimatMessageFrameProps
>(({ authorName, subtitle, menu, children, className = '', ...props }, ref) => (
	<CarimatMessageContainer
		{...props}
		ref={ref}
		className={`carimatMessageFrame ${className}`}
	>
		<div className="carimatMessageFrame__row">
			<CarimatAvatar menu={menu} />
			<div className="carimatMessageFrame__content">
				<CarimatHeader authorName={authorName} subtitle={subtitle} />
				{children}
			</div>
		</div>
	</CarimatMessageContainer>
));
CarimatMessageFrame.displayName = 'CarimatMessageFrame';
