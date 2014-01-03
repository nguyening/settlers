var Globals = require('../globals.js').Globals;
var HexagonGrid = require('../hexgrid.js').HexagonGrid;
var Events = require('events');

var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;

var Logic = function (width, height, state, room) {   

	// private inner class Hex
	var Hex = function (_resource, _roll, _x, _y) {
		this.resource = _resource;
		this.roll = _roll;

		this.x = _x;
		this.y = _y;

		this.setRoll = function (_roll) {
			this.roll = _roll;
		};	  
	};

	var utils = {
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
	};

	var canBuild = function (build, data) {
		if(build == 'road') {
			var currentRoads = state.getCurrRoads();
			var availableEndPts = currentRoads.map(function (edge, idx) {
				return HexagonGrid.endpoints(edge);
			});
			availableEndPts = [].concat.apply([], availableEndPts);			// flatten array

			var currentSettlements = state.getCurrSettlements();
			var roadEndPts = HexagonGrid.endpoints(data);

			var opponentRoads = state.getOpponentRoads();
			return ((utils.intersectEndPts(availableEndPts, roadEndPts).length > 0 || 
					 utils.intersectEndPts(currentSettlements, roadEndPts).length > 0) 
					&& !utils.objArrContains(opponentRoads, data)
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
				return !(utils.intersectEndPts(allSettlements, adjacentVertices).length > 0);
			else
				return ((utils.intersectEndPts(availableEndPts, selectedVertex).length > 0) && 
						!(utils.intersectEndPts(allSettlements, adjacentVertices).length > 0) &&
						(currentSettlements.length - currentCities.length) < 5);
		}
		else if(build == 'city') {
			var currentSettlements = state.getCurrSettlements();
			var currentCities = state.getCurrCities();
			return (utils.objArrContains(currentSettlements, [data]) && 
					!utils.objArrContains(currentCities, [data]) &&
					currentCities.length < 4);
		}
		else if(build == 'dev') {
			return (state.getRound() >= 2);	// no free devs
		}
		else
			return false;
	};

	var canAfford = function (type, player_num) {
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
			return utils.deduct(hand, [4, 0]);
		}
		else if(type == 'settlement') {
			return utils.deduct(hand, [0, 1, 3, 4]);
		}
		else if(type == 'city') {
			return utils.deduct(hand, [3, 3, 2, 2, 2]);
		}
		else if(type == 'dev') {
			return utils.deduct(hand, [1, 2, 3]);
		}
		return false;
	};

	var roll = function () {
		var dice = [Math.floor(Math.random()*6+1), Math.floor(Math.random()*6+1)];
		var roll = dice[0]+dice[1];
		state.setRoll(roll);
		room.sendAll({
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
					room.send(p, {
						message: 'overflowNotice', 
						data: {baronState: 3},
					});
					overflowPlayers.push(p);
				}
			}

			if(overflowPlayers.length == 0) {	// if no overflows, then we can move on
				// prompt current player to move baron
				state.setBaronState(1);
				room.send(state.getCurrentPlayer(), {
					message: 'promptBaronMove', 
					data: {baronState: 1},
				});
			}
			else {	// push waits to other players
				state.setOverflowPlayers(overflowPlayers);
				for(var p = 0; p < NUM_PLAYERS; p++) {
					if(overflowPlayers.indexOf(p) == -1) {
						room.send(p,{
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
			for(var i = 0; i < height; i++) {
				for(var j = 0; j < width; j++) {
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
					cardsAdded[p] = cardsAdded[p].concat(utils.intersectEndPts(settlements[p], resourceVertices)
										.map(function () { return resource; }));
					cardsAdded[p] = cardsAdded[p].concat(utils.intersectEndPts(cities[p], resourceVertices)		// add +1 for cities
										.map(function () {return resource;}));
				}
			}
			
			for(var p = 0; p < NUM_PLAYERS; p++) {
				state.giveResources(p, cardsAdded[p]);
				room.send(p,{
					message: 'gain', 
					data: {
						action: 'roll',
						cardsAdded : cardsAdded[p],
					},
				});
			}
		}
	};

	var robbablePlayers = function () {
		var robbableVertices = HexagonGrid.corners(state.getBaron()),
			playerHands = state.getAllHands(),
			playerSettlements = state.getAllSettlements(),
			currentPlayer = state.getCurrentPlayer(),
			robbablePlayers = [];

		for(var p = 0; p < NUM_PLAYERS; p++) {
			if( utils.intersectEndPts(robbableVertices, playerSettlements[p]).length > 0 &&
				playerHands[p].length > 0 &&
				p != currentPlayer)
				robbablePlayers.push(p);
		}

		return robbablePlayers;
	};

	// returns harbor number to use for exchange
	var harborProcess = function (tradeCards, wantCards) {
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
		var harborAsgn = state.getHarborAssignments();
		var harborNum = harborAsgn.indexOf(tradeCards[0]);
		if(harborNum == -1)	// shouldn't ever happen
			return false;

		// Test for 2:1 harbors
		var currentSettlements = state.getCurrSettlements();
		var harborVertices = HexagonGrid.endpoints(Globals.getHarborEdge(harborNum));
		var currentPlayer = state.getCurrentPlayer();
		if(utils.intersectEndPts(harborVertices, currentSettlements).length > 0 && 
			tradeCards.length == 2*wantCards.length) {

			var newCurrHand = utils.deduct(state.getHand(currentPlayer), tradeCards);
			state.setHand(currentPlayer, newCurrHand);
			state.giveResources(currentPlayer, wantCards);
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
		if(utils.intersectEndPts(harborVertices, currentSettlements).length > 0 && 
			tradeCards.length == 3*wantCards.length) {

			var newCurrHand = utils.deduct(state.getHand(currentPlayer), tradeCards);
			state.setHand(currentPlayer, newCurrHand);
			state.giveResources(currentPlayer, wantCards);
			newCurrHand = newCurrHand.concat(wantCards);
			return {
				cardsGain: wantCards,
				hand: newCurrHand,
			};
		}

		// test for 4:1 length
		if(tradeCards.length == 4*wantCards.length) {
			var newCurrHand = utils.deduct(state.getHand(currentPlayer), tradeCards);
			state.setHand(currentPlayer, newCurrHand);
			state.giveResources(currentPlayer, wantCards);
			newCurrHand = newCurrHand.concat(wantCards);
			return {
				cardsGain: wantCards,
				hand: newCurrHand,
			};
		}

		return false;
	};

	var useDev = function (devNum) {
		var currentPlayer = state.getCurrentPlayer();
		if(state.getActiveDev() == 0 && state.activateDev(currentPlayer, devNum)) {
			if(devNum == 1) {			// knight
				state.setBaronState(1);
				send(currentPlayer, {
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
	};


	//************************************************************************
	//  INIT
	//************************************************************************

	this.init = function () {
		var grid = [];
		var terrains = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5];

		// initialize grid with resources
		var row, terrain, idx;
		for(var i = 0; i < height; i++) {
			row = [];
			for(var j = 0; j < width; j++) {
				if(Globals.isUnusedFace([j, i])) {
					row.push(new Hex(0,0));
				}
				else {
					idx = Math.floor(Math.random() * terrains.length);
					row.push(new Hex(terrains[idx], 7));
					if(terrains[idx] == 5) {
						state.placeBaron([j, i]);
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
		state.setHarborAssignments(harborAssignments);

		state.setGrid(grid);
	};
		
	//************************************************************************
	//  EVENT LISTENERS
	//************************************************************************
	this.events = new Events.EventEmitter();

	this.events.on('disconnect', function (data) {
		state.disassociatePlayer(data.invoker.seat);
		room.sendAll({
			type: 'players',
			data: {
				reason: 'DROP',
				players: state.players,
				player_num: data.invoker.seat,
				player: data.invoker.sessid+'@'+data.invoker.socket,
			},
		});
	});

	this.events.on('grabState', function (data) {
		var localState = state.grabLocalState(data.invoker.seat);

		room.send(data.invoker.seat, {
			message: 'state', 
			data: {
				gW: width,
				gH: height,
				state: localState,
			},
		});
	});

	this.events.on('roll', function (data) {
		if(state.getRoll() || !state.isMyTurn(data.invoker.seat))	// no re-rolls
			return;
		roll();
	})

	// Robber baron handlers
	this.events.on('requestBaronMove', function (data) {
		if( !(state.isMyTurn(data.invoker.seat) && 
			state.isBaronState(1) &&
			!state.isBaron(data.coords)) )
			return;

		state.placeBaron(data.coords);
		room.sendAll({
			message: 'moveBaron', 
			data: {coords: data.coords},
		});

		var robbablePlayers = robbablePlayers();
		if(robbablePlayers.length > 0) {
			state.setBaronState(2);
			state.setRobbablePlayers(robbablePlayers);
			room.send(data.invoker.seat, {
				message: 'promptBaronSteal', 
				data: {
					baronState: 2,
					robbable: robbablePlayers,
				},
			});
		}
		else {
			state.setBaronState(0);
			room.send(data.invoker.seat, {
				message: 'baronFinish', 
				data: {baronState: 0},
			});
		}
	});

	this.events.on('requestBaronSteal', function (data) {
		if(!(state.isMyTurn(data.invoker.seat) && state.isBaronState(2)))
			return;

		if(state.isRobbable(data.player_num)) {
			var oppHand = state.getHand(data.player_num),
				myHand = state.getCurrHand();

			var i = Math.floor(Math.random()*oppHand.length),
				resource = oppHand[i];

			myHand.push(oppHand[i]);
			oppHand.splice(i, 1);

			room.send(data.player_num, {
				message: 'deduct', 
				data: {action: 'steal', hand: oppHand},
			});

			room.send(data.invoker.seat, {
				message: 'gain', 
				data: {
					action: 'steal',
					oppPlayer: data.player_num,
					cardsAdded : [resource],
				},
			});

			state.setBaronState(0);
			room.send(data.invoker.seat, {
				message: 'baronFinish', 
				data: {baronState: 0},
			});
		}
	});

	this.events.on('overflowResolve', function (data) {
		if(!state.isBaronState(3))
			return;

		var overflowPlayers = state.getOverflowPlayers(),
			p = data.invoker.seat,
			t;

		if((t=overflowPlayers.indexOf(p)) == -1)	// no need to discard
			return;

		var newHand = utils.deduct(state.getHand(p), data.cardsDiscard);

		if(newHand && data.cardsDiscard.length >= Math.floor(state.getHand(p).length/2)) {
			state.setHand(p, newHand);
			state.removeOverflowPlayer(p);
			overflowPlayers.splice(t, 1);

			room.send(p, {
				message: 'deduct', 
				data: {
					action: 'overflow',
					hand: newHand,
				},
			});
		}
		else 
			return;

		if(!overflowPlayers.length) {	// if there's no more remaining to check, move on
			// prompt current player to move baron
			state.setBaronState(1);
			room.send(state.getCurrentPlayer(), {
				message: 'promptBaronMove', 
				data: {baronState: 1}
			});
		}
		else {
			for(var i = 0; i < NUM_PLAYERS; i++) {
				if(overflowPlayers.indexOf(i) == -1) {
					room.send(i, {
						message: 'overflowWait', 
						data: {
							baronState: 3, 
							overflowPlayers: overflowPlayers
						},
					});
				}
			}
		}
	});

	// Building handler
	this.events.on('buildRequest', function (data) {
		if(!(state.isMyTurn(data.invoker.seat) && (state.getRoll() || state.getRound() < 2)))
			return;

		// check if user can build or can override
		var currentPlayer = state.getCurrentPlayer(),
			buildable = canBuild(data.type, data.coords),
			hand;

		if(data.type == 'road' &&
			buildable && 
			state.getActiveDev() == 2 && 
			state.invokeActiveDev() >= 0) {
				state.addStructure(data);
				room.sendAll({
					message: 'buildAccept', 
					data: {type: data.type, coords: data.coords},
				});
		}
		else if(buildable && (hand=canAfford(data.type))) {
			if(data.type == 'dev') {
				var devNum = state.drawDev();
				if(devNum == 0)	// out of dev cards
					return;

				state.giveDev(currentPlayer, devNum);
				for(var p = 0; p < NUM_PLAYERS; p++) {
					if(p == currentPlayer) {
						state.setHand(currentPlayer, hand);
						room.send(p, {
							message: 'devGain',
							data: {devNum: devNum},
						});
						room.send(data.invoker.seat, {
							message: 'deduct', 
							data: {
								action: 'build',
								hand: hand,
							},
						});	
					}
					else {
						room.send(p, {
							message: 'devGain',
							data: {devNum: 0},
						});
					}
				}
			}
			else {
				state.addStructure(data);
				room.sendAll({
					message: 'buildAccept', 
					data: {type: data.type, coords: data.coords},
				});

				if(state.getRound() >= 2) {
					state.setHand(currentPlayer, hand);
					room.send(data.invoker.seat, {
						message: 'deduct', 
						data: {
							action: 'build',
							hand: hand,
						},
					});	
				}
			}
		}
	});

	// Trading handlers
	// user tries to announce a trade deal
	this.events.on('tradeAnnounceRequest', function (data) {
		if(!state.isMyTurn(data.invoker.seat))
			return;

		var newHand = utils.deduct(state.getCurrHand(), data.tradeCards);

		if(newHand && data.wantCards.length > 0) {
			state.setTradeCards(data.tradeCards);		// store copy of trade for later
			state.setWantCards(data.wantCards);

			room.sendAll({
				message: 'tradeAnnounce',
				data: {
					cardsGain: data.tradeCards,
					cardsDeduct: data.wantCards,
				},
			});
		}
	});

	this.events.on('tradeAnnounceCancel', function (data) {
		if(!(state.isMyTurn(data.invoker.seat) && 
			state.getTradeCards().length > 0 && 
			state.getWantCards().length > 0))
			return;

		state.setTradeCards([]);
		state.setWantCards([]);

		room.sendAll({
			message: 'tradeEnd',
			data: {reason: 'cancel'},
		});
	});

	// user accepts an announced trade deal
	this.events.on('tradeAccept', function (data) {
		var cardsDeduct = state.getTradeCards(),
			cardsGain = state.getWantCards();

		if(!state.isMyTurn(data.invoker.seat) && 			// current player shouldn't accept their own trade
			cardsDeduct.length > 0 && 
			cardsGain.length > 0) {

			var currentPlayer = state.getCurrentPlayer(),
				tradingPlayer = data.invoker.seat,

				newCurrHand = utils.deduct(state.getHand(currentPlayer), cardsDeduct),
				newTradHand = utils.deduct(state.getHand(tradingPlayer), cardsGain);

			if(newCurrHand && newTradHand) {
				state.setHand(currentPlayer, newCurrHand);
				state.setHand(tradingPlayer, newTradHand);
				state.giveResources(currentPlayer, cardsGain);
				state.giveResources(tradingPlayer, cardsDeduct);
				newCurrHand = newCurrHand.concat(cardsGain);
				newTradHand = newTradHand.concat(cardsDeduct);
				
				room.send(currentPlayer, {
					message: 'gain', 
					data: {action: 'trade', cardsAdded: cardsGain},
				});
				room.send(tradingPlayer, {
					message: 'gain', 
					data: {action: 'trade', cardsAdded: cardsDeduct},
				});


				room.send(currentPlayer, {
					message: 'deduct', 
					data: {action: 'trade', hand: newCurrHand},
				});
				room.send(tradingPlayer, {
					message: 'deduct', 
					data: {action: 'trade', hand: newTradHand},
				});

				room.sendAll({
					message: 'tradeEnd',
					data: {reason: 'accept'},
				});

				state.setTradeCards([]);
				state.setWantCards([]);
			}
		}
	});

	this.events.on('exchangeRequest', function (data) {
		var currentPlayer = state.getCurrentPlayer(),
			harborAction;

		if(state.getActiveDev() == 3 &&
			data.wantCards.length == 2 &&
			data.tradeCards.length == 0 &&
			state.invokeActiveDev() >= 0){

				state.giveResources(currentPlayer, data.wantCards);
				room.send(currentPlayer, {
					message: 'gain', 
					data: {action: 'exchange', cardsAdded: data.wantCards},
				});
		}
		else if(utils.deduct(state.getCurrHand(), data.tradeCards) &&
			(harborAction=harborProcess(data.tradeCards, data.wantCards))) {
				room.send(currentPlayer, {
					message: 'gain', 
					data: {action: 'exchange', cardsAdded: harborAction.cardsGain},
				});

				room.send(currentPlayer, {
					message: 'deduct', 
					data: {action: 'exchange', hand: harborAction.hand},
				});
		}
	});

	this.events.on('useDevRequest', function (data) {
		if(state.isMyTurn(data.invoker.seat) && useDev(data.devNum))
			room.sendAll({
				message: 'useDev',
				data: {devNum: data.devNum},
			});
	});

	this.events.on('endTurn', function (data) {
		if(! (state.isMyTurn(data.invoker.seat) && state.isBaronState(0)) )	// don't end while waiting
			return;

		var round = state.getRound();
		state.setRoll(0);		// reset roll
		state.resetActiveDev();

		// player order goes 0,1,2,3,2,1,0 to place settlements and roads
		if(round < 1 && state.getCurrentPlayer() == NUM_PLAYERS - 1)
			round += 1/NUM_PLAYERS;

		round += 1/NUM_PLAYERS;
		state.setRound(round);

		if(round < 1) {
			currentPlayer = (state.getCurrentPlayer()+1) % NUM_PLAYERS;
			state.setCurrentPlayer(currentPlayer);
			room.sendAll({
				message: 'nextTurn', 
				data: {currentPlayer: currentPlayer, round: round}
			});
		}
		else if((1 < round) && (round < 2)) {
			currentPlayer = state.getCurrentPlayer()-1;
			state.setCurrentPlayer(currentPlayer);
			room.sendAll({
				message: 'nextTurn', 
				data: {currentPlayer: currentPlayer, round: round}
			});
		}	
		else if(round == 2) {
			currentPlayer = 0;
			state.setCurrentPlayer(currentPlayer);

			var cardsAdded = [[],[],[],[]],
				settlements = state.getAllSettlements(),
				grid = state.getGrid();

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
				room.send(p, {
					message: 'gain', 
					data: {
						action: 'roll',
						cardsAdded : cardsAdded[p],
					},
				});
			}
			room.sendAll({
				message: 'nextTurn', 
				data: {currentPlayer: currentPlayer, round: round}
			});
		}
		else {
			// normal rounds	
			if(!state.getRoll())	// player has to roll
				return;

			state.flushDevQueue();		
			currentPlayer = (state.getCurrentPlayer()+1) % NUM_PLAYERS;
			state.setCurrentPlayer(currentPlayer);
			room.sendAll({
				message: 'nextTurn', 
				data: {currentPlayer: currentPlayer, round: round}
			});
		}
	});

	// admin/debugging

	this.events.on('giveResource', function (data) {
		if(data.resource >= 5 || data.resource < 0 || !data.resource)	// shouldn't invalid resources
			return;

		var p = data.invoker.seat;

		state.giveResources(p, [data.resource]);
		room.send(p, {
			message: 'gain', 
			data: {
				action: 'admin',
				cardsAdded: [data.resource],
			},
		});
	});

	this.events.on('giveDev', function (data) {
		if(!state.isMyTurn(data.invoker.seat))
			return;

		var currentPlayer = state.getCurrentPlayer(),
			devNum = state.drawDev();

		if(devNum == 0)
			return;

		state.giveDev(currentPlayer, devNum);
		state.flushDevQueue();

		for(var p = 0; p < NUM_PLAYERS; p++) {
			if(p == currentPlayer) {
				room.send(p, {
					message: 'devGain',
					data: {action: 'admin', devNum: devNum},
				});
			}
			else {
				room.send(p, {
					message: 'devGain',
					data: {devNum: 0},
				});
			}
		}	
	});

	this.events.on('chat', function (data) {
		var p = data.invoker.seat;

		room.sendAll({
			message: 'chatMsg',
			data: {message: data.message, author: p},
		});
	});	
		
};

exports.Logic = Logic;