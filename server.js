// require
var Globals = require('./globals.js').Globals;
var jade = require('jade');
var express = require('express'), app = express();
var http = require('http'), 
	server = http.createServer(app), 
	io = require('socket.io').listen(server);

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
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

	this.state = JSON.parse(JSON.stringify(Globals.defaultState));	// clone object


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

					terrains.splice(idx, 1);
				}
			}

			this.state.grid.push(row);
		}
		
		// assign rolls in spiral
		var ordering = [[0,3],[1,2],[1,1],[2,1],[3,1],[4,2],[4,3],[4,4],[3,5],
					[2,5],[1,5],[1,4],[1,3],[2,2],[3,2],[3,3],[3,4],[2,4],[2,3]];
		var rolls = Globals.rolls;
		var order, hex;
		for(var i = 0; i < ordering.length; i++) {
			order = ordering[i];
			hex = this.state.grid[order[1]][order[0]];
			if(hex.resource != 5) {
				hex.setRoll(rolls[0]);
				rolls.splice(0, 1);
			}
		}
	},

	getHex : function (_x, _y) {
	  return this.state.grid[_y][_x];
	},

	getHexEdges : function (_x, _y) {
	  return [
	     [_x, _y, 'N'],
	     [_x, _y, 'W'],
	     [_x, _y, 'S'],
	  ];
	},

	getHexVertices : function (_x, _y) {
	  return [
	     [_x, _y, 'N'],
	     [_x, _y, 'S'],
	  ];
	},

	// relations
	// based on those presented in http://www-cs-students.stanford.edu/~amitp/game-programming/grids/
	neighbors : function (face) {
	  var x = face[0], y = face[1];
	  if(y % 2 == 0) {
	     return [
	        [x, y+1],
	        [x, y-1],
	        [x-1, y],
	        [x+1, y],
	        [x-1, y+1],
	        [x-1, y-1],
	     ];
	  }
	  else {
	     return [
	        [x, y+1],
	        [x, y-1],
	        [x-1, y],
	        [x+1, y],
	        [x+1, y+1],
	        [x+1, y-1],
	     ];
	  }
	},

	borders : function (face) {
	  var x = face[0], y = face[1];
	  if(y % 2 == 0) {
	     return [
	        [x, y, 'N'],
	        [x, y, 'W'],
	        [x, y, 'S'],
	        [x, y-1, 'S'],
	        [x+1, y, 'W'],
	        [x, y+1, 'N'],
	     ];
	  }
	  else {
	     return [
	        [x, y, 'N'],
	        [x, y, 'W'],
	        [x, y, 'S'],
	        [x+1, y-1, 'S'],
	        [x+1, y, 'W'],
	        [x+1, y+1, 'N'],
	     ];
	  }      
	},

	corners : function (face) {
	  var x = face[0], y = face[1];
	  if(y % 2 == 0) {
	     return [
	        [x, y, 'N'],
	        [x, y, 'S'],
	        [x, y-1, 'S'],
	        [x, y+1, 'N'],
	        [x-1, y-1, 'S'],
	        [x-1, y+1, 'N'],
	     ];
	  }
	  else {
	     return [
	        [x, y, 'N'],
	        [x, y, 'S'],
	        [x-1, y-1, 'S'],
	        [x-1, y+1, 'N'],
	        [x+1, y-1, 'S'],
	        [x+1, y+1, 'N'],
	     ];
	  }     
	},

	endpoints : function (edge) {
	  var x = edge[0], y = edge[1], label = edge[2];
	  if(label == 'N') {
	     if(y % 2 == 0) 
	        return [[x, y, 'N'], [x-1, y-1, 'S']];
	     else
	        return [[x, y, 'N'], [x, y-1, 'S']];
	  }
	  else if(label == 'W') {
	     if(y % 2 == 0) 
	        return [[x-1, y+1, 'N'], [x-1, y-1, 'S']];
	     else
	        return [[x, y+1, 'N'], [x, y-1, 'S']];
	  }
	  else if(label == 'S') {
	     if(y % 2 == 0) 
	        return [[x, y, 'S'], [x-1, y+1, 'N']];
	     else
	        return [[x, y, 'S'], [x, y+1, 'N']];
	  }

	  return false;
	},

	touches : function (vertex) {
	  var x = vertex[0], y = vertex[1], label = vertex[2];
	  if(label == 'N') {
	     if(y % 2 == 0)
	        return [[x, y], [x-1, y-1], [x, y-1]];
	     else
	        return [[x, y], [x, y-1], [x+1, y-1]];
	  }
	  else if(label == 'S') {
	     if(y % 2 == 0)
	        return [[x, y], [x-1, y+1], [x, y+1]];
	     else
	        return [[x, y], [x, y+1], [x+1, y+1]];
	  }

	 return false; 
	},

	protrudes : function (vertex) {
	  var x = vertex[0], y = vertex[1], label = vertex[2];
	  if(label == 'N') {
	     if(y % 2 == 0) {
	        return [
	           [x, y, 'N'],
	           [x, y-1, 'W'],
	           [x, y-1, 'S'],
	        ];
	     }
	     else {
	        return [
	           [x, y, 'N'],
	           [x+1, y-1, 'W'],
	           [x+1, y-1, 'S'],
	        ];
	     }
	  }
	  else if(label == 'S') {
	     if(y % 2 == 0) {
	        return [
	           [x, y, 'S'],
	           [x, y+1, 'W'],
	           [x, y+1, 'N'],
	        ];
	     }
	     else {
	        return [
	           [x, y, 'S'],
	           [x+1, y+1, 'W'],
	           [x+1, y+1, 'N'],
	        ];
	     }
	  }      
	},

	adjacent : function (vertex) {
	  var x = vertex[0], y = vertex[1], label = vertex[2];
	  if(label == 'N') {
	     if(y % 2 == 0) {
	        return [
	           [x, y-2, 'S'],
	           [x-1, y-1, 'S'],
	           [x, y-1, 'S'],
	        ];
	     }
	     else {
	        return [
	           [x, y-2, 'S'],
	           [x, y-1, 'S'],
	           [x+1, y-1, 'S'],
	        ];
	     }
	  }
	  else if(label == 'S') {
	     if(y % 2 == 0) {
	        return [
	           [x, y+2, 'N'],
	           [x-1, y+1, 'N'],
	           [x, y+1, 'N'],
	        ];
	     }
	     else {
	        return [
	           [x, y+2, 'N'],
	           [x, y+1, 'N'],
	           [x+1, y+1, 'N'],
	        ];
	     }
	  }        
	},

	// game-logic

	canBuild : function (build, data) {
	  if(data == null)
	     return false;

	  var logic = this;
	  var state = logic.state;

	  // check if two arrays have intersecting coordinates
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

	  // checks if array of objects a contains object b
	  var objArrContains = function (a, b) {
	  	for(var i = 0; i < a.length; i++) {
	  		// console.log(a[i]);
	  		// console.log(b);
	  		if(a[i].toString() == b.toString())
	  			return true;
	  	}
	  	return false;
	  }
	  
	  if(build == 'road') {
	  	 var opponentRds = [];
	  	 for(var i = 0; i < Globals.playerData.length; i++) {
	  	 	if(i != state.currentPlayer)
	  	 		opponentRds = opponentRds.concat(state.roads[i]);
	  	 }

	     var availableEndPts = [].concat.apply([], state.roads[state.currentPlayer].map(function (edge, idx) {
	        return logic.endpoints(edge);
	     }));
	     var currentSettlements = state.settlements[state.currentPlayer];
	     var roadEndPts = this.endpoints(data);
	     // console.log(objArrContains(opponentRds, data));

	     return ((intersectEndPts(availableEndPts, roadEndPts) || intersectEndPts(currentSettlements, roadEndPts)) && !objArrContains(opponentRds, data));
	  }
	  else if(build == 'settlement') {
	     var availableEndPts = state.roads[state.currentPlayer].map(function (edge, idx) {
	        return logic.endpoints(edge);
	     });
	     var selectedVertex = [data];

	     var adjacentVertices = this.adjacent(data);

	     var currentSettlements = [].concat.apply([], state.settlements);
	     return (intersectEndPts(availableEndPts, selectedVertex) && !intersectEndPts(currentSettlements, adjacentVertices));
	  }
	  else if(build == 'city') {
			var currentSettlements = state.settlements[state.currentPlayer];
			var currentCities = state.cities[state.currentPlayer];
			return intersectEndPts(currentSettlements, [data]) && !intersectEndPts(currentCities, [data]);
	  }
	  else
	     return false;
	},  

	roll : function () {
		var lb = this;
		var distributeResources = function (roll) {
			var calcIntersectEndPts = function (a, b) {
				var t, res = [];
				if(a.length < b.length) {
					t = a;
					a = b;
					b = t;
				}

				a_vertices = a.toString();
				for(var i = 0; i < b.length; i++) {
					b_vertex = b[i].toString();
					if(a_vertices.indexOf(b_vertex) != -1)
					   res.push(b[i]);
				}
				return res;
			};

			var resources = [];
			for(var i = 0; i < lb.height; i++) {
				for(var j = 0; j < lb.width; j++) {
					if(lb.state.grid[i][j].roll == roll) {
						if(lb.state.grid[i][j].resource != 5) 
							resources.push([j, i, lb.state.grid[i][j].resource]);
						// else {}
							// baron stuff here
					}
				}
			}
			
			var resource, resourceVertices, cardsAdded = Globals.defaultState.hands.slice(0); // copy by value, JS ref trouble again!
			var state = lb.state;
			for(var i = 0; i < resources.length; i++) {
				resource = resources[i][2];
				resourceVertices = lb.corners([resources[i][0], resources[i][1]]);

				for(var p = 0; p < Globals.playerData.length; p++) {
					cardsAdded[p] = cardsAdded[p].concat(calcIntersectEndPts(state.settlements[p], resourceVertices)
										.map(function () { return resource; })
										.concat(calcIntersectEndPts(state.cities[p], resourceVertices).map(function () {return resource;})));
				}
			}
			
			for(var p = 0; p < Globals.playerData.length; p++) {
				lb.state.hands[p] = lb.state.hands[p].concat(cardsAdded[p]);
			}
			io.sockets.emit('distributeResources', { cardsAdded : cardsAdded, hands : lb.state.hands });
		};

		var dice = [Math.floor(Math.random()*6+1), Math.floor(Math.random()*6+1)];
		io.sockets.emit('roll', { roll: dice[0]+dice[1] });
		distributeResources(dice[0]+dice[1]);
	},

	// lobby-logic
	checkFullLobby : function () {
		var players = [];
		for(var key in this.state.players) {
			var val = this.state.players[key];
			if(val) players.push(val);
		}
		return players.length == Globals.playerData.length;
	},

	addPlayer : function (sessId) {
		// put player in first free slot
		for(var key in this.state.players) {
			if(!this.state.players[key]) {
				this.state.players[key] = sessId;
				return key;
			}
		}
	},

	removePlayer : function (sessId) {
		for(var key in this.state.players) {
			if(this.state.players[key] == sessId) {
				this.state.players[key] = null;
				return key;
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
			players: lb.state.players,
		});
	});

	socket.on('grabState', function (data) {
		if(!lb.checkFullLobby()) {
			var pnum = lb.addPlayer(socket.id);
			socket.broadcast.emit('players', {
				reason: 'NEW',
				player: socket.id,
				player_num: pnum,
				players: lb.state.players,
			});
		}

		socket.emit('state', {
			gW: lb.width,
			gH: lb.height,
			state: lb.state,
			sessid: socket.id,
		});
	});

	socket.on('buildRequest', function (data) {
		// make sure request is during this user's turn
		if(socket.id != lb.state.players[lb.state.currentPlayer])
			return;

		// check if user can build or can override
		if(lb.canBuild(data.type, data.coords) || data.override == true) {
			if(data.type == 'road') {
				lb.state.roads[lb.state.currentPlayer].push(data.coords);
			}
			else if(data.type == 'settlement') {
				lb.state.settlements[lb.state.currentPlayer].push(data.coords);
			}
			else if(data.type == 'city') {
				lb.state.cities[lb.state.currentPlayer].push(data.coords);
			}

			io.sockets.emit('buildAccept', {	// send to all clients
				type: data.type,
				coords: data.coords
			});
		}
	});

	socket.on('endTurn', function (data) {
		if(socket.id != lb.state.players[lb.state.currentPlayer])
			return;
		lb.state.currentPlayer = ++lb.state.currentPlayer % Globals.playerData.length;
		io.sockets.emit('nextTurn', {currentPlayer: lb.state.currentPlayer});
		lb.roll();
	});
});

