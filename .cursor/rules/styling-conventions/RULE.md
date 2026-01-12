---
description: 'SCSS patterns, BEM naming, theming, and styling guidelines for ORISO Frontend'
globs: ['src/**/*.scss', 'src/**/*.module.scss']
---

# Styling Conventions

## Overview

ORISO Frontend uses SCSS for styling with BEM (Block Element Modifier) naming convention. CSS modules are also supported. Inline styles are never used.

## SCSS Classes Only

### Never Use Inline Styles

```typescript
// ✅ Good: SCSS classes
import './button.styles';

<button className="button__item button__item--primary">
	Click me
</button>

// ❌ Bad: Inline styles
<button style={{ backgroundColor: 'blue', padding: '10px' }}>
	Click me
</button>
```

## BEM Naming Convention

### Structure

**BEM = Block\_\_Element--Modifier**

- **Block**: Standalone component (`button`, `inputField`, `modal`)
- **Element**: Part of block (`button__item`, `button__icon`)
- **Modifier**: Variation of block/element (`button__item--primary`, `button__item--disabled`)

### Examples

```scss
// Block
.button {
	// Base styles
}

// Element
.button__item {
	// Button element styles
}

.button__icon {
	// Icon element styles
}

// Modifier
.button__item--primary {
	// Primary button variation
}

.button__item--disabled {
	// Disabled button variation
}

.button__item--small {
	// Small button variation
}
```

### Usage in Components

```typescript
// ✅ Good: BEM classes
<button className="button__item button__item--primary">
	Click me
</button>

// ✅ Good: Conditional modifiers
<button className={`button__item ${isDisabled ? 'button__item--disabled' : ''}`}>
	Click me
</button>

// ✅ Good: classNames utility
import classNames from 'classnames';

<button
	className={classNames('button__item', {
		'button__item--disabled': isDisabled,
		'button__item--primary': isPrimary
	})}
>
	Click me
</button>
```

## CSS Modules

### Supported Pattern

**CSS modules are supported alongside regular SCSS:**

```typescript
// ✅ Good: CSS modules
import styles from './box.module.scss';

<div className={styles.box}>
	<div className={styles.box__title}>Title</div>
	<div className={styles.box__content}>Content</div>
</div>
```

**File naming:**

- Regular SCSS: `componentName.styles.scss`
- CSS modules: `componentName.module.scss`

**Example from codebase:**
See `src/components/box/Box.tsx` and `src/components/box/box.module.scss`

## Style File Organization

### Import Pattern

```typescript
// ✅ Good: Import styles (no extension)
import './button.styles';

// ✅ Good: CSS modules
import styles from './box.module.scss';

// ❌ Bad: With extension
import './button.styles.scss'; // Wrong!
```

### File Location

**Style files are co-located with components:**

```
src/components/button/
├── Button.tsx
└── button.styles.scss
```

## Theming

### CSS Variables

**Multi-tenant theming uses CSS variables:**

```scss
// ✅ Good: CSS variables for theming
.button__primary {
	background: var(--skin-color-primary, $primary);
	color: var(--text-color-contrast-switch, $white);

	&:hover {
		background-color: var(--skin-color-primary-hover, $hover-primary);
	}
}
```

**Variable naming:**

- `--skin-color-*` - Tenant-specific colors
- `--text-color-*` - Text colors with contrast switching
- Fallback to SCSS variables: `var(--skin-color-primary, $primary)`

### Compound UI Design Tokens

**Use Compound UI tokens when using Compound components:**

```scss
// ✅ Good: Compound UI tokens
.avatar {
	width: var(--cpd-space-8);
	height: var(--cpd-space-8);
	border-radius: var(--cpd-radius-pill);
	background: var(--cpd-color-bg-subtle-secondary);
}
```

**Available token categories:**

- `--cpd-color-*` - Colors
- `--cpd-space-*` - Spacing
- `--cpd-font-*` - Typography
- `--cpd-radius-*` - Border radius

## Responsive Design

### Mobile-First Approach

```scss
// ✅ Good: Mobile-first
.button {
	padding: $grid-base-two;
	font-size: $font-size-base;

	@include breakpoint($fromMedium) {
		padding: $grid-base-three;
		font-size: $font-size-large;
	}
}
```

**Breakpoint mixins:**

- `@include breakpoint($fromMedium)` - Medium and up
- `@include breakpoint($fromLarge)` - Large and up
- `@include breakpoint($fromXLarge)` - XLarge and up

## SCSS Best Practices

### Nesting

**Keep nesting shallow (max 3 levels):**

```scss
// ✅ Good: Shallow nesting
.button {
	&__item {
		// Styles
	}

	&__icon {
		// Styles
	}
}

// ❌ Bad: Deep nesting
.button {
	&__item {
		&__wrapper {
			&__inner {
				// Too deep!
			}
		}
	}
}
```

### Variables

**Use SCSS variables for repeated values:**

```scss
// ✅ Good: SCSS variables
$button-padding: $grid-base-three;
$button-border-radius: 4px;

.button__item {
	padding: $button-padding;
	border-radius: $button-border-radius;
}
```

### Mixins

**Use mixins for repeated patterns:**

```scss
// ✅ Good: Mixin for common pattern
@mixin button-base {
	padding: $grid-base-three;
	border: none;
	cursor: pointer;
}

.button__primary {
	@include button-base;
	background: $primary;
}
```

## Conditional Classes

### classNames Utility

**Use classNames for complex conditional classes:**

```typescript
// ✅ Good: classNames utility
import classNames from 'classnames';

<button
	className={classNames('button__item', {
		'button__item--disabled': isDisabled,
		'button__item--primary': isPrimary,
		'button__item--loading': isLoading
	})}
>
	Click me
</button>
```

### Template Literals

**Simple cases can use template literals:**

```typescript
// ✅ Good: Simple conditional
<button className={`button__item ${isDisabled ? 'button__item--disabled' : ''}`}>
	Click me
</button>
```

## Color Usage

### Semantic Color Names

**Use semantic names, not literal colors:**

```scss
// ✅ Good: Semantic names
.button__primary {
	background: $primary;
	color: $white;
}

.button__error {
	background: $form-error;
}

// ❌ Bad: Literal colors
.button__primary {
	background: #007bff; // Use variable instead
}
```

## Examples from Codebase

### Button Styles

See `src/components/button/button.styles.scss`:

- BEM naming convention
- CSS variables for theming
- Responsive design
- Modifier classes

### Box Styles (CSS Modules)

See `src/components/box/box.module.scss`:

- CSS modules pattern
- BEM naming within modules
- Conditional modifiers

## Anti-Patterns to Avoid

1. **Inline styles**: Never use `style={{}}` prop
2. **Deep nesting**: Keep SCSS nesting shallow
3. **Literal colors**: Use SCSS variables or CSS variables
4. **Magic numbers**: Use variables for spacing/sizing
5. **Global styles in components**: Use component-scoped styles
6. **!important**: Avoid unless absolutely necessary
7. **Duplicate styles**: Extract to mixins or utilities

## Checklist

When styling a component:

- [ ] SCSS classes used (no inline styles)
- [ ] BEM naming convention followed
- [ ] CSS variables used for theming (if applicable)
- [ ] Responsive design (mobile-first)
- [ ] Conditional classes use classNames utility
- [ ] Style file co-located with component
- [ ] Import without extension
- [ ] Semantic color names used

## References

- `src/components/button/button.styles.scss` - BEM example
- `src/components/box/box.module.scss` - CSS modules example
- `.stylelintrc.js` - SCSS linting rules
- `src/resources/styles/` - Global styles and variables
