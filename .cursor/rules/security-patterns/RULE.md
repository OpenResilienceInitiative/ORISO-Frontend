---
description: 'Security best practices, CSRF protection, token handling, and data validation for ORISO Frontend'
alwaysApply: true
---

# Security Patterns

## Overview

Security is critical for a counseling platform handling sensitive user data. All security measures must be properly implemented.

## CSRF Protection

### CSRF Token Generation

**CSRF tokens are generated automatically by fetchData:**

```typescript
// ✅ Good: CSRF token handled automatically
fetchData({
	url: endpoints.updateUser,
	method: FETCH_METHODS.PUT,
	bodyData: JSON.stringify(data)
	// CSRF token added automatically
});
```

**Token generation:**

- Generated via `generateCsrfToken()` utility
- Sent in `X-CSRF-TOKEN` header
- Local development: Additional whitelist header

### CSRF Token Utility

**See `src/utils/generateCsrfToken.ts` for implementation.**

## Token Handling

### Keycloak Token

**Tokens stored in cookies (session-based):**

```typescript
// ✅ Good: Token retrieved from cookie
const accessToken = getValueFromCookie('keycloak');

// Token sent in Authorization header
Authorization: `Bearer ${accessToken}`;
```

**Token security:**

- Stored in httpOnly cookies (not accessible via JavaScript)
- Sent automatically by fetchData
- Expires with session

### Matrix Token

**Matrix tokens handled securely:**

```typescript
// ✅ Good: Secure token handling
const loginData = getMatrixAccessToken();
// Token used for Matrix client initialization
```

**Never expose tokens:**

- Don't log tokens to console
- Don't store tokens in localStorage
- Don't include tokens in URLs

## Input Validation

### Client-Side Validation

**Validate all user input:**

```typescript
// ✅ Good: Input validation
const validateEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const handleSubmit = (data: FormData) => {
	if (!validateEmail(data.email)) {
		setError('Invalid email format');
		return;
	}
	// Submit data
};
```

### Server-Side Validation

**Never trust client-side validation alone:**

```typescript
// ✅ Good: Client validation + server validation
const handleSubmit = async (data: FormData) => {
	// Client-side validation
	if (!validateEmail(data.email)) {
		setError('Invalid email format');
		return;
	}

	try {
		// Server will also validate
		await apiPostRegistration(data);
	} catch (error) {
		if (error.message === FETCH_ERRORS.BAD_REQUEST) {
			// Server validation errors
			setErrors(error.response.data.errors);
		}
	}
};
```

## XSS Prevention

### Sanitize User Input

**Sanitize user-generated content:**

```typescript
// ✅ Good: Sanitize HTML
import sanitizeHtml from 'sanitize-html';

const sanitizedContent = sanitizeHtml(userInput, {
	allowedTags: ['b', 'i', 'em', 'strong', 'a'],
	allowedAttributes: {
		a: ['href']
	}
});
```

### React Escaping

**React automatically escapes content:**

```typescript
// ✅ Good: React auto-escaping
<div>{userInput}</div>  // Automatically escaped

// ❌ Bad: dangerouslySetInnerHTML (use with caution)
<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
```

## Secure API Communication

### HTTPS Only

**Always use HTTPS in production:**

```typescript
// ✅ Good: HTTPS endpoint
const endpoint = 'https://api.example.com/data';

// ❌ Bad: HTTP endpoint (insecure)
const endpoint = 'http://api.example.com/data';
```

### Credentials

**Include credentials for authenticated requests:**

```typescript
// ✅ Good: Credentials included (handled by fetchData)
fetchData({
	url: endpoints.userData,
	method: FETCH_METHODS.GET
	// credentials: 'include' handled automatically
});
```

## Sensitive Data Handling

### Don't Log Sensitive Data

**Never log sensitive information:**

```typescript
// ✅ Good: Safe logging
console.log('User data fetched'); // No sensitive data

// ❌ Bad: Logging sensitive data
console.log('User data:', userData); // Contains sensitive info
console.log('Token:', accessToken); // Never log tokens
```

### Clear Sensitive Data

**Clear sensitive data from memory when done:**

```typescript
// ✅ Good: Clear sensitive data
const handleLogout = () => {
	// Clear tokens
	logout();
	// Clear user data
	setUserData(null);
};
```

## Authentication Flow

### Secure Login

**Login handled by Keycloak:**

```typescript
// ✅ Good: Keycloak authentication
// Login flow handled by Keycloak adapter
// Tokens stored securely in cookies
```

### Session Management

**Sessions managed securely:**

- Tokens in httpOnly cookies
- Automatic token refresh
- Secure logout clears all tokens

## Data Validation

### Validate All Inputs

**Validate before sending to server:**

```typescript
// ✅ Good: Comprehensive validation
const validateRegistration = (data: RegistrationData): ValidationResult => {
	const errors: Record<string, string> = {};

	if (!data.email || !isValidEmail(data.email)) {
		errors.email = 'Invalid email';
	}

	if (!data.password || data.password.length < 8) {
		errors.password = 'Password must be at least 8 characters';
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors
	};
};
```

## Anti-Patterns to Avoid

1. **Storing tokens in localStorage**: Use httpOnly cookies
2. **Logging sensitive data**: Never log tokens or passwords
3. **Trusting client validation**: Always validate on server
4. **Unsanitized HTML**: Sanitize user-generated content
5. **Missing CSRF protection**: Always include CSRF tokens
6. **HTTP in production**: Always use HTTPS
7. **Exposed tokens**: Never expose tokens in URLs or logs

## Checklist

When implementing security:

- [ ] CSRF tokens included in requests
- [ ] Tokens stored securely (httpOnly cookies)
- [ ] Input validation on client and server
- [ ] User content sanitized
- [ ] Sensitive data not logged
- [ ] HTTPS used in production
- [ ] Authentication flow secure
- [ ] Session management proper

## References

- OWASP Top 10
- `src/api/fetchData.ts` - CSRF token handling
- `src/utils/generateCsrfToken.ts` - CSRF token generation
- `src/utils/validateInputValue.ts` - Input validation
- Keycloak security documentation
