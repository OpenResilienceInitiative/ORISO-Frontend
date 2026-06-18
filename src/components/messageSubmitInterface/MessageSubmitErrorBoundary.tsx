import * as React from 'react';
import { Component, ReactNode } from 'react';
import { apiPostError, ERROR_LEVEL_ERROR } from '../../api/apiPostError';
import { Button, BUTTON_TYPES } from '../button/Button';

type MessageSubmitErrorBoundaryProps = {
	children: ReactNode;
	onRetry?: () => void;
};

type MessageSubmitErrorBoundaryState = {
	hasError: boolean;
};

/**
 * Keeps composer mount failures local so a TipTap/draft crash does not bubble
 * to the app-wide ErrorBoundary (which clears cookies and sends users to
 * error.500.html).
 */
export class MessageSubmitErrorBoundary extends Component<
	MessageSubmitErrorBoundaryProps,
	MessageSubmitErrorBoundaryState
> {
	state: MessageSubmitErrorBoundaryState = {
		hasError: false
	};

	private autoRetryAttempted = false;

	static getDerivedStateFromError(): MessageSubmitErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		void apiPostError(
			{
				name: error.name,
				message: error.message,
				stack: error.stack,
				level: ERROR_LEVEL_ERROR
			},
			info
		);

		// Lazy-loaded composer can fail on the first mount while the chunk
		// initialises; one silent remount usually succeeds.
		if (!this.autoRetryAttempted) {
			this.autoRetryAttempted = true;
			this.setState({ hasError: false });
			this.props.onRetry?.();
		}
	}

	private handleRetry = () => {
		this.setState({ hasError: false });
		this.props.onRetry?.();
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="messageSubmit__wrapper messageSubmit__wrapper--error">
					<p>
						Der Chat-Eingabebereich konnte nicht geladen werden.
						Bitte versuchen Sie es erneut.
					</p>
					<Button
						buttonHandle={this.handleRetry}
						item={{
							type: BUTTON_TYPES.PRIMARY,
							label: 'Erneut versuchen'
						}}
					/>
				</div>
			);
		}

		return this.props.children;
	}
}
