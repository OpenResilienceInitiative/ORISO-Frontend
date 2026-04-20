import * as React from 'react';
import { useTranslation } from 'react-i18next';
import './typingIndicator.styles';

export const TypingIndicator = (props) => {
	const { t: translate } = useTranslation();
	const users = Array.isArray(props.typingUsers) ? props.typingUsers : [];
	const usersLength = users.length;

	const renderTypingUsers = () => {
		if (usersLength <= 0) {
			return '';
		}
		if (usersLength === 1) {
			return `${users[0]} ${translate('typingIndicator.singleUser.typing')}`;
		}
		if (usersLength === 2) {
			return `${users[0]} ${translate(
				'typingIndicator.twoUsers.connector'
			)} ${users[1]} ${translate('typingIndicator.twoUsers.typing')}`;
		}
		return `${usersLength} ${translate('typingIndicator.multipleUsers.typing')}`;
	};

	return (
		<div
			className={
				props.disabled
					? 'typing-indicator typing-indicator--disabled'
					: 'typing-indicator'
			}
		>
			<div className="typing-indicator__text">{renderTypingUsers()}</div>
			<div className="typing-indicator__bubble" aria-hidden="true">
				<div className="typing-indicator__dots">
					<span className="typing-indicator__dot"></span>
					<span className="typing-indicator__dot"></span>
					<span className="typing-indicator__dot"></span>
				</div>
			</div>
		</div>
	);
};
