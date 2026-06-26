import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SendIcon } from '../../resources/img/icons/paper-plane.svg';

interface SendMessageButtonProps {
	clicked?: boolean;
	deactivated?: boolean;
	isEmpty?: boolean;
	handleSendButton: Function;
	type?: 'button' | 'submit';
}

export const SendMessageButton = (props: SendMessageButtonProps) => {
	const { t: translate } = useTranslation();
	const isDisabled = !!props.deactivated;
	const buttonType = props.type || 'button';

	return (
		<button
			type={buttonType}
			disabled={isDisabled}
			onClick={
				buttonType === 'button'
					? () => props.handleSendButton()
					: undefined
			}
			aria-disabled={isDisabled}
			className={`textarea__iconWrapper ${
				props.clicked ? 'textarea__iconWrapper--clicked' : ''
			} ${props.deactivated ? 'textarea__iconWrapper--deactivated' : 'textarea__iconWrapper--active'} ${
				props.isEmpty ? 'textarea__iconWrapper--empty' : ''
			}`}
			title={translate('enquiry.write.input.button.title')}
			aria-label={translate('enquiry.write.input.button.title')}
		>
			<SendIcon
				className="textarea__icon"
				aria-label={translate('enquiry.write.input.button.title')}
				title={translate('enquiry.write.input.button.title')}
			/>
		</button>
	);
};
