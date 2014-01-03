var uuid = require('node-uuid');
var io = require('socket.io');
// var socketIOWildcard = require('socket.io-wildcard');

var LogicalBoard = require('./lib/server/logic.js').LogicalBoard;
var Room = require('./room.js').Room;

var Server = function (http) {
	var sio = io.listen(http);
	new Room(uuid.v4(), sio);
}


// var gridWidth = 6;
// var gridHeight = 7;
// var lb = new LogicalBoard(gridWidth, gridHeight, server);