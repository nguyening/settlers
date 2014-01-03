var State = function () {
    this.grid = [];
    this.harborAssignments = [];
    this.baron = [0, 0];
    this.baronState = 0;

    this.round = 0;
    this.roll = 0;
    this.player_num = -1;
    this.currentPlayer = 0;
    this.players = {0:null, 1:null, 2:null, 3:null};
    
    this.settlements = [[],[],[],[]];
    this.cities = [[],[],[],[]];
    this.roads = [[],[],[],[]];
    this.hands = [[],[],[],[]];
    this.devs = [[],[],[],[]];
    
    this.overflowPlayers = [];

    this.tradeCards = [];
    this.wantCards = [];

    this.robbablePlayers = [];

    this.devDeck = [].concat(Array.apply(null, {length:14}).map(function(){return 1;}),
	    Array.apply(null, {length:2}).map(function(){return 2;}),
	    Array.apply(null, {length:2}).map(function(){return 3;}),
	    // Array.apply(null, {length:2}).map(function(){return 4;}),
	    Array.apply(null, {length:5}).map(function(){return 5;}))
    	.sort(function(){return 0.5 - Math.random()});

    this.devQueue = [];

    this.activeDev = 0;
    this.devInvokes = 0;
};

State.prototype = {
	getFullState : function () {
		return {
		    harborAssignments : this.harborAssignments,
		    baron : this.baron,
		    baronState : this.baronState,
		    round : this.round,
		    roll : this.roll,
		    player_num : this.player_num,
		    currentPlayer : this.currentPlayer,
		    players : this.players,
		    settlements : this.settlements,
		    cities : this.cities,
		    roads : this.roads,
		    hands : this.hands,
		    devs : this.devs,
		    overflowPlayers : this.overflowPlayers,
		    tradeCards : this.tradeCards,
		    wantCards : this.wantCards,
		    robbablePlayers : this.robbablePlayers,
		    devDeck : this.devDeck,
		    devQueue : this.devQueue,
		    activeDev : this.activeDev,
		    devInvokes : this.devInvokes,
		};
	},

	getSocket : function (p) {
		return this.players[p].socket;
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

	getCurrDev : function () {
		return this.devs[this.currentPlayer].slice();
	},

	getMyHand : function () {
		return this.hands[this.player_num].slice();
	},

	getMyDev : function () {
		return this.devs[this.player_num].slice();
	},

	getHand : function (player_num) {
		return this.hands[player_num].slice();
	},

	getDev : function (player_num) {
		return this.devs[player_num].slice();
	},

	getDevQueue : function () {
		return this.devQueue.slice();
	},

	getAllHands : function () {
		return this.hands;
	},

	// getAllDevs : function () {
	// 	return this.devs;	
	// },

	getRoll : function () {
		return this.roll;
	},

	getOverflowPlayers : function () {
		return this.overflowPlayers.slice();
	},

	getTradeCards : function () {
		return this.tradeCards.slice();
	},

	getWantCards : function () {
		return this.wantCards.slice();
	},

	getHarborAssignments : function () {
		return this.harborAssignments.slice();
	},

	getActiveDev : function () {
		return this.activeDev;
	},

	resetActiveDev : function () {
		this.activeDev = 0;
		this.devInvokes = 0;
	},

	invokeActiveDev : function () {
		return --this.devInvokes;
	},

	setHarborAssignments : function (harbors) {
		this.harborAssignments = harbors;
	},

	associatePlayer : function (p, uid, socket) {
		this.players[p] = {
			uid: uid,
			socket: socket,
			active: 1,
		};
	},

	disassociatePlayer : function (p) {
		this.players[p].active = 0;	
	},

	setGrid : function (grid) {
		this.grid = grid;
	},

	setRoll : function (roll) {
		this.roll = roll;
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

	giveDev : function (player_num, devNum) {
		this.devQueue = this.devQueue.concat(devNum);
	},

	flushDevQueue : function () {
		this.devs[this.currentPlayer] = this.devs[this.currentPlayer].concat(this.devQueue);
		this.devQueue = [];
	},

	activateDev : function (player_num, devNum, revealNum) {
		if(devNum == 0 && typeof revealNum != 'undefined') { // if this is local, reveal the activated dev
			for(var i = 0; i < this.devs[player_num].length; i++) {
				if(this.devs[player_num][i] == 0) {
					this.devs[player_num][i] = -revealNum;
					return true;
				}
			}
			return false;
		}

		var i = this.devs[player_num].indexOf(devNum);
		if(i == -1)
			return false;

		this.devs[player_num][i] *= -1;
		this.activeDev = devNum;
		if(devNum == 1) {			// knight
			this.devInvokes = 0;
		}
		else if(devNum == 2) {		// road building
			this.devInvokes = 2;
		}
		else if(devNum == 3) {		// year of plenty
			this.devInvokes = 1;
		}
		else if(devNum == 4) {		// monopoly
			this.devInvokes = 0;
		}
		else if(devNum == 5) { 
			this.devInvokes = 0;
		}
		return true;
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

	drawDev : function () {
		if(this.devDeck.length == 0)
			return 0;
		var i = Math.floor(Math.random()*this.devDeck.length);
		return this.devDeck.splice(i, 1)[0];
	},

	grabLocalState : function (player_num) {
		var localHands = [];
		var localDevs = [];
		for(var p = 0; p < Object.keys(this.players).length; p++) {
			if(p == player_num) {
				localHands.push(this.hands[p]);
				localDevs.push(this.devs[p]);
			}
			else {
				localHands.push([]);
				var temp = [], val;
				for(var i = 0; i < this.devs[p].length; i++) {
					val = this.devs[p][i];
					if(val < 0)	// active devs
						temp.push(val);
					else
						temp.push(0);
				}
				localDevs.push(temp);
			}
		}

		var localDevQueue;
		if(player_num == this.currentPlayer)
			localDevQueue = this.devQueue;
		else
			localDevQueue = Array.apply(null, {length: this.devQueue.length}).map(function () {return 0;});

		return {
		    grid : this.grid,
		    harborAssignments : this.harborAssignments,
		    players : this.players,
		    round : this.round,
		    settlements : this.settlements,
		    cities : this.cities,
		    roads : this.roads,
		    hands : localHands,
		    devs : localDevs,
		    baron : this.baron,
		    baronState : this.baronState,
		    currentPlayer : this.currentPlayer,
		    overflowPlayers : this.overflowPlayers,
		    player_num : player_num,
		    tradeCards : this.tradeCards,
		    wantCards : this.wantCards,
		    devQueue : localDevQueue,
		    roll: this.roll,
		    robbablePlayers: this.robbablePlayers,
		    activeDev : this.activeDev,
		    devInvokes : this.devInvokes,

		};
	},

	isMyTurn : function (seat) {
		if(seat)
			return (this.currentPlayer == seat);
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
	    this.harborAssignments = localState.harborAssignments;
	    this.baron = localState.baron;
	    this.baronState = localState.baronState;

	    this.round = localState.round;
	    this.currentPlayer = localState.currentPlayer;
	    this.players = localState.players;
	    
	    this.settlements = localState.settlements;
	    this.cities = localState.cities;
	    this.roads = localState.roads;
	    this.hands = localState.hands;
	    this.devs = localState.devs;
	    
	    this.overflowPlayers = localState.overflowPlayers;

	    if(localState.player_num != this.currentPlayer) {
	    	this.tradeCards = localState.tradeCards;
	    	this.wantCards = localState.wantCards;
	    }
	    else {									// announced trade
	        this.tradeCards = localState.wantCards;
		    this.wantCards = localState.tradeCards;
	    }

	    this.devQueue = localState.devQueue;
	    this.roll = localState.roll;
	    this.robbablePlayers = localState.robbablePlayers;
	    this.activeDev = localState.activeDev;
	    this.devInvokes = localState.devInvokes;
	},
};

exports.State = State;