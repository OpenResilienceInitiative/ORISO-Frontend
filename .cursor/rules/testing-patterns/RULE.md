---
description: 'Cypress E2E testing, Storybook stories, test conventions, and test data for ORISO Frontend'
globs: ['cypress/**/*.ts', 'src/**/*.stories.tsx', 'src/**/*.stories.mdx']
---

# Testing Patterns

## Overview

ORISO Frontend uses Cypress for E2E testing and Storybook for component documentation. All tests should follow established patterns and conventions.

## Cypress E2E Testing

### Test Structure

**Test files in `cypress/e2e/`:**

```typescript
// ✅ Good: Cypress test structure
describe('Login', () => {
	beforeEach(() => {
		cy.visit('/login');
	});

	it('should log in successfully', () => {
		cy.get('[data-cy=email-input]').type('user@example.com');
		cy.get('[data-cy=password-input]').type('password123');
		cy.get('[data-cy=submit-button]').click();

		cy.url().should('include', '/dashboard');
	});
});
```

### Data Attributes

**Use `data-cy` for test selectors:**

```typescript
// ✅ Good: data-cy attribute
<button data-cy="submit-button" onClick={handleSubmit}>
	Submit
</button>

// ❌ Bad: Class or ID selectors (fragile)
<button className="submit-btn" onClick={handleSubmit}>
	Submit
</button>
```

### Test Organization

**Organize tests by feature:**

```
cypress/e2e/
├── login.cy.ts
├── registration/
│   ├── step1.cy.ts
│   └── step2.cy.ts
├── messages/
│   └── send-message.cy.ts
└── profile.cy.ts
```

### Custom Commands

**Create custom commands for repeated actions:**

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
	cy.visit('/login');
	cy.get('[data-cy=email-input]').type(email);
	cy.get('[data-cy=password-input]').type(password);
	cy.get('[data-cy=submit-button]').click();
});

// Usage
cy.login('user@example.com', 'password123');
```

### Fixtures

**Use fixtures for test data:**

```typescript
// ✅ Good: Fixture usage
cy.fixture('userData.json').then((userData) => {
	cy.get('[data-cy=email-input]').type(userData.email);
});
```

**Fixtures in `cypress/fixtures/`:**

- `api.v1.login.json` - API response fixtures
- `service.users.data.json` - User data fixtures
- `registration/` - Registration test data

## Storybook Stories

### Story Structure

**All stories follow this pattern:**

```typescript
// ✅ Good: Story structure
import { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
	title: 'Components/Forms/Button',
	component: Button,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Button component for user interactions'
			}
		}
	}
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		item: {
			type: 'PRIMARY',
			label: 'Click me'
		}
	}
};

export const Disabled: Story = {
	args: {
		item: {
			type: 'PRIMARY',
			label: 'Disabled',
			disabled: true
		}
	}
};
```

### Story Categories

**Organize stories by category:**

- `Components/Forms/` - Form components
- `Components/Display/` - Display components
- `Components/Layout/` - Layout components
- `Components/Feedback/` - Feedback components

### Autodocs

**Enable autodocs for all stories:**

```typescript
// ✅ Good: Autodocs enabled
const meta = {
	title: 'Components/Forms/Button',
	component: Button,
	tags: ['autodocs'] // Enables automatic documentation
	// ...
};
```

## Test Data

### Mock Data

**Use consistent mock data:**

```typescript
// ✅ Good: Mock data
const mockUserData = {
	id: '123',
	name: 'John Doe',
	email: 'john@example.com'
};
```

### API Mocking

**Mock API calls in tests:**

```typescript
// ✅ Good: API mocking
cy.intercept('GET', '/api/user', { fixture: 'userData.json' }).as('getUser');

cy.visit('/profile');
cy.wait('@getUser');
```

## Test Best Practices

### Test Isolation

**Each test should be independent:**

```typescript
// ✅ Good: Isolated test
describe('Profile', () => {
	beforeEach(() => {
		cy.login('user@example.com', 'password');
		cy.visit('/profile');
	});

	it('should display user name', () => {
		cy.get('[data-cy=user-name]').should('contain', 'John Doe');
	});

	it('should update email', () => {
		cy.get('[data-cy=email-input]').clear().type('new@example.com');
		cy.get('[data-cy=save-button]').click();
		cy.get('[data-cy=success-message]').should('be.visible');
	});
});
```

### Assertions

**Use descriptive assertions:**

```typescript
// ✅ Good: Descriptive assertions
cy.get('[data-cy=error-message]')
	.should('be.visible')
	.and('contain', 'Invalid email');

// ❌ Bad: Vague assertions
cy.get('[data-cy=error-message]').should('exist');
```

## Storybook Best Practices

### Multiple Variants

**Show different states:**

```typescript
export const Primary: Story = {
	/* ... */
};
export const Secondary: Story = {
	/* ... */
};
export const Disabled: Story = {
	/* ... */
};
export const Loading: Story = {
	/* ... */
};
export const WithIcon: Story = {
	/* ... */
};
```

### Realistic Data

**Use realistic example data:**

```typescript
// ✅ Good: Realistic data
export const Default: Story = {
	args: {
		item: {
			type: 'PRIMARY',
			label: 'Save Changes',
			disabled: false
		}
	}
};
```

## Anti-Patterns to Avoid

1. **Fragile selectors**: Use data-cy, not classes/IDs
2. **Interdependent tests**: Keep tests isolated
3. **Missing test data**: Use fixtures and mocks
4. **No story variants**: Show different component states
5. **Untested critical paths**: Test user flows

## Checklist

When writing tests:

- [ ] Cypress tests use data-cy attributes
- [ ] Tests are isolated and independent
- [ ] Fixtures used for test data
- [ ] Custom commands for repeated actions
- [ ] Storybook stories enabled with autodocs
- [ ] Multiple story variants shown
- [ ] Realistic test data used
- [ ] Critical user flows tested

## References

- `cypress/e2e/` - E2E test examples
- `cypress/fixtures/` - Test data fixtures
- `cypress/support/commands.ts` - Custom commands
- `src/components/button/Button.stories.tsx` - Story example
- `STORYBOOK_SETUP.md` - Storybook configuration
