var HexagonGrid = {
	// coordinate conventions
	edgeLabels : function() { return ['N', 'W', 'S']; }(),
	vertexLabels : function() { return ['N', 'S']; }(),
	
	// relations
	// based on those presented in http://www-cs-students.stanford.edu/~amitp/game-programming/grids/
	edges : function (_x, _y) {
	  return [
	     [_x, _y, 'N'],
	     [_x, _y, 'W'],
	     [_x, _y, 'S'],
	  ];
	},

	vertices : function (_x, _y) {
	  return [
	     [_x, _y, 'N'],
	     [_x, _y, 'S'],
	  ];
	},

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
};

exports.HexagonGrid = HexagonGrid;