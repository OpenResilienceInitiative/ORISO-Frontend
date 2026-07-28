class MatrixClient {}

class Room {}

class MatrixEvent {}

class MatrixCall {}

class CallFeed {}

class GroupCall {}

const GroupCallIntent = {};
const GroupCallType = {};
const GroupCallEvent = {};
const CallFeedEvent = {};

const createClient = () => ({
	getRoom: () => null,
	getRooms: () => [],
	isLoggedIn: () => false,
	on: () => undefined,
	off: () => undefined,
	removeListener: () => undefined,
	startClient: () => Promise.resolve(),
	stopClient: () => undefined
});

module.exports = {
	CallFeed,
	CallFeedEvent,
	createClient,
	GroupCall,
	GroupCallEvent,
	GroupCallIntent,
	GroupCallType,
	MatrixCall,
	MatrixClient,
	MatrixEvent,
	Room
};
