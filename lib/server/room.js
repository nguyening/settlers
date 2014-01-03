var State = require('../state.js').State,
	Logic = require('./logic.js').Logic;

var width = 6,
	height = 7;

var Room = function (hostid, io) {
	var self = this,
		state = new State(),
		logic = new Logic(width, height, state, self),
		ready = false;

	this.__defineGetter__('count', function () {
		var count = 0;
		for(var p in state.players)
			if(state.players[p] && state.players[p].active) count++;
		return count;
	});

	var send = function (player_num, data) {
		var socket_id = state.getSocket(player_num);
		io.sockets.socket(socket_id).emit(data.message, data.data);
		console.log(JSON.stringify({
			type: 'emit',
			data: data,
			player: player_num,
		}));
	};

	var sendAll = function (data) {
		console.log(JSON.stringify({
			type: 'emit',
			data: data,
			player: 'ALL',
		}));
		io.sockets.in(hostid).emit(data.message, data.data);
	};

	// exposing some private methods for logic to use
	this.sendAll = sendAll;
	this.send = send;

	this.add = function (uid, socket, seat) {
		if(seat) {
			state.associatePlayer(seat, uid, socket);
		}
		else {
			seat = -1;

			for(var p in state.players) {
				if(!state.players[p] || !state.players[p].active) {
					state.associatePlayer(p, uid, socket);
					seat = p;
					break;
				}
			}
		}

		sendAll({
			message: 'players', 
			data: {
				reason: 'NEW',
				player: uid,
				player_num: seat,
				players: state.players,
			},
		});

		if(!ready && self.count == 4) {
			ready = true;
			logic.init();

			sendAll({
				message: 'lobby:ready',
				data: {},
			});
		}
		else if(ready) {
			send(seat, {
				message: 'lobby:ready',
				data: {},
			});
		}

		return seat;
	};

	this.raiseEvent = function (event, data) {
		console.log(JSON.stringify({
			type: 'statelog',
			data: state.getFullState(),
		}));

		logic.events.emit(event, data);
	};
};

exports.Room = Room;