/*
   5 types of resources, 2 tiles
   1 desert

   offset coordinates
*/
var Globals = {
   terrains : [1,2,3,4,5],
   edgeLabels : ['N', 'W', 'S'],
   vertexLabels : ['N', 'S'],
   players : [['red'], ['blue'], ['yellow'], ['white']],
   defaultState : {
	  settlements : [[],[],[],[]],
	  roads : [[],[],[],[]],
	  hands : [[],[],[],[]],
	  baron : null,
	  currentPlayer : 0,
	},
};