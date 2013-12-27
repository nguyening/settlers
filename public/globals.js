/*
   5 types of resources, 2 tiles
   1 desert

   offset coordinates
*/
var Globals = {
	gridWidth: 6,
	gridHeight: 7,
	terrains : [1,2,3,4,5],
	edgeLabels : ['N', 'W', 'S'],
	vertexLabels : ['N', 'S'],
	playerData : [['red'], ['blue'], ['yellow'], ['white']],
	defaultState : {
		players : {0:null, 1:null, 2:null, 3:null},
		settlements : [[],[],[],[]],
		roads : [[],[],[],[]],
		hands : [[],[],[],[]],
		baron : null,
		currentPlayer : 0,
	},
};