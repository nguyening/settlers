var Globals = function () {};

Globals.isUnusedFace = function (coords) {
    var x = coords[0], y = coords[1];
    return  y == 0 ||                                                                           // top row
            y == this.gridHeight - 1 ||                                                         // bot row
            (y % 2 == 0 && (x == 0 || x == this.gridWidth -1)) ||                               // even row borders
            (y % 2 == 1 && x == this.gridWidth - 1) ||                                          // odd row borders
            ((y == 1 || y == this.gridHeight - 2) && (x == 0 || x == this.gridWidth -2));       // padding for 34543
};

Globals.isUnusedEdge = function (coords) {
    var x = coords[0], y = coords[1], label = coords[2];
    return  (label == 'S' && ((x == 1 && y == 0) || (x == 4 && y == this.gridHeight - 2))) ||   // fudge
            (label == 'N' && ((x == 4 && y == 1) || (x == 1 && y == this.gridHeight - 1))) ||
            (y == 0 && label != 'S') ||                                                         // top row
            (y == this.gridHeight -1 && label != 'N') ||                                        // bot row
            (x == 0 && y != Math.floor(this.gridHeight/2)) ||                                   // left col
            (x == this.gridWidth -1 && (y > this.gridHeight/2 + 1 || y < this.gridHeight/2 - 2)) || // right col
            (x == this.gridWidth -1 && y < this.gridHeight/2 && label == 'N') ||                // NE diag
            (x == this.gridWidth -1 && y > this.gridHeight/2 - 1 && label == 'S');              // SE diag
};

Globals.isUnusedVertex = function (coords) {
    var x = coords[0], y = coords[1], label = coords[2];
    return  (x == 4 && (y == 1 && label == 'N' || y == 5 && label == 'S')) ||                                                   // fudge
            (y == 0 && label == 'N') ||                                                         // top row
            (y == this.gridHeight - 1 && label == 'S') ||                                       // bottom row
            ((x == 0 || x == this.gridWidth - 1) && (y == 0 || y == this.gridHeight -1)) ||     // corners
            (x == this.gridWidth - 1 && y % 2 == 1) ||                                          // far-right
            (y > this.gridHeight/2 && (x == 0 || x > this.gridWidth - 2) && label == 'S') ||    // bottom corners diag
            (y < this.gridHeight/2 - 1 && (x == 0 || x > this.gridWidth - 2) && label == 'N');      // top corners diag
};    

exports.Globals = Globals;