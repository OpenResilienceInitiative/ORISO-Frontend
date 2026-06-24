const express = require('express');
const { authenticateRequest } = require('./authenticateRequest');
const { userHasRoomAccess } = require('./roomMembership');

const getLivekitTokenServiceBase = () =>
	(process.env.LIVEKIT_TOKEN_SERVICE_URL || '').replace(/\/+$/, '');

const resolveRoomName = (query = {}, body = {}) => {
	const roomName = query.roomName || body.roomName || body.room;
	return typeof roomName === 'string' ? roomName.trim() : '';
};

const forwardTokenRequest = async (roomName, identity) => {
	const livekitTokenServiceBase = getLivekitTokenServiceBase();
	if (!livekitTokenServiceBase) {
		return {
			status: 503,
			body: { error: 'LIVEKIT_TOKEN_SERVICE_URL is not configured' }
		};
	}

	const targetUrl = `${livekitTokenServiceBase}/api/livekit/token?roomName=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`;
	const response = await fetch(targetUrl);
	const body = await response.json().catch(() => ({}));

	return { status: response.status, body };
};

const handleGetLivekitToken = async (req, res) => {
	try {
		const roomName = resolveRoomName(req.query);
		if (!roomName) {
			return res.status(400).json({ error: 'roomName is required' });
		}

		const hasAccess = await userHasRoomAccess(req, roomName);
		if (!hasAccess) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		const result = await forwardTokenRequest(roomName, req.userId);
		return res.status(result.status).json(result.body);
	} catch (error) {
		if (error.message === 'USER_SERVICE_URL is not configured') {
			return res.status(503).json({ error: error.message });
		}

		console.error('LiveKit token proxy error');
		return res.status(500).json({ error: 'Failed to get LiveKit token' });
	}
};

const handlePostLivekitToken = async (req, res) => {
	try {
		const roomName = resolveRoomName({}, req.body);
		if (!roomName) {
			return res.status(400).json({ error: 'roomName is required' });
		}

		const hasAccess = await userHasRoomAccess(req, roomName);
		if (!hasAccess) {
			return res.status(403).json({ error: 'Forbidden' });
		}

		const livekitTokenServiceBase = getLivekitTokenServiceBase();
		if (!livekitTokenServiceBase) {
			return res.status(503).json({
				error: 'LIVEKIT_TOKEN_SERVICE_URL is not configured'
			});
		}

		const response = await fetch(
			`${livekitTokenServiceBase}/api/livekit/token`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...req.body,
					roomName,
					identity: req.userId
				})
			}
		);
		const data = await response.json().catch(() => ({}));
		return res.status(response.status).json(data);
	} catch (error) {
		if (error.message === 'USER_SERVICE_URL is not configured') {
			return res.status(503).json({ error: error.message });
		}

		console.error('LiveKit token proxy error');
		return res.status(500).json({ error: 'Failed to generate token' });
	}
};

const registerLivekitTokenRoutes = (
	app,
	authMiddleware = authenticateRequest
) => {
	app.get('/api/livekit/token', authMiddleware, handleGetLivekitToken);
	app.post('/api/livekit/token', authMiddleware, handlePostLivekitToken);
};

module.exports = {
	registerLivekitTokenRoutes,
	handleGetLivekitToken,
	handlePostLivekitToken,
	resolveRoomName,
	forwardTokenRequest
};
