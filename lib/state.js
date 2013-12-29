// N.B. 'my' references the currentPlayer 
// current player is the only one allowed to invoke logical board actions
// since other players can't do anything off-turn

var State = function () {
    this.grid = [];
    this.baron = [0, 0];
    this.baronState = 0;

    this.round = 0;
    this.currentPlayer = 0;
    this.players = {0:null, 1:null, 2:null, 3:null};
    
    this.settlements = [[],[],[],[]];
    this.cities = [[],[],[],[]];
    this.roads = [[],[],[],[]];
    this.hands = [[],[],[],[]];
    
    this.overflowPlayers = [];
};

State.prototype = {
	getSocket : function (player_num) {
		return this.players[player_num];
	},

	getPlayerSockets : function () {
		return this.players;
	},

	getPlayerNum : function (socket_id) {
		var state = this;
		return Array.apply(null, {length: Object.keys(state.players).length})
			.map(function(el, i) {return state.players[i]})
			.indexOf(socket_id);
	},

	getGrid : function () {
		return this.grid;
	},

	getBaron : function () {
		return this.baron;
	},

	getRound : function () {
		return this.round;
	},

	getCurrentPlayer : function () {
		return this.currentPlayer;
	},

	getMyRoads : function () {
		return this.roads[this.currentPlayer];
	},

	getOpponentRoads : function () {
		var opponentRds = [];
		for(var i = 0; i < this.roads.length; i++) {
			if(i != this.currentPlayer)
				opponentRds = opponentRds.concat(this.roads[i]);
		}
		return opponentRds;
	},

	getMySettlements : function () {
		return this.settlements[this.currentPlayer];
	},

	getAllSettlements : function () {
		return this.settlements;
	},

	getMyCities : function () {
		return this.cities[this.currentPlayer];
	},

	getAllCities : function () {
		return this.cities;
	},

	getMyHand : function () {
		return this.hands[this.currentPlayer];
	},

	getHand : function (player_num) {
		return this.hands[player_num];
	},

	getAllHands : function () {
		return this.hands;
	},

	getOverflowPlayers : function () {
		return this.overflowPlayers;
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
		};
	},

	isMyTurn : function (socket_id) {
		return (this.players[this.currentPlayer] == socket_id);
	},

	isBaronState : function (baronState) {
		return (this.baronState == baronState);
	},

	isBaron : function (baron) {
		return (this.baron[0] == baron[0] && this.baron[1] == baron[1]);
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
};

exports.State = State;