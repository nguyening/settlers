var Globals = require('../globals.js').Globals;
var HexagonGrid = require('../hexgrid.js').HexagonGrid;
var State = require('../state.js').State;
var socketIO = require('socket.io');
var socketIOWildcard = require('socket.io-wildcard');

var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;


var LogicalBoard = function (_width, _height, httpServer) {   
	this.width = _width;
	this.height = _height;
	this.state = new State();
	this.sio = socketIO.listen(httpServer);

	this.sio.set('log level', 3);

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
		var terrains = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5];

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
		var rolls = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

		var order, hex;
		for(var i = 0; i < ordering.length; i++) {
			order = ordering[i];
			hex = grid[order[1]][order[0]];
			if(hex.resource != 5) {
				hex.setRoll(rolls[0]);
				rolls.splice(0, 1);
			}
		}

		// assign harbors
		var harborAssignments = [0, 1, 2, 3, 4, -1, -1, -1, -1];	// -1 for 3:1 harbors
		harborAssignments.sort(function() {return 0.5 - Math.random();});	// shuffle array
		this.state.setHarborAssignments(harborAssignments);

		this.state.setGrid(grid);
		this.handleSocket();
	},

	// send message to player_num
	// can't be in utils because it needs instance data from lb
	send : function (player_num, data) {
		var socket_id = this.state.getSocket(player_num);
		this.sio.sockets.socket(socket_id).emit(data.message, data.data);
		if(player_num == this.state.getCurrentPlayer())
			console.log(JSON.stringify({
				type: 'emit',
				data: data,
				player: 'SELF'
			}));
		else
			console.log(JSON.stringify({
				type: 'emit',
				data: data,
				player: player_num,
			}));
	},

	sendAll : function (data) {
		console.log(JSON.stringify({
			type: 'emit',
			data: data,
			player: 'ALL',
		}));
		this.sio.sockets.emit(data.message, data.data);
	},

	handleSocket : function () {
		var io = this.sio;
		var lb = this;

		io.sockets.on('connection', function (socket) {
			// var Logger = io.log;
			// socket.on('*', function (evt) {
			// 	console.log(socket.id+' END '+evt.name);
			// 	// Logger.info(evt.args);
			// });

			var stateLog = function () {
				console.log(JSON.stringify({
					type: 'statelog',
					data: lb.state.getFullState(),
				}));
			};

			(function(){
				var _origEmit = socket.emit;
				socket.emit = function() {
					console.log(JSON.stringify({
						type: 'emit',
						data: arguments,
						player: 'SELF',
					}));
					_origEmit.apply(socket, arguments);
				};

				var $emit = socket.$emit;
				socket.$emit = function() {
					console.log(JSON.stringify({
						type: 'transaction',
						socket: socket.id,
						player: lb.state.getPlayerNum(socket.id),
						command: arguments[0],
						data: arguments[1],
					}));
					$emit.apply(socket, arguments);
				};

				// can't log broadcasts =\
				// should start using rooms..
				// _origEmit = socket.broadcast.emit;
				// socket.broadcast.emit = function() {
				// 	console.log(JSON.stringify({
				// 		type: 'emit',
				// 		data: arguments,
				// 		player: 'ALL',
				// 	}));
				// 	_origEmit.apply(socket.broadcast, arguments);
				// };
			})();

			socket.on('disconnect', function (data) {
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

			socket.on('roll', function (data) {
				stateLog();
				// console.log(lb.state.getPlayerNum(socket.id)+' tries to roll...');
				if(lb.state.getRoll() || !lb.state.isMyTurn(socket.id))	// no re-rolls
					return;
				lb.roll();
			})

			// Robber baron handlers
			socket.on('requestBaronMove', function (data) {
				stateLog();
				// console.log(lb.state.getPlayerNum(socket.id)+' tries to move baron...');
				// console.log(' tries to roll...');
				var state = lb.state;
				if( !(state.isMyTurn(socket.id) && 
					state.isBaronState(1) &&
					!state.isBaron(data.coords)) )
					return;

				state.placeBaron(data.coords);
				lb.sendAll({
					message: 'moveBaron', 
					data: {coords: data.coords},
				});

				var robbablePlayers = lb.robbablePlayers();
				if(robbablePlayers.length > 0) {
					state.setBaronState(2);
					state.setRobbablePlayers(robbablePlayers);
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
				stateLog();
				var state = lb.state;
				if(!(state.isMyTurn(socket.id) && state.isBaronState(2)))
					return;

				if(lb.state.isRobbable(data.player_num)) {
					var oppHand = state.getHand(data.player_num);
					var myHand = state.getCurrHand();

					var i = Math.floor(Math.random()*oppHand.length);
					var resource = oppHand[i];
					myHand.push(oppHand[i]);
					oppHand.splice(i, 1);

					lb.send(data.player_num, {
						message: 'deduct', 
						data: {action: 'steal', hand: oppHand},
					});

					socket.emit('gain', {
						action: 'steal',
						oppPlayer: data.player_num,
						cardsAdded : [resource],
					});

					state.setBaronState(0);
					socket.emit('baronFinish', {baronState: 0});
				}
			});

			socket.on('overflowResolve', function (data) {
				stateLog();
				if(!lb.state.isBaronState(3))
					return;

				var state = lb.state;
				var overflowPlayers = state.getOverflowPlayers();
				var t;
				for(var p = 0; p < NUM_PLAYERS; p++) {
					if(state.getSocket(p) == socket.id) {
						if((t=overflowPlayers.indexOf(p)) == -1)	// no need to discard
							return;
						var newHand = lb.utils.deduct(state.getHand(p), data.cardsDiscard);
						if(newHand && data.cardsDiscard.length >= Math.floor(state.getHand(p).length/2)) {
							state.setHand(p, newHand);
							state.removeOverflowPlayer(p);
							overflowPlayers.splice(t, 1);

							socket.emit('deduct', {
								action: 'overflow',
								hand: newHand,
							});
						}
						else 
							return;
						break;
					}
				}

				if(!overflowPlayers.length) {	// if there's no more remaining to check, move on
					// prompt current player to move baron
					state.setBaronState(1);
					lb.send(state.getCurrentPlayer(), {
						message: 'promptBaronMove', 
						data: {baronState: 1}
					});
				}
				else {
					for(var p = 0; p < NUM_PLAYERS; p++) {
						if(overflowPlayers.indexOf(p) == -1) {
							lb.send(p,{
								message: 'overflowWait', 
								data: {baronState: 3, overflowPlayers: overflowPlayers}
							});
						}
					}
				}
			});

			// Building handler
			socket.on('buildRequest', function (data) {
				stateLog();
				// make sure request is during this user's turn
				var state = lb.state;
				if(!(state.isMyTurn(socket.id) && (state.getRoll() || state.getRound() < 2)))
					return;

				// check if user can build or can override
				var currentPlayer = state.getCurrentPlayer();
				var hand, canBuild = lb.canBuild(data.type, data.coords);

				if(data.type == 'road' &&
					canBuild && 
					state.getActiveDev() == 2 && 
					state.invokeActiveDev() >= 0) {
						state.addStructure(data);
						lb.sendAll({
							message: 'buildAccept', 
							data: {type: data.type, coords: data.coords},
						});
				}
				else if(canBuild && (hand=lb.canAfford(data.type))) {
					if(data.type == 'dev') {
						var devNum = state.drawDev();
						if(devNum == 0)	// out of dev cards
							return;

						state.giveDev(currentPlayer, devNum);
						for(var p = 0; p < NUM_PLAYERS; p++) {
							if(p == currentPlayer) {
								state.setHand(currentPlayer, hand);
								lb.send(p, {
									message: 'devGain',
									data: {devNum: devNum},
								});
								socket.emit('deduct', {
									action: 'build',
									hand: hand,
								});	
							}
							else {
								lb.send(p, {
									message: 'devGain',
									data: {devNum: 0},
								});
							}
						}
					}
					else {
						state.addStructure(data);
						lb.sendAll({
							message: 'buildAccept', 
							data: {type: data.type, coords: data.coords},
						});

						if(state.getRound() >= 2) {
							state.setHand(currentPlayer, hand);
							socket.emit('deduct', {
								action: 'build',
								hand: hand,
							});	
						}
					}
				}
			});

			// Trading handlers
			// user tries to announce a trade deal
			socket.on('tradeAnnounceRequest', function (data) {
				stateLog();
				if(!lb.state.isMyTurn(socket.id))
					return;
				var newHand = lb.utils.deduct(lb.state.getCurrHand(), data.tradeCards);
				if(newHand && data.wantCards.length > 0) {
					lb.state.setTradeCards(data.tradeCards);		// store copy of trade for later
					lb.state.setWantCards(data.wantCards);

					socket.broadcast.emit('tradeAnnounce', {
						cardsGain: data.tradeCards,
						cardsDeduct: data.wantCards,
					});
				}
			});

			socket.on('tradeAnnounceCancel', function (data) {
				stateLog();
				if(!(lb.state.isMyTurn(socket.id) && 
					lb.state.getTradeCards().length > 0 && 
					lb.state.getWantCards().length > 0))
					return;

				lb.state.setTradeCards([]);
				lb.state.setWantCards([]);

				lb.sendAll({
					message: 'tradeEnd',
					data: {reason: 'cancel'},
				});
			});

			// user accepts an announced trade deal
			socket.on('tradeAccept', function (data) {
				stateLog();
				var cardsDeduct = lb.state.getTradeCards();
				var cardsGain = lb.state.getWantCards();

				if(!lb.state.isMyTurn(socket.id) && 			// current player shouldn't accept their own trade
					cardsDeduct.length > 0 && 
					cardsGain.length > 0) {

					var currentPlayer = lb.state.getCurrentPlayer();
					var tradingPlayer = lb.state.getPlayerNum(socket.id);

					var newCurrHand = lb.utils.deduct(lb.state.getHand(currentPlayer), cardsDeduct);
					var newTradHand = lb.utils.deduct(lb.state.getHand(tradingPlayer), cardsGain)
					if(newCurrHand && newTradHand) {
						lb.state.setHand(currentPlayer, newCurrHand);
						lb.state.setHand(tradingPlayer, newTradHand);
						lb.state.giveResources(currentPlayer, cardsGain);
						lb.state.giveResources(tradingPlayer, cardsDeduct);
						newCurrHand = newCurrHand.concat(cardsGain);
						newTradHand = newTradHand.concat(cardsDeduct);
						
						lb.send(currentPlayer, {
							message: 'gain', 
							data: {action: 'trade', cardsAdded: cardsGain},
						});
						lb.send(tradingPlayer, {
							message: 'gain', 
							data: {action: 'trade', cardsAdded: cardsDeduct},
						});


						lb.send(currentPlayer, {
							message: 'deduct', 
							data: {action: 'trade', hand: newCurrHand},
						});
						lb.send(tradingPlayer, {
							message: 'deduct', 
							data: {action: 'trade', hand: newTradHand},
						});

						lb.sendAll({
							message: 'tradeEnd',
							data: {reason: 'accept'},
						});

						lb.state.setTradeCards([]);
						lb.state.setWantCards([]);
					}
				}
			});

			socket.on('exchangeRequest', function (data) {
				stateLog();
				var harborAction;
				var currentPlayer = lb.state.getCurrentPlayer();
				if(lb.state.getActiveDev() == 3 &&
					data.wantCards.length == 2 &&
					data.tradeCards.length == 0 &&
					lb.state.invokeActiveDev() >= 0){
						lb.state.giveResources(currentPlayer, data.wantCards);
						lb.send(currentPlayer, {
							message: 'gain', 
							data: {action: 'exchange', cardsAdded: data.wantCards},
						});
				}
				else if(lb.utils.deduct(lb.state.getCurrHand(), data.tradeCards) &&
					(harborAction=lb.harborProcess(data.tradeCards, data.wantCards))) {
						lb.send(currentPlayer, {
							message: 'gain', 
							data: {action: 'exchange', cardsAdded: harborAction.cardsGain},
						});

						lb.send(currentPlayer, {
							message: 'deduct', 
							data: {action: 'exchange', hand: harborAction.hand},
						});
				}
			});

			socket.on('useDevRequest', function (data) {
				stateLog();
				if(lb.state.isMyTurn(socket.id) && lb.useDev(data.devNum))
					lb.sendAll({
						message: 'useDev',
						data: {devNum: data.devNum},
					});
			});

			socket.on('endTurn', function (data) {
				stateLog();
				var state = lb.state;
				if(! (state.isMyTurn(socket.id) && state.isBaronState(0)) )	// don't end while waiting
					return;

				var round = state.getRound();
				lb.state.setRoll(0);		// reset roll
				lb.state.resetActiveDev();

				// player order goes 0,1,2,3,2,1,0 to place settlements and roads
				if(round < 1 && lb.state.getCurrentPlayer() == NUM_PLAYERS - 1)
					round += 1/NUM_PLAYERS;

				round += 1/NUM_PLAYERS;
				state.setRound(round);

				if(round < 1) {
					currentPlayer = (lb.state.getCurrentPlayer()+1) % NUM_PLAYERS;
					state.setCurrentPlayer(currentPlayer);
					lb.sendAll({
						message: 'nextTurn', 
						data: {currentPlayer: currentPlayer, round: round}
					});
				}
				else if((1 < round) && (round < 2)) {
					currentPlayer = lb.state.getCurrentPlayer()-1;
					state.setCurrentPlayer(currentPlayer);
					lb.sendAll({
						message: 'nextTurn', 
						data: {currentPlayer: currentPlayer, round: round}
					});
				}	
				else if(round == 2) {
					currentPlayer = 0;
					state.setCurrentPlayer(currentPlayer);
					
                   var cardsAdded = [[],[],[],[]];
                   var settlements = state.getAllSettlements();
                   var grid = lb.state.getGrid();

                   for(var p = 0; p < NUM_PLAYERS; p++) {
                           cardsAdded[p] = HexagonGrid.touches(settlements[p][0]).map(function (hex) {
                                   return grid[hex[1]][hex[0]].resource;
                           });
                           cardsAdded[p] = cardsAdded[p].filter(function (resource) {
	                           		return (resource != 5);
                           });
					}
                   
                   for(var p = 0; p < NUM_PLAYERS; p++) {
                           state.giveResources(p, cardsAdded[p]);
                           lb.send(p,{
                                   message: 'gain', 
                                   data: {
                                           action: 'roll',
                                           cardsAdded : cardsAdded[p],
                                   },
                           });
					}
					lb.sendAll({
						message: 'nextTurn', 
						data: {currentPlayer: currentPlayer, round: round}
					});
				}
				else {
					if(!state.getRoll())	// player has to roll
						return;
					// normal rounds	
					lb.state.flushDevQueue();		
					currentPlayer = (lb.state.getCurrentPlayer()+1) % NUM_PLAYERS;
						state.setCurrentPlayer(currentPlayer);
						lb.sendAll({
							message: 'nextTurn', 
							data: {currentPlayer: currentPlayer, round: round}
						});
						// lb.roll();
				}
			});

			// admin/debugging

			socket.on('giveResource', function (data) {
				stateLog();
				if(data.resource >= 5 || data.resource < 0 || !data.resource)	// shouldn't invalid resources
					return;

				var p = lb.state.getPlayerNum(socket.id);
				lb.state.giveResources(p, [data.resource]);

				socket.emit('gain', {
					action: 'admin',
					cardsAdded: [data.resource],
				});
			});

			socket.on('giveDev', function (data) {
				stateLog();
				if(!lb.state.isMyTurn(socket.id))
					return;

				var currentPlayer = lb.state.getCurrentPlayer();
				var devNum = lb.state.drawDev();
				if(devNum == 0)
					return;
				lb.state.giveDev(currentPlayer, devNum);
				lb.state.flushDevQueue();
				for(var p = 0; p < NUM_PLAYERS; p++) {
					if(p == currentPlayer) {
						lb.send(p, {
							message: 'devGain',
							data: {action: 'admin', devNum: devNum},
						});
					}
					else {
						lb.send(p, {
							message: 'devGain',
							data: {devNum: 0},
						});
					}
				}	
			});

			socket.on('chat', function (data) {
				var p = lb.state.getPlayerNum(socket.id);
				socket.broadcast.emit('chatMsg', {message: data.message, author: p});
			});
		});

	},

	utils : {
		// checks if array of objects a contains object b
		objArrContains : function (a, b) {
			for(var i = 0; i < a.length; i++) {
				if(a[i].toString() == b.toString())
					return true;
				}
				return false;
		},

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

		// deduct resources from a given b
		deduct : function (a, b) {
			for(var i = 0; i < b.length; i++) {
				var idx = a.indexOf(b[i]);
				if(idx == -1)
					return false;

				a.splice(idx, 1);
			}
			return a;
		},
	},

	// game-logic
	canBuild : function (build, data) {
		var logic = this;
		var state = logic.state;

		if(build == 'road') {
			var currentRoads = state.getCurrRoads();
			var availableEndPts = currentRoads.map(function (edge, idx) {
				return HexagonGrid.endpoints(edge);
			});
			availableEndPts = [].concat.apply([], availableEndPts);			// flatten array

			var currentSettlements = state.getCurrSettlements();
			var roadEndPts = HexagonGrid.endpoints(data);

			var opponentRoads = state.getOpponentRoads();
			return ((logic.utils.intersectEndPts(availableEndPts, roadEndPts).length > 0 || 
					 logic.utils.intersectEndPts(currentSettlements, roadEndPts).length > 0) 
					&& !logic.utils.objArrContains(opponentRoads, data)
					&& currentRoads.length < 15);
		}
		else if(build == 'settlement') {
			var availableEndPts = state.getCurrRoads().map(function (edge, idx) {
				return HexagonGrid.endpoints(edge);
			});
			var selectedVertex = [data];
			var adjacentVertices = HexagonGrid.adjacent(data);
			var allSettlements = [].concat.apply([], state.getAllSettlements());
			
			var currentSettlements = state.getCurrSettlements();
			var currentCities = state.getCurrCities();
			var currentRound = state.getRound();
			var currentPlayer = state.getCurrentPlayer();

			if( (currentRound < 1 && currentSettlements.length < 1) ||
				(currentRound > 1 && currentRound < 2 && currentSettlements.length < 2) || 
				(currentSettlements.length < 2 && currentPlayer == NUM_PLAYERS - 1))	// last player can place twice
				return !(logic.utils.intersectEndPts(allSettlements, adjacentVertices).length > 0);
			else
				return ((logic.utils.intersectEndPts(availableEndPts, selectedVertex).length > 0) && 
						!(logic.utils.intersectEndPts(allSettlements, adjacentVertices).length > 0) &&
						(currentSettlements.length - currentCities.length) < 5);
		}
		else if(build == 'city') {
			var currentSettlements = state.getCurrSettlements();
			var currentCities = state.getCurrCities();
			return (logic.utils.objArrContains(currentSettlements, [data]) && 
					!logic.utils.objArrContains(currentCities, [data]) &&
					currentCities.length < 4);
		}
		else if(build == 'dev') {
			return (state.getRound() >= 2);	// no free devs
		}
		else
			return false;
	},  

	canAfford : function (type, player_num) {
		var logic = this;
		var state = this.state;

		var hand = state.getCurrHand();
		var currentRound = state.getRound();
		
		if(currentRound < 2) {							// first 2 rounds are freebies
			var currentRoads = state.getCurrRoads();
			var currentPlayer = player_num || state.getCurrentPlayer();
			if(type == 'road') {
				if( (currentRound < 1 && currentRoads.length == 0) ||
					(currentRound > 1 && currentRound < 2 && currentRoads.length <= 1) ||
					(currentRound < 1 && currentRoads.length == 1 && currentPlayer == NUM_PLAYERS -1))
					return hand;
				else
					return false;
			}
			else if(type == 'settlement')
				return hand;
		}

		if(type == 'road') {
			return logic.utils.deduct(hand, [4, 0]);
		}
		else if(type == 'settlement') {
			return logic.utils.deduct(hand, [0, 1, 3, 4]);
		}
		else if(type == 'city') {
			return logic.utils.deduct(hand, [3, 3, 2, 2, 2]);
		}
		else if(type == 'dev') {
			return logic.utils.deduct(hand, [1, 2, 3]);
		}
		return false;
	},

	roll : function () {
		var lb = this;
		var state = lb.state;

		var pSockets = state.getPlayerSockets();
		var dice = [Math.floor(Math.random()*6+1), Math.floor(Math.random()*6+1)];
		var roll = dice[0]+dice[1];
		lb.state.setRoll(roll);
		lb.sendAll({
			message: 'roll', 
			data: { roll: roll },
		});

		// robber baron
		if(roll == 7) {
			// send overflow notices
			state.setBaronState(3);
			var hands = state.getAllHands();
			var overflowPlayers = [];
			for(var p = 0; p < NUM_PLAYERS; p++) {
				if(hands[p].length >= OVERFLOW_HAND_SIZE) {
					lb.send(p, {
						message: 'overflowNotice', 
						data: {baronState: 3},
					});
					overflowPlayers.push(p);
				}
			}

			if(overflowPlayers.length == 0) {	// if no overflows, then we can move on
				// prompt current player to move baron
				state.setBaronState(1);
				lb.send(state.getCurrentPlayer(), {
					message: 'promptBaronMove', 
					data: {baronState: 1},
				});
			}
			else {	// push waits to other players
				state.setOverflowPlayers(overflowPlayers);
				for(var p = 0; p < NUM_PLAYERS; p++) {
					if(overflowPlayers.indexOf(p) == -1) {
						lb.send(p,{
							message: 'overflowWait', 
							data: {baronState: 3, overflowPlayers: overflowPlayers}
						});
					}
				}
			}

		}
		else {	// distribute resources			
			var grid = state.getGrid();
			var resources = [];
			for(var i = 0; i < lb.height; i++) {
				for(var j = 0; j < lb.width; j++) {
					if(grid[i][j].roll == roll && grid[i][j].resource != 5 && !state.isBaron([j, i])) {
							resources.push([j, i, grid[i][j].resource]);
					}
				}
			}
			
			var resource, resourceVertices, cardsAdded = [[],[],[],[]];
			var settlements = state.getAllSettlements();
			var cities = state.getAllCities();
			for(var i = 0; i < resources.length; i++) {
				resource = resources[i][2];
				resourceVertices = HexagonGrid.corners([resources[i][0], resources[i][1]]);

				for(var p = 0; p < NUM_PLAYERS; p++) {
					cardsAdded[p] = cardsAdded[p].concat(lb.utils.intersectEndPts(settlements[p], resourceVertices)
										.map(function () { return resource; }));
					cardsAdded[p] = cardsAdded[p].concat(lb.utils.intersectEndPts(cities[p], resourceVertices)		// add +1 for cities
										.map(function () {return resource;}));
				}
			}
			
			for(var p = 0; p < NUM_PLAYERS; p++) {
				state.giveResources(p, cardsAdded[p]);
				lb.send(p,{
					message: 'gain', 
					data: {
						action: 'roll',
						cardsAdded : cardsAdded[p],
					},
				});
			}
		}
	},

	robbablePlayers : function () {
		var robbableVertices = HexagonGrid.corners(this.state.getBaron());
		var playerHands = this.state.getAllHands();
		var playerSettlements = this.state.getAllSettlements();
		var currentPlayer = this.state.getCurrentPlayer();
		var robbablePlayers = [];

		for(var p = 0; p < NUM_PLAYERS; p++) {
			if( this.utils.intersectEndPts(robbableVertices, playerSettlements[p]).length > 0 &&
				playerHands[p].length > 0 &&
				p != currentPlayer)
				robbablePlayers.push(p);
		}

		return robbablePlayers;
	},

	// returns harbor number to use for exchange
	harborProcess : function (tradeCards, wantCards) {
		var isUniform = function (a) {
			var test = a[0];
			for(var i = 0; i < a.length; i++) {
				if(test != a[0])
					return false;
			}
			return true;
		};

		if(!(isUniform(tradeCards) && isUniform(wantCards)))
			return false;
		var harborAsgn = this.state.getHarborAssignments();
		var harborNum = harborAsgn.indexOf(tradeCards[0]);
		if(harborNum == -1)	// shouldn't ever happen
			return false;

		// Test for 2:1 harbors
		var currentSettlements = this.state.getCurrSettlements();
		var harborVertices = HexagonGrid.endpoints(Globals.getHarborEdge(harborNum));
		var currentPlayer = this.state.getCurrentPlayer();
		if(this.utils.intersectEndPts(harborVertices, currentSettlements).length > 0 && 
			tradeCards.length == 2*wantCards.length) {

			var newCurrHand = this.utils.deduct(this.state.getHand(currentPlayer), tradeCards);
			this.state.setHand(currentPlayer, newCurrHand);
			this.state.giveResources(currentPlayer, wantCards);
			newCurrHand = newCurrHand.concat(wantCards);
			return {
				cardsGain: wantCards,
				hand: newCurrHand,
			};
		}

		// test for 3:1 harbors
		harborVertices = [];
		for(var i = 0; i < harborAsgn.length; i++) {
			if(harborAsgn[i] == -1)
				harborVertices = harborVertices.concat(HexagonGrid.endpoints(Globals.getHarborEdge(i)));
		}
		if(this.utils.intersectEndPts(harborVertices, currentSettlements).length > 0 && 
			tradeCards.length == 3*wantCards.length) {

			var newCurrHand = this.utils.deduct(this.state.getHand(currentPlayer), tradeCards);
			this.state.setHand(currentPlayer, newCurrHand);
			this.state.giveResources(currentPlayer, wantCards);
			newCurrHand = newCurrHand.concat(wantCards);
			return {
				cardsGain: wantCards,
				hand: newCurrHand,
			};
		}

		// test for 4:1 length
		if(tradeCards.length == 4*wantCards.length) {
			var newCurrHand = this.utils.deduct(this.state.getHand(currentPlayer), tradeCards);
			this.state.setHand(currentPlayer, newCurrHand);
			this.state.giveResources(currentPlayer, wantCards);
			newCurrHand = newCurrHand.concat(wantCards);
			return {
				cardsGain: wantCards,
				hand: newCurrHand,
			};
		}

		return false;
	},

	useDev : function (devNum) {
		var currentPlayer = this.state.getCurrentPlayer();
		if(this.state.getActiveDev() == 0 && this.state.activateDev(currentPlayer, devNum)) {
			if(devNum == 1) {			// knight
				this.state.setBaronState(1);
				this.send(currentPlayer, {
					message: 'promptBaronMove', 
					data: {baronState: 1},
				});
			}
			else if(devNum == 2) {		// road building
										// nothing extra to emit
			}
			else if(devNum == 3) {		// year of plenty
				
			}
			else if(devNum == 4) {		// monopoly

			}
			else if(devNum == 5) { // VPs, nothing really to do

			}
			return true;
		}
		return false;
	},

	// lobby-logic
	checkFullLobby : function () {
		var pSockets = this.state.getPlayerSockets();
		var players = [];
		for(var key in pSockets) {
			var val = pSockets[key];
			if(val) players.push(val);
		}
		return players.length == NUM_PLAYERS;
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

exports.LogicalBoard = LogicalBoard;