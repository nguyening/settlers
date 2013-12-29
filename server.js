// require
var Globals = require('./lib/globals.js').Globals;
var State = require('./lib/state.js').State;
var HexagonGrid = require('./lib/hexgrid.js').HexagonGrid;

var jade = require('jade');
var express = require('express'), app = express();
var http = require('http'), 
	server = http.createServer(app), 
	io = require('socket.io').listen(server);

// Disabling web-sockets
// io.configure(function () { 
//   io.set("transports", ["xhr-polling"]); 
//   io.set("polling duration", 10); 
// }); 

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
	app.use('/lib', express.static(__dirname + '/lib'));
	app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res){
	res.render('home.jade');
});

server.listen(process.env.PORT || 3000);	// heroku dynamically assigns port
console.log('Express server started on port %s', server.address().port);

var LogicalBoard = function (_width, _height) {   
	this.width = _width;
	this.height = _height;

	this.state = new State();
	this.Hex = function (_resource, _roll, _x, _y) {
		this.resource = _resource;
		this.roll = _roll;

		this.x = _x;
		this.y = _y;

		this.setRoll = function (_roll) {
			this.roll = _roll;
		};	  
	};
	this.init.apply(this, arguments);
};

LogicalBoard.prototype = {
	init : function (width, height) {
		var grid = [];
		var terrains = Globals.terrains;

		// initialize grid with resources
		var row, terrain, idx;
		for(var i = 0; i < height; i++) {
			row = [];
			for(var j = 0; j < width; j++) {
				if(Globals.isUnusedFace([j, i])) {
					row.push(new this.Hex(0,0));
				}
				else {
					idx = Math.floor(Math.random() * terrains.length);
					row.push(new this.Hex(terrains[idx], 7));
					if(terrains[idx] == 5) {
						this.state.placeBaron([j, i]);
					}
					terrains.splice(idx, 1);
				}
			}

			grid.push(row);
		}
		
		// assign rolls in spiral
		var ordering = [[0,3],[1,2],[1,1],[2,1],[3,1],[4,2],[4,3],[4,4],[3,5],
					[2,5],[1,5],[1,4],[1,3],[2,2],[3,2],[3,3],[3,4],[2,4],[2,3]];
		var rolls = Globals.rolls;
		var order, hex;
		for(var i = 0; i < ordering.length; i++) {
			order = ordering[i];
			hex = grid[order[1]][order[0]];
			if(hex.resource != 5) {
				hex.setRoll(rolls[0]);
				rolls.splice(0, 1);
			}
		}

		this.state.setGrid(grid);
	},

	utils : {
		// build array of intersecting coordinates in arrays a, b
		intersectEndPts : function (a, b) {
			var t, res = [];
			if(a.length < b.length) {
				t = a;
				a = b;
				b = t;
			}

			var a_vertices = a.toString();
			var b_vertex;
			for(var i = 0; i < b.length; i++) {
				b_vertex = b[i].toString();
				if(a_vertices.indexOf(b_vertex) != -1)
				   res.push(b[i]);
			}
			return res;
		},
	},

	// game-logic
	canBuild : function (build, data) {
		var logic = this;
		var state = logic.state;

		// checks if array of objects a contains object b
		var objArrContains = function (a, b) {
		for(var i = 0; i < a.length; i++) {
			if(a[i].toString() == b.toString())
				return true;
			}
			return false;
		}

		if(build == 'road') {
			var availableEndPts = state.getCurrRoads().map(function (edge, idx) {
				return HexagonGrid.endpoints(edge);
			});
			availableEndPts = [].concat.apply([], availableEndPts);			// flatten array

			var currentSettlements = state.getCurrSettlements();
			var roadEndPts = HexagonGrid.endpoints(data);

			var opponentRoads = state.getOpponentRoads();
			return ((logic.utils.intersectEndPts(availableEndPts, roadEndPts).length > 0 || 
					 logic.utils.intersectEndPts(currentSettlements, roadEndPts).length > 0) 
					&& !objArrContains(opponentRoads, data));
		}
		else if(build == 'settlement') {
			var availableEndPts = state.getCurrRoads().map(function (edge, idx) {
				return HexagonGrid.endpoints(edge);
			});
			var selectedVertex = [data];
			var adjacentVertices = HexagonGrid.adjacent(data);
			var allSettlements = [].concat.apply([], state.getAllSettlements());
			
			var currentSettlements = state.getCurrSettlements();
			var currentRound = state.getRound();
			var currentPlayer = state.getCurrentPlayer();

			if( (currentRound < 1 && currentSettlements.length < 1) ||
				(currentRound > 1 && currentRound < 2 && currentSettlements.length < 2) || 
				(currentSettlements.length < 2 && currentPlayer == Globals.playerData.length - 1))	// last player can place twice
				return !(logic.utils.intersectEndPts(allSettlements, adjacentVertices).length > 0);
			else
				return ((logic.utils.intersectEndPts(availableEndPts, selectedVertex).length > 0) && 
						!(logic.utils.intersectEndPts(allSettlements, adjacentVertices).length > 0));
		}
		else if(build == 'city') {
			var currentSettlements = state.getCurrSettlements();
			var currentCities = state.getCurrCities();
			return (logic.utils.intersectEndPts(currentSettlements, [data]) > 0) && 
					!(logic.utils.intersectEndPts(currentCities, [data]) > 0);
		}
		else
			return false;
	},  

	canAfford : function (type) {
		var hand = this.state.getCurrHand();
		var currentRound = this.state.getRound();
		
		if(currentRound < 2) {							// first 2 rounds are freebies
			var currentRoads = this.state.getCurrRoads();
			var currentPlayer = this.state.getCurrentPlayer();
			if(type == 'road') {
				if( (currentRound < 1 && currentRoads.length == 0) ||
					(currentRound > 1 && currentRound < 2 && currentRoads.length <= 1) ||
					(currentRound < 1 && currentRoads.length == 1 && currentPlayer == Globals.playerData.length -1))
					return hand;
				else
					return false;
			}
			else if(type == 'settlement')
				return hand;
		}

		// deduct resources from a given b
		var deduct = function (a, b) {
			for(var i = 0; i < b.length; i++) {
				var idx = a.indexOf(b[i]);
				if(idx == -1)
					return false;

				a.splice(idx, 1);
			}
			return a;
		};
		if(type == 'road') {
			return deduct(hand, [4, 0]);
		}
		else if(type == 'settlement') {
			return deduct(hand, [0, 1, 3, 4]);
		}
		else if(type == 'city') {
			return deduct(hand, [3, 3, 2, 2, 2]);
		}
		else return deduct;	// do it yourself
	},

	roll : function () {
		var lb = this;
		var state = lb.state;
		var distributeResources = function (roll) {
			var grid = state.getGrid();
			var resources = [];
			for(var i = 0; i < lb.height; i++) {
				for(var j = 0; j < lb.width; j++) {
					if(grid[i][j].roll == roll && grid[i][j].resource != 5) {
							resources.push([j, i, grid[i][j].resource]);
					}
				}
			}
			
			var resource, resourceVertices, cardsAdded = Globals.defaultState.hands.slice(0); // copy by value, JS ref trouble again!
			var settlements = state.getAllSettlements();
			var cities = state.getAllCities();
			for(var i = 0; i < resources.length; i++) {
				resource = resources[i][2];
				resourceVertices = HexagonGrid.corners([resources[i][0], resources[i][1]]);

				for(var p = 0; p < Globals.playerData.length; p++) {
					cardsAdded[p] = cardsAdded[p].concat(lb.utils.intersectEndPts(settlements[p], resourceVertices)
										.map(function () { return resource; }));
					cardsAdded[p] = cardsAdded[p].concat(lb.utils.intersectEndPts(cities[p], resourceVertices)		// add +1 for cities
										.map(function () {return resource;}));
				}
			}
			
			var pSockets = state.getPlayerSockets();
			for(var p = 0; p < Object.keys(pSockets).length; p++) {
				state.giveResources(p, cardsAdded[p]);
				io.sockets.socket(pSockets[p]).emit('gain', {
					action: 'roll',
					cardsAdded : cardsAdded[p],
				});
			}
		};

		// var dice = [Math.floor(Math.random()*6+1), Math.floor(Math.random()*6+1)];
		var dice = [1,2];
		io.sockets.emit('roll', { roll: dice[0]+dice[1] });

		// robber baron
		if(dice[0]+dice[1] == 7) {
			// send overflow notices
			state.setBaronState(3);
			var pSockets = state.getPlayerSockets();
			var hands = state.getAllHands();
			var overflowPlayers = [];
			for(var p = 0; p < Object.keys(pSockets).length; p++) {
				if(hands[p].length >= Globals.overflowHandSize) {
					io.sockets.socket(pSockets[p])
						.emit('overflowNotice', {baronState: 3});
					overflowPlayers.push(p);
				}
			}

			if(overflowPlayers.length == 0) {	// if no overflows, then we can move on
				// prompt current player to move baron
				state.setBaronState(1);
				io.sockets.socket(pSockets[state.getCurrentPlayer()])
					.emit('promptBaronMove', {baronState: 1});
			}
			else {	// push waits to other players
				state.setOverflowPlayers(overflowPlayers);
				for(var p = 0; p < Globals.playerData.length; p++) {
					if(overflowPlayers.indexOf(p) == -1) {
						io.sockets.socket(pSockets[p])
							.emit('overflowWait', {baronState: 3, overflowPlayers: overflowPlayers});
					}
				}
			}

		}
		else
			distributeResources(dice[0]+dice[1]);
	},

	robbablePlayers : function () {
		var intersectEndPts = function (a, b) {
			var t;
			if(a.length < b.length) {
				t = a;
				a = b;
				b = t;
			}

			a_vertices = a.toString();
			for(var i = 0; i < b.length; i++) {
				b_vertex = b[i].toString();
				if(a_vertices.indexOf(b_vertex) != -1)
					return true;
				}
			return false;
		};

		var robbableVertices = HexagonGrid.corners(this.state.getBaron());
		var playerHands = this.state.getAllHands();
		var playerSettlements = this.state.getAllSettlements();
		var currentPlayer = this.state.getCurrentPlayer();
		var robbablePlayers = [];

		for(var p = 0; p < Globals.playerData.length; p++) {
			if( intersectEndPts(robbableVertices, playerSettlements[p]) &&
				playerHands[p].length > 0 &&
				p != currentPlayer)
				robbablePlayers.push(p);
		}

		return robbablePlayers;
	},

	// lobby-logic
	checkFullLobby : function () {
		var pSockets = this.state.getPlayerSockets();
		var players = [];
		for(var key in pSockets) {
			var val = pSockets[key];
			if(val) players.push(val);
		}
		return players.length == Globals.playerData.length;
	},

	addPlayer : function (sessId) {
		// put player in first free slot
		var pSockets = this.state.getPlayerSockets();
		for(var key in pSockets) {
			if(!pSockets[key]) {
				this.state.associatePlayer(key, sessId);
				return parseInt(key);
			}
		}
	},

	removePlayer : function (sessId) {
		var pSockets = this.state.getPlayerSockets();
		for(var key in pSockets) {
			if(pSockets[key] == sessId) {
				this.state.associatePlayer(key, null);
				return parseInt(key);
			}
		}
	},
};

var lb = new LogicalBoard(Globals.gridWidth, Globals.gridHeight);

io.sockets.on('connection', function (socket) {
	socket.on('disconnect', function () {
		var pnum = lb.removePlayer(socket.id);
		socket.broadcast.emit('players', {
			reason: 'DROP',
			player: socket.id,
			player_num: pnum,
			players: lb.state.getPlayerSockets(),
		});
	});

	socket.on('grabState', function (data) {
		var pnum, state;
		if(!lb.checkFullLobby()) {
			pnum = lb.addPlayer(socket.id);
			socket.broadcast.emit('players', {
				reason: 'NEW',
				player: socket.id,
				player_num: pnum,
				players: lb.state.getPlayerSockets(),
			});

			state = lb.state.grabLocalState(pnum);
			socket.emit('state', {
				gW: lb.width,
				gH: lb.height,
				state: state,
			});
		}
		else {	// observer
			pnum = -1;
			socket.emit('full', {});
		}
	});

	// Robber baron handlers
	socket.on('requestBaronMove', function (data) {
		var state = lb.state;
		if( !(state.isMyTurn(socket.id) && 
			state.isBaronState(1) &&
			!state.isBaron(data.coords)) )
			return;

		state.placeBaron(data.coords);
		io.sockets.emit('moveBaron', {
			coords: data.coords,
		});

		var robbablePlayers = lb.robbablePlayers();
		if(robbablePlayers.length > 0) {
			state.setBaronState(2);
			socket.emit('promptBaronSteal', {
				baronState: 2,
				robbable: robbablePlayers,
			});
		}
		else {
			state.setBaronState(0);
			socket.emit('baronFinish', {baronState: 0});
		}
	});

	socket.on('requestBaronSteal', function (data) {
		var state = lb.state;
		if(!(state.isMyTurn(socket.id) && state.isBaronState(2)))
			return;

		if(lb.robbablePlayers().indexOf(data.player_num) != -1) {
			var oppHand = state.getHand(data.player_num);
			var myHand = state.getCurrHand();

			var i = Math.floor(Math.random()*oppHand.length);
			myHand.push(oppHand[i]);
			oppHand.splice(i, 1);

			io.sockets.socket(lb.state.getSocket(data.player_num)).emit('deduct', {
				action: 'steal',
				hand: oppHand,
			});

			socket.emit('gain', {
				action: 'steal',
				oppPlayer: data.player_num,
				cardsAdded : [oppHand[i]],
			});

			state.setBaronState(0);
			socket.emit('baronFinish', {baronState: 0});
		}
	});

	socket.on('overflowResolve', function (data) {
		if(!lb.state.isBaronState(3))
			return;

		var deduct = lb.canAfford('nothingyouveseenbefore');
		var state = lb.state;
		var overflowPlayers = state.getOverflowPlayers();
		for(var p = 0; p < Globals.playerData.length; p++) {
			if(state.getSocket(p) == socket.id) {
				if(overflowPlayers.indexOf(p) == -1)	// no need to discard
					return;
				var oldHand = state.getHand(p);
				var newHand = deduct(oldHand, data.cardsDiscard);
				if(newHand && data.cardsDiscard.length >= Math.floor(oldHand.length/2)) {
					state.setHand(p, newHand);
					state.removeOverflowPlayer(p);

					socket.emit('deduct', {
						action: 'overflow',
						hand: newHand,
					});
				}
				break;
			}
		}

		if(!overflowPlayers.length) {	// if there's no more remaining to check, move on
			// prompt current player to move baron
			state.setBaronState(1);
			io.sockets.socket(state.getSocket(state.getCurrentPlayer()))
				.emit('promptBaronMove', {baronState: 1});
		}
	});

	// Building handler
	socket.on('buildRequest', function (data) {
		// make sure request is during this user's turn
		var state = lb.state;
		if(!state.isMyTurn(socket.id))
			return;

		// check if user can build or can override
		var hand;
		if((hand=lb.canAfford(data.type)) && lb.canBuild(data.type, data.coords)) {
			state.addStructure(data);

			io.sockets.emit('buildAccept', {	// send to all clients
				type: data.type,
				coords: data.coords
			});

			if(state.getRound() >= 2) {
				state.setHand(state.getCurrentPlayer(), hand);
				socket.emit('deduct', {
					action: 'build',
					hand: hand,
				});	
			}
		}
	});

	socket.on('endTurn', function (data) {
		var state = lb.state;
		if(! (state.isMyTurn(socket.id) && state.isBaronState(0)) )	// don't end while waiting
			return;

		var round = state.getRound();

		// player order goes 0,1,2,3,2,1,0 to place settlements and roads
		if(round < 1 && lb.state.currentPlayer == Globals.playerData.length - 1)
			round += 1/Globals.playerData.length;

		round += 1/Globals.playerData.length;
		state.setRound(round);

		if(round < 1) {
			currentPlayer = ++lb.state.currentPlayer % Globals.playerData.length;
			state.setCurrentPlayer(currentPlayer);
			io.sockets.emit('nextTurn', {currentPlayer: currentPlayer, round: round});
		}
		else if((1 < round) && (round < 2)) {
			currentPlayer = lb.state.getCurrentPlayer()-1;
			state.setCurrentPlayer(currentPlayer);
			io.sockets.emit('nextTurn', {currentPlayer: currentPlayer, round: round});
		}	
		else if(round == 2) {
			currentPlayer = 0;
			state.setCurrentPlayer(currentPlayer);
			io.sockets.emit('nextTurn', {currentPlayer: currentPlayer, round: round});
			lb.roll();
		}
		else {
		// normal rounds			
		currentPlayer = ++lb.state.currentPlayer % Globals.playerData.length;
			state.setCurrentPlayer(currentPlayer);
			io.sockets.emit('nextTurn', {currentPlayer: currentPlayer, round: round});
			lb.roll();
		}
	});

	// admin/debugging

	socket.on('giveResource', function (data) {
		if(data.resource >= 5 || data.resource < 0)	// shouldn't invalid resources
			return;

		var p = lb.state.getPlayerNum(socket.id);
		// var cardsAdded = Globals.defaultState.hands.slice(0);
		// cardsAdded[p] = [data.resource]
		lb.state.giveResources(p, [data.resource]);

		socket.emit('gain', {
			action: 'admin',
			cardsAdded: [data.resource],
		});
	});

	socket.on('chat', function (data) {
		var p = lb.state.getPlayerNum(socket.id);
		socket.broadcast.emit('chatMsg', {message: data.message, author: p});
	})
});

