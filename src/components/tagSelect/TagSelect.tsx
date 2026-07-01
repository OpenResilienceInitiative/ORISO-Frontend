import * as React from 'react';
import './tagSelect.styles';

export interface TagItem {
	id: string;
	name: string;
	label: string;
	value: number;
}

export interface TagSelectProps extends TagItem {
	checked?: boolean;
	defaultChecked?: boolean;
	handleTagSelectClick?: React.MouseEventHandler<HTMLInputElement>;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const TagSelect = (props: TagSelectProps) => {
	return (
		<div className="tagSelect">
			<input
				type="checkbox"
				id={props.id}
				name={props.name}
				value={props.value}
				checked={props.checked}
				defaultChecked={props.defaultChecked}
				className="tagSelect__input"
				onClick={props.handleTagSelectClick}
				onChange={props.onChange}
			/>
			<label htmlFor={props.id} className="tagSelect__label">
				{props.label}
			</label>
		</div>
	);
};
