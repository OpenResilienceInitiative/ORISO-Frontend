import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import './messageSubmitInterface.styles.scss';

type ComposerMockProps = {
	ready?: boolean;
	expanded?: boolean;
	value?: string;
};

const toolbarItems = ['x', '↶', '↷', 'H', '≡', 'B', 'I', 'S', '</>', 'U'];

function SendIcon() {
	return (
		<svg
			className="textarea__icon"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<rect
				x="3"
				y="10.5"
				width="18"
				height="3"
				rx="1.5"
				transform="rotate(-28 12 12)"
			/>
			<rect
				x="12"
				y="4"
				width="3"
				height="14"
				rx="1.5"
				transform="rotate(28 13.5 11)"
			/>
		</svg>
	);
}

function ToolbarMock() {
	return (
		<div className="textarea__figmaToolbar">
			<div className="textarea__figmaToolbarPanel textarea__figmaToolbarPanel--default textarea__figmaToolbarPanel--active">
				{toolbarItems.map((item, index) => (
					<React.Fragment key={`${item}-${index}`}>
						<button type="button" aria-label={`Toolbar ${item}`}>
							{item}
						</button>
						{index === 0 || index === 2 || index === 4 ? (
							<span
								className="textarea__figmaToolbarDivider"
								aria-hidden="true"
							/>
						) : null}
					</React.Fragment>
				))}
			</div>
		</div>
	);
}

function ComposerMock({
	ready = false,
	expanded = false,
	value = ''
}: ComposerMockProps) {
	return (
		<div className="textarea">
			<div
				className={[
					'textarea__wrapper-send-message',
					ready && 'textarea__wrapper-send-message--ready',
					expanded && 'textarea__wrapper-send-message--expanded'
				]
					.filter(Boolean)
					.join(' ')}
			>
				<span className="textarea__inputWrapper">
					<div className="textarea__input" role="textbox">
						<ToolbarMock />
						<div
							style={{
								position: 'absolute',
								left: 24,
								right: 72,
								top: 64,
								fontSize: 14,
								lineHeight: '20px',
								color: value ? '#1e1e1e' : '#9ba4b0'
							}}
						>
							{value || 'Nachricht an Klient:in schreiben'}
						</div>
					</div>
				</span>
				<div className="textarea__buttons">
					<button
						type="button"
						className={[
							'textarea__iconWrapper',
							ready && 'textarea__iconWrapper--active'
						]
							.filter(Boolean)
							.join(' ')}
						aria-label="Nachricht senden"
					>
						<SendIcon />
					</button>
				</div>
			</div>
		</div>
	);
}

const shellStyle: React.CSSProperties = {
	background: '#eeeeee',
	minHeight: 280,
	padding: 24,
	position: 'relative',
	boxSizing: 'border-box',
	overflow: 'hidden'
};

const meta = {
	title: 'Components/Message/Submit interface visual states',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		docs: {
			description: {
				component:
					'Visual state harness for the real `textarea__*` composer classes. It isolates the Figma-aligned drag handle, ready border, send button, and compact mobile sizing without requiring a live chat session.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	render: () => (
		<div className="session" style={shellStyle}>
			<ComposerMock />
		</div>
	)
};

export const ReadyToSend: Story = {
	render: () => (
		<div className="session" style={shellStyle}>
			<ComposerMock ready value="Writing" />
		</div>
	)
};

export const MobileReadyToSend: Story = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1'
		}
	},
	render: () => (
		<div className="session" style={{ ...shellStyle, minHeight: 240 }}>
			<ComposerMock ready value="Writing" />
		</div>
	)
};
