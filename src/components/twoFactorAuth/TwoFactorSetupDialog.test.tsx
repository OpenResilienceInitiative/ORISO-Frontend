// @vitest-environment jsdom

import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalContext } from '../../globalState/context/ModalContext';
import type { OVERLAY_TYPES } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';
import { TWO_FACTOR_TYPES, type TwoFactorType } from './twoFactorAuthConstants';

type MuiMockProps = React.PropsWithChildren<{
	'autoFocus'?: boolean;
	'className'?: string;
	'disabled'?: boolean;
	'href'?: string;
	'id'?: string;
	'label'?: string;
	'onChange'?: React.ChangeEventHandler<HTMLInputElement>;
	'onClick'?: () => void;
	'open'?: boolean;
	'rel'?: string;
	'role'?: string;
	'startIcon'?: React.ReactNode;
	'target'?: string;
	'type'?: string;
	'value'?: string;
	'aria-label'?: string;
}>;

const apiPutTwoFactorAuthAppMock = vi.fn();
const apiPutTwoFactorAuthEmailMock = vi.fn();
const apiPostTwoFactorAuthEmailWithCodeMock = vi.fn();
const apiPatchTwoFactorAuthEncourageMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) =>
			options?.email ? `${key}:${options.email}` : key
	})
}));

vi.mock('../../api', () => ({
	apiPatchTwoFactorAuthEncourage: (...args: unknown[]) =>
		apiPatchTwoFactorAuthEncourageMock(...args),
	apiPostTwoFactorAuthEmailWithCode: (...args: unknown[]) =>
		apiPostTwoFactorAuthEmailWithCodeMock(...args),
	apiPutTwoFactorAuthApp: (...args: unknown[]) =>
		apiPutTwoFactorAuthAppMock(...args),
	apiPutTwoFactorAuthEmail: (...args: unknown[]) =>
		apiPutTwoFactorAuthEmailMock(...args),
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CONFLICT: 'CONFLICT',
		PRECONDITION_FAILED: 'PRECONDITION_FAILED',
		TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
	}
}));

vi.mock('./twoFactorSetupDialog.styles.scss', () => ({}));

vi.mock('@mui/material', async () => {
	const ReactModule = await import('react');

	return {
		Box: ({ children, className, id }: MuiMockProps) =>
			ReactModule.createElement('div', { className, id }, children),
		Button: ({
			children,
			className,
			disabled,
			onClick,
			startIcon
		}: MuiMockProps) =>
			ReactModule.createElement(
				'button',
				{ className, disabled, onClick, type: 'button' },
				startIcon,
				children
			),
		Dialog: ({ children, className, open }: MuiMockProps) =>
			open
				? ReactModule.createElement(
						'div',
						{ className, role: 'dialog' },
						children
					)
				: null,
		Fade: ({ children }: MuiMockProps) =>
			ReactModule.createElement(ReactModule.Fragment, null, children),
		IconButton: ({
			children,
			className,
			disabled,
			onClick,
			'aria-label': ariaLabel
		}: MuiMockProps) =>
			ReactModule.createElement(
				'button',
				{
					'aria-label': ariaLabel,
					className,
					disabled,
					onClick,
					'type': 'button'
				},
				children
			),
		Link: ({ children, href, rel, target }: MuiMockProps) =>
			ReactModule.createElement('a', { href, rel, target }, children),
		TextField: ({
			autoFocus,
			disabled,
			label,
			onChange,
			type = 'text',
			value
		}: MuiMockProps) =>
			ReactModule.createElement(
				'label',
				null,
				label,
				ReactModule.createElement('input', {
					'aria-label': label,
					autoFocus,
					disabled,
					onChange,
					type,
					value
				})
			),
		Tooltip: ({ children }: MuiMockProps) =>
			ReactModule.createElement(ReactModule.Fragment, null, children),
		Typography: ({ children, className, id, role }: MuiMockProps) =>
			ReactModule.createElement('div', { className, id, role }, children)
	};
});

vi.mock('../../resources/img/icons/two-factor/otp_app_graphic.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/email_code_graphic.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/decision_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/decision_filled.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/install_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/install_filled.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/select_account_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock(
	'../../resources/img/icons/two-factor/select_account_filled.svg',
	() => ({
		ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
			<svg aria-hidden="true" {...props} />
		)
	})
);
vi.mock('../../resources/img/icons/two-factor/connect_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/connect_filled.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/verification_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/verification_filled.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/confirm_400.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));
vi.mock('../../resources/img/icons/two-factor/confirm_filled.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
		<svg aria-hidden="true" {...props} />
	)
}));

const clickButton = (name: string) => {
	fireEvent.click(screen.getByRole('button', { name }));
};

const renderDialog = (
	overrideProps: Partial<
		React.ComponentProps<typeof TwoFactorSetupDialog>
	> = {}
) => {
	const onClose = vi.fn();
	const onDisable = vi.fn();
	const onSetupComplete = vi.fn();

	const DialogHarness = () => {
		const [overlays, setOverlays] = React.useState<
			{ id: string; name: OVERLAY_TYPES }[]
		>([]);
		const addOverlay = React.useCallback(
			(overlay: { id: string; name: OVERLAY_TYPES }) =>
				setOverlays([overlay]),
			[]
		);
		const removeOverlay = React.useCallback(
			(id: string) =>
				setOverlays((current) =>
					current.filter((overlay) => overlay.id !== id)
				),
			[]
		);

		return (
			<ModalContext.Provider
				value={{
					overlays,
					setOverlays,
					addOverlay,
					removeOverlay
				}}
			>
				<TwoFactorSetupDialog
					canClose
					canDisable={false}
					currentType={TWO_FACTOR_TYPES.NONE}
					email="maxmuster@email.de"
					onClose={onClose}
					onDisable={onDisable}
					onSetupComplete={onSetupComplete}
					open
					qrCode="iVBORw0KGgo="
					secret="12345678901234567890123456789012"
					{...overrideProps}
				/>
			</ModalContext.Provider>
		);
	};

	render(
		<>
			<div className="app" />
			<DialogHarness />
		</>
	);

	return { onClose, onDisable, onSetupComplete };
};

describe('TwoFactorSetupDialog', () => {
	afterEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('opens the decision dialog and supports back and close navigation', async () => {
		const { onClose } = renderDialog();

		expect(
			await screen.findByText('twoFactorAuth.setupDialog.title')
		).toBeTruthy();
		clickButton('twoFactorAuth.setupDialog.decision.app');

		expect(
			await screen.findByText(
				'twoFactorAuth.setupDialog.app.install.copy'
			)
		).toBeTruthy();
		clickButton('twoFactorAuth.setupDialog.action.back');

		expect(
			await screen.findByText('twoFactorAuth.setupDialog.decision.copy')
		).toBeTruthy();
		fireEvent.click(
			screen.getAllByRole('button', {
				name: 'twoFactorAuth.setupDialog.action.close'
			})[1]
		);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not render a close action when setup is forced', async () => {
		renderDialog({ canClose: false });

		expect(
			await screen.findByText('twoFactorAuth.setupDialog.title')
		).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: 'twoFactorAuth.setupDialog.action.close'
			})
		).toBeNull();
	});

	it('completes the authenticator app setup path', async () => {
		apiPutTwoFactorAuthAppMock.mockResolvedValue(undefined);
		apiPatchTwoFactorAuthEncourageMock.mockResolvedValue(undefined);
		const { onSetupComplete } = renderDialog();

		await screen.findByText('twoFactorAuth.setupDialog.decision.app');
		clickButton('twoFactorAuth.setupDialog.decision.app');
		clickButton('twoFactorAuth.setupDialog.action.next');
		clickButton('twoFactorAuth.setupDialog.action.next');
		fireEvent.change(
			await screen.findByLabelText(
				'twoFactorAuth.setupDialog.app.verify.input'
			),
			{ target: { value: '123456' } }
		);
		clickButton('twoFactorAuth.setupDialog.action.confirm');

		await waitFor(() =>
			expect(apiPutTwoFactorAuthAppMock).toHaveBeenCalledWith({
				otp: '123456',
				secret: '12345678901234567890123456789012'
			})
		);
		expect(apiPatchTwoFactorAuthEncourageMock).toHaveBeenCalledWith(false);
		expect(onSetupComplete).toHaveBeenCalledTimes(1);
		expect(
			await screen.findByText(
				'twoFactorAuth.setupDialog.app.success.title'
			)
		).toBeTruthy();
	});

	it('keeps the success step when refreshed user data changes the current type', async () => {
		apiPutTwoFactorAuthAppMock.mockResolvedValue(undefined);
		apiPatchTwoFactorAuthEncourageMock.mockResolvedValue(undefined);

		const DialogHarness = () => {
			const [currentType, setCurrentType] = React.useState<TwoFactorType>(
				TWO_FACTOR_TYPES.NONE
			);
			const [overlays, setOverlays] = React.useState<
				{ id: string; name: OVERLAY_TYPES }[]
			>([]);
			const addOverlay = React.useCallback(
				(overlay: { id: string; name: OVERLAY_TYPES }) =>
					setOverlays([overlay]),
				[]
			);
			const removeOverlay = React.useCallback(
				(id: string) =>
					setOverlays((current) =>
						current.filter((overlay) => overlay.id !== id)
					),
				[]
			);

			return (
				<ModalContext.Provider
					value={{
						overlays,
						setOverlays,
						addOverlay,
						removeOverlay
					}}
				>
					<TwoFactorSetupDialog
						canClose
						canDisable={false}
						currentType={currentType}
						email="maxmuster@email.de"
						onClose={vi.fn()}
						onDisable={vi.fn()}
						onSetupComplete={() =>
							setCurrentType(TWO_FACTOR_TYPES.APP)
						}
						open
						qrCode="iVBORw0KGgo="
						secret="12345678901234567890123456789012"
					/>
				</ModalContext.Provider>
			);
		};

		render(
			<>
				<div className="app" />
				<DialogHarness />
			</>
		);

		await screen.findByText('twoFactorAuth.setupDialog.decision.app');
		clickButton('twoFactorAuth.setupDialog.decision.app');
		clickButton('twoFactorAuth.setupDialog.action.next');
		clickButton('twoFactorAuth.setupDialog.action.next');
		fireEvent.change(
			await screen.findByLabelText(
				'twoFactorAuth.setupDialog.app.verify.input'
			),
			{ target: { value: '123456' } }
		);
		clickButton('twoFactorAuth.setupDialog.action.confirm');

		expect(
			await screen.findByText(
				'twoFactorAuth.setupDialog.app.success.title'
			)
		).toBeTruthy();
		expect(
			screen.queryByText('twoFactorAuth.setupDialog.decision.copy')
		).toBeNull();
	});

	it('sends, resends, and validates the email setup code', async () => {
		apiPutTwoFactorAuthEmailMock.mockResolvedValue(undefined);
		apiPostTwoFactorAuthEmailWithCodeMock.mockResolvedValue(undefined);
		apiPatchTwoFactorAuthEncourageMock.mockResolvedValue(undefined);
		const { onSetupComplete } = renderDialog();

		await screen.findByText('twoFactorAuth.setupDialog.decision.email');
		clickButton('twoFactorAuth.setupDialog.decision.email');
		clickButton('twoFactorAuth.setupDialog.action.next');

		await waitFor(() =>
			expect(apiPutTwoFactorAuthEmailMock).toHaveBeenCalledWith(
				'maxmuster@email.de'
			)
		);
		clickButton('twoFactorAuth.setupDialog.email.connect.resend');
		await waitFor(() =>
			expect(apiPutTwoFactorAuthEmailMock).toHaveBeenCalledTimes(2)
		);

		fireEvent.change(
			await screen.findByLabelText(
				'twoFactorAuth.setupDialog.email.connect.input'
			),
			{ target: { value: '654321' } }
		);
		clickButton('twoFactorAuth.setupDialog.action.confirm');

		await waitFor(() =>
			expect(apiPostTwoFactorAuthEmailWithCodeMock).toHaveBeenCalledWith(
				'654321'
			)
		);
		expect(onSetupComplete).toHaveBeenCalledTimes(1);
		expect(
			await screen.findByText(
				'twoFactorAuth.setupDialog.email.success.title'
			)
		).toBeTruthy();
	});
});
