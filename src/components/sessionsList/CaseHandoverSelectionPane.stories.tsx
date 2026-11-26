import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	CaseHandoverActionButton,
	CaseHandoverActionLabels,
	CaseHandoverActionState
} from '../sessionsListItem/CaseHandoverActionButton';
import { SessionCardBody } from '../sessionsListItem/SessionCardBody/SessionCardBody';
import { SESSION_CARD_GEOMETRY } from '../sessionsListItem/SessionCardBody/sessionCardGeometry';
import { UserAvatar } from '../message/UserAvatar';
import { CaseHandoverCurtainView } from '../session/CaseHandoverCurtain';
import { curtainReasons } from '../session/__storybook__/CurtainPlayground';
import {
	CASE_HANDOVER_BULK_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import '../sessionsListItem/sessionsListItem.styles.scss';
import '../session/caseHandoverCurtain.styles.scss';
import './sessionsList.styles.scss';

/**
 * FE#2040: the handover search lists the cases unselected; selecting one
 * loads "Please select a reason" into the existing right pane (the same
 * `CaseHandoverCurtainView` the single case uses). Further selected cases
 * share the reason and text. No pop-up, no bottom bar.
 */

const labels: CaseHandoverActionLabels = {
	requestAccess: 'Zugriff anfragen',
	awaitingApproval: 'Wartet auf Freigabe',
	accessGranted: 'Zugriff erteilt',
	accessDenied: 'Zugriff abgelehnt',
	selectCase: 'Fall auswählen',
	menuLabel: 'Optionen für die Fallübergabe',
	selectMultipleTitle: 'Mehrere Unterhaltungen auswählen',
	selectMultipleDescription: '',
	confirmSelectionTitle: 'Auswahl bestätigen',
	confirmSelectionDescription: '',
	deselectTitle: 'Auswahl aufheben und schließen',
	deselectDescription: ''
};

type DemoCase = { id: number; name: string; state: CaseHandoverActionState };

const cases: DemoCase[] = [
	{ id: 1, name: 'carlotta-mainz-03', state: 'requestAccess' },
	{ id: 2, name: 'carlotta-mainz-11', state: 'requestAccess' },
	{ id: 3, name: 'carlotta-wiesbaden-07', state: 'requestAccess' },
	{ id: 4, name: 'carlotta-mainz-19', state: 'awaitingApproval' }
];

const Card = ({
	name,
	children
}: {
	name: string;
	children: React.ReactNode;
}) => (
	<div
		className="sessionsListItem"
		style={{ opacity: 1, animation: 'none' }}
		data-testid={`card-${name}`}
	>
		<div
			className="sessionsListItem__content"
			style={
				{
					'--card-trailing': '4px',
					'background': '#fff',
					'borderRadius': 24
				} as React.CSSProperties
			}
		>
			<SessionCardBody
				avatar={
					<UserAvatar
						username={name}
						displayName={name}
						userId={name}
						size={`${SESSION_CARD_GEOMETRY.avatar}px`}
						ring={false}
						outline={false}
					/>
				}
				name={<span>{name}</span>}
				preview={<div>Letzte Nachricht vom 24.11.</div>}
				action={children}
				trailing={
					<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
						<span
							className="sessionsListItem__consultingTypeIcon--kindIcon"
							aria-hidden="true"
						/>
						<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
							Mail
						</span>
					</div>
				}
			/>
		</div>
	</div>
);

const SelectionBoard = ({
	initialSelected = [] as number[],
	initialReasonCode = ''
}) => {
	const [selected, setSelected] = useState<number[]>(initialSelected);
	const [reasonCode, setReasonCode] = useState(initialReasonCode);
	const [explanation, setExplanation] = useState('');
	const toggle = (id: number) =>
		setSelected((ids) =>
			ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
		);

	return (
		<div
			style={{
				display: 'flex',
				gap: 16,
				height: '100vh',
				padding: 16,
				boxSizing: 'border-box',
				background: '#eae7e8'
			}}
		>
			<div
				style={{
					width: 400,
					flexShrink: 0,
					display: 'grid',
					alignContent: 'start',
					gap: 8
				}}
				aria-label="Suchergebnis „Carlotta“"
				role="list"
			>
				{cases.map((demoCase) => (
					<div role="listitem" key={demoCase.id}>
						<Card name={demoCase.name}>
							<CaseHandoverActionButton
								labels={labels}
								state={demoCase.state}
								batchMode
								selected={selected.includes(demoCase.id)}
								onToggleSelect={() => toggle(demoCase.id)}
							/>
						</Card>
					</div>
				))}
			</div>
			<div
				style={{
					flex: 1,
					display: 'flex',
					minWidth: 0,
					borderRadius: 24,
					background: '#f6f3f4'
				}}
				data-testid="right-pane"
			>
				{selected.length > 0 && (
					<section
						className="sessionsList__caseHandoverPane"
						aria-label="Mehrfach-Zugriffsanfrage"
					>
						<CaseHandoverCurtainView
							step="reason"
							reasons={curtainReasons}
							reasonCode={reasonCode}
							explanation={explanation}
							onStart={() => undefined}
							onBack={() => undefined}
							onNext={() => undefined}
							onSubmit={() => undefined}
							onReasonSelect={setReasonCode}
							onExplanationChange={setExplanation}
							selectionCount={selected.length}
							onClearSelection={() => setSelected([])}
						/>
					</section>
				)}
			</div>
		</div>
	);
};

const meta: Meta = {
	title: 'Organisms/CaseHandover/Selection in the right pane',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'CARX Case Handover — Section 05 states board',
				url: CASE_HANDOVER_BULK_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'FE#2040: search results show every case **unselected** with a wide select button. Selecting one loads **Please select a reason** into the right pane (the same curtain view as a single case); further selected cases share the reason and text. No pop-up, no bottom bar. Pending or granted cases keep their status pill.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Search "Carlotta": all cases unselected, the right pane stays empty. */
export const SearchResultUnselected: Story = {
	render: () => <SelectionBoard />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('region', { name: 'Mehrfach-Zugriffsanfrage' })
		).toBeNull();
		for (const box of canvas.getAllByRole('checkbox')) {
			await expect((box as HTMLInputElement).checked).toBe(false);
		}
	}
};

/** One click on a case: the reason step appears at once on the right. */
export const SelectOneShowsReason: Story = {
	render: () => <SelectionBoard />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const first = within(
			canvas.getByTestId('card-carlotta-mainz-03')
		).getByRole('checkbox');
		await userEvent.click(first);
		const pane = await canvas.findByRole('region', {
			name: 'Mehrfach-Zugriffsanfrage'
		});
		await waitFor(() =>
			expect(within(pane).getAllByRole('radio').length).toBe(
				curtainReasons.length
			)
		);
		// The select button spans the card row instead of hugging its label.
		const action = canvas
			.getByTestId('card-carlotta-mainz-03')
			.querySelector<HTMLElement>('.sessionCard__action')!;
		const split = action.querySelector<HTMLElement>('.splitButton')!;
		await expect(split.getBoundingClientRect().width).toBeGreaterThan(
			action.getBoundingClientRect().width * 0.9
		);
	}
};

/** Three cases selected, required reason chosen: one text for all three. */
export const ThreeSelectedRequiredText: Story = {
	render: () => (
		<SelectionBoard
			initialSelected={[1, 2, 3]}
			initialReasonCode="PLANNED_ABSENCE"
		/>
	)
};
