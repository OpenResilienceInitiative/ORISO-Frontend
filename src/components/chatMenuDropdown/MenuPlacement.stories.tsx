import { MenuBackdrop } from './MenuBackdrop';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MenuVerticalIcon } from '../../resources/img/icons';
import {
	ChatMenuDropdown,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem
} from './ChatMenuDropdown';
import { useChatMenuPosition } from './useChatMenuPosition';
import '../sessionMenu/sessionMenu.styles';

function MenuPlacementDemo({
	edge = false,
	tall = false
}: {
	edge?: boolean;
	tall?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const anchorRef = React.useRef<HTMLButtonElement>(null);
	const menuRef = React.useRef<HTMLDivElement>(null);
	const style = useChatMenuPosition({ open, anchorRef, menuRef });
	return (
		<div style={{ minHeight: '100vh', background: '#eae7e8' }}>
			<MenuBackdrop
				open={open}
				onClose={() => {
					setOpen(false);
					anchorRef.current?.focus();
				}}
			/>
			<button
				ref={anchorRef}
				type="button"
				className="sessionMenu__icon sessionMenu__icon--desktop"
				style={{
					display: 'inline-flex',
					position: 'fixed',
					...(edge
						? { right: 16, bottom: 24 }
						: { left: 24, top: 72 })
				}}
				aria-label="Menü öffnen"
				aria-expanded={open}
				aria-controls={open ? 'placement-menu' : undefined}
				onClick={() => setOpen(!open)}
			>
				<MenuVerticalIcon />
			</button>
			{open &&
				createPortal(
					<ChatMenuDropdown
						id="placement-menu"
						ref={menuRef}
						style={style}
						ariaLabel="Menüplatzierung"
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								setOpen(false);
								anchorRef.current?.focus();
							}
						}}
					>
						<ChatMenuDropdownHeader
							subtitle="Gespräch verwalten"
							title="Informationen & Einstellungen"
						/>
						{Array.from({ length: tall ? 16 : 3 }, (_, index) => (
							<ChatMenuDropdownItem
								key={index}
								title={`Menüaktion ${index + 1}`}
								description="Informationen zu dieser Aktion ansehen."
							/>
						))}
					</ChatMenuDropdown>,
					document.body
				)}
		</div>
	);
}

const meta = {
	title: 'Components/Chat/MenuPlacement',
	component: MenuPlacementDemo,
	parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MenuPlacementDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
const exercise: Story['play'] = async ({ canvasElement }) => {
	const trigger = within(canvasElement).getByRole('button', {
		name: 'Menü öffnen'
	});
	const before = trigger.getBoundingClientRect();
	await userEvent.click(trigger);
	const menu = await within(document.body).findByRole('dialog', {
		name: 'Menüplatzierung'
	});
	await waitFor(() => expect(menu).toBeVisible());
	const rect = menu.getBoundingClientRect();
	expect(rect.left).toBeGreaterThanOrEqual(11);
	expect(rect.top).toBeGreaterThanOrEqual(11);
	expect(rect.right).toBeLessThanOrEqual(window.innerWidth - 11);
	expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 11);
	expect(trigger.getBoundingClientRect().width).toBe(before.width);
	expect(trigger.getBoundingClientRect().height).toBe(before.height);
	await userEvent.click(
		within(menu).getByRole('button', { name: /Menüaktion 1 / })
	);
	await userEvent.keyboard('{Escape}');
	expect(trigger).toHaveFocus();
	expect(
		within(document.body).queryByRole('dialog', { name: 'Menüplatzierung' })
	).not.toBeInTheDocument();
};
export const RightSpace: Story = { play: exercise };
export const RightBottomEdge: Story = { args: { edge: true }, play: exercise };
export const NarrowTall: Story = {
	args: { edge: true, tall: true },
	globals: { viewport: { value: 'mobile1', isRotated: false } },
	play: exercise
};
