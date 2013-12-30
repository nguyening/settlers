var Globals = function () {};

var gridWidth = 6;
var gridHeight = 7;

var harborEdges = [[1,1,'N'], [3,0,'S'], [4,1,'S'], [5,3,'W'], [4,5,'N'], [3,6,'N'], [1,5,'S'], [1,4,'W'], [1,2,'W']];
Globals.getHarborNum = function (edge) {
    var stringEdge = edge.toString();
    for(var i = 0; i < harborEdges.length; i++) {
        if(stringEdge == harborEdges[i].toString())
            return i;
    }
    return -1;
};

Globals.getHarborEdge = function (harborNum) {
    return harborEdges[harborNum];
};

Globals.isUnusedFace = function (coords) {
    var x = coords[0], y = coords[1];
    return  y == 0 ||                                                                           // top row
            y == gridHeight - 1 ||                                                         // bot row
            (y % 2 == 0 && (x == 0 || x == gridWidth -1)) ||                               // even row borders
            (y % 2 == 1 && x == gridWidth - 1) ||                                          // odd row borders
            ((y == 1 || y == gridHeight - 2) && (x == 0 || x == gridWidth -2));       // padding for 34543
};

Globals.isUnusedEdge = function (coords) {
    var x = coords[0], y = coords[1], label = coords[2];
    return  (label == 'S' && ((x == 1 && y == 0) || (x == 4 && y == gridHeight - 2))) ||   // fudge
            (label == 'N' && ((x == 4 && y == 1) || (x == 1 && y == gridHeight - 1))) ||
            (y == 0 && label != 'S') ||                                                         // top row
            (y == gridHeight -1 && label != 'N') ||                                        // bot row
            (x == 0 && y != Math.floor(gridHeight/2)) ||                                   // left col
            (x == gridWidth -1 && (y > gridHeight/2 + 1 || y < gridHeight/2 - 2)) || // right col
            (x == gridWidth -1 && y < gridHeight/2 && label == 'N') ||                // NE diag
            (x == gridWidth -1 && y > gridHeight/2 - 1 && label == 'S');              // SE diag
};

Globals.isUnusedVertex = function (coords) {
    var x = coords[0], y = coords[1], label = coords[2];
    return  (x == 4 && (y == 1 && label == 'N' || y == 5 && label == 'S')) ||                                                   // fudge
            (y == 0 && label == 'N') ||                                                         // top row
            (y == gridHeight - 1 && label == 'S') ||                                       // bottom row
            ((x == 0 || x == gridWidth - 1) && (y == 0 || y == gridHeight -1)) ||     // corners
            (x == gridWidth - 1 && y % 2 == 1) ||                                          // far-right
            (y > gridHeight/2 && (x == 0 || x > gridWidth - 2) && label == 'S') ||    // bottom corners diag
            (y < gridHeight/2 - 1 && (x == 0 || x > gridWidth - 2) && label == 'N');      // top corners diag
};    

exports.Globals = Globals;