var State = function () {
    this.grid = [];
    this.baron = [0, 0];
    this.baronState = 0;

    this.round = 0;
    this.player_num = -1;
    this.currentPlayer = 0;
    this.players = {0:null, 1:null, 2:null, 3:null};
    
    this.settlements = [[],[],[],[]];
    this.cities = [[],[],[],[]];
    this.roads = [[],[],[],[]];
    this.hands = [[],[],[],[]];
    
    this.overflowPlayers = [];

    this.tradeCards = [];
    this.wantCards = [];

    this.robbablePlayers = [];
};

State.prototype = {
	getSocket : function (player_num) {
		return this.players[player_num];
	},

	getPlayerSockets : function () {	// shouldn't have to slice 
		return this.players;
	},

	getPlayerNum : function (socket_id) {
		var state = this;
		return Array.apply(null, {length: Object.keys(state.players).length})
			.map(function(el, i) {return state.players[i]})
			.indexOf(socket_id);
	},

	getMyNum : function () {
		return this.player_num;
	},

	getGrid : function () {	// shouldn't have to slice since only needed for rolling
		return this.grid;
	},

	getBaron : function () {
		return this.baron.slice();
	},

	getRound : function () {
		return this.round;
	},

	getCurrentPlayer : function () {
		return this.currentPlayer;
	},

	getCurrRoads : function () {
		return this.roads[this.currentPlayer].slice();
	},

	getOpponentRoads : function () {
		var opponentRds = [];
		for(var i = 0; i < this.roads.length; i++) {
			if(i != this.currentPlayer)
				opponentRds = opponentRds.concat(this.roads[i]);
		}
		return opponentRds;
	},

	getCurrSettlements : function () {
		return this.settlements[this.currentPlayer].slice();
	},

	getAllSettlements : function () {
		return this.settlements.slice();
	},

	getCurrCities : function () {
		return this.cities[this.currentPlayer].slice();
	},

	getAllCities : function () {
		return this.cities.slice();
	},

	getCurrHand : function () {
		return this.hands[this.currentPlayer].slice();
	},

	getMyHand : function () {
		return this.hands[this.player_num].slice();
	},

	getHand : function (player_num) {
		return this.hands[player_num].slice();
	},

	getAllHands : function () {
		return this.hands;
	},

	getOverflowPlayers : function () {
		return this.overflowPlayers;
	},

	getTradeCards : function () {
		return this.tradeCards.slice();
	},

	getWantCards : function () {
		return this.wantCards.slice();
	},

	associatePlayer : function (player_num, socket_id) {
		this.players[player_num] = socket_id;	
	},

	setGrid : function (grid) {
		this.grid = grid;
	},

	setBaronState : function (baronState) {
		this.baronState = baronState;
	},

	placeBaron : function (coords) {
		this.baron = coords;
	},

	setRound : function (nextRound) {
		this.round = nextRound;
	},

	setCurrentPlayer : function (player_num) {
		this.currentPlayer = player_num;	
	},

	giveResources : function (player_num, resources) {
		this.hands[player_num] = this.hands[player_num].concat(resources);
	},

	setHand : function (player_num, newHand) {
		this.hands[player_num] = newHand;	
	},

	setOverflowPlayers : function (players) {
		this.overflowPlayers = players;
	},

	removeOverflowPlayer : function (player_num) {
		this.overflowPlayers.splice(this.overflowPlayers.indexOf(player_num), 1);
	},

	grabLocalState : function (player_num) {
		var localHands = [];
		for(var p = 0; p < Object.keys(this.players).length; p++) {
			if(p == player_num)
				localHands.push(this.hands[p]);
			else
				localHands.push([]);
		}

		return {
		    grid : this.grid,
		    players : this.players,
		    round : this.round,
		    settlements : this.settlements,
		    cities : this.cities,
		    roads : this.roads,
		    hands : localHands,
		    baron : this.baron,
		    baronState : this.baronState,
		    currentPlayer : this.currentPlayer,
		    overflowPlayers : this.overflowPlayers,
		    player_num : player_num,
		};
	},

	isMyTurn : function (socket_id) {
		if(socket_id)
			return (this.players[this.currentPlayer] == socket_id);
		return this.currentPlayer == this.player_num;
	},

	isBaronState : function (baronState) {
		return (this.baronState == baronState);
	},

	isBaron : function (baron) {
		return (this.baron[0] == baron[0] && this.baron[1] == baron[1]);
	},

	isRobbable : function (player_num) {
		return (this.robbablePlayers.indexOf(player_num) != -1);
	},

	addStructure : function (structure) {
		if(structure.type == 'road') {
			this.roads[this.currentPlayer].push(structure.coords);
		}
		else if(structure.type == 'settlement') {
			this.settlements[this.currentPlayer].push(structure.coords);
		}
		else if(structure.type == 'city') {
			this.cities[this.currentPlayer].push(structure.coords);
		}		
	},

	setTradeCards : function (cards) {
		this.tradeCards = cards;
	},

	setWantCards : function (cards) {
		this.wantCards = cards;
	},

	setRobbablePlayers : function (players) {
		this.robbablePlayers = players;
	},

	initializeLocalState : function (localState) {
		this.player_num = localState.player_num;

	    this.grid = localState.grid;
	    this.baron = localState.baron;
	    this.baronState = localState.baronState;

	    this.round = localState.round;
	    this.currentPlayer = localState.currentPlayer;
	    this.players = localState.players;
	    
	    this.settlements = localState.settlements;
	    this.cities = localState.cities;
	    this.roads = localState.roads;
	    this.hands = localState.hands;
	    
	    this.overflowPlayers = localState.overflowPlayers;
	},
};

exports.State = State;