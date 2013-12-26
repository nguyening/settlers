/*
   5 types of resources, 2 tiles
   1 desert

   offset coordinates
*/
var Globals = {
   terrains : [1,2,3,4,5],
   edgeLabels : ['N', 'W', 'S'],
   vertexLabels : ['N', 'S'],
};


var LogicalBoard = function (_width, _height) {   

   this.width = _width;
   this.height = _height;

   this.state = {
      settlements : [[],[],[],[]],
      roads : [[],[],[],[]],
      hands : [[],[],[],[]],
      baron : null,
      currentPlayer : 0,
   };


   this.Hex = function (_resource, _roll, _x, _y) {
      this.resource = _resource;
      this.roll = _roll;

      this.x = _x;
      this.y = _y;
   };

   this.Hex.prototype = {
      getResource : function () {
         return this.resource;
      },
      getRoll : function() {
         return this.roll;
      }
   };

   this.init.apply(this, arguments);
};

LogicalBoard.prototype = {
   init : function (width, height) {
      var row, terrain;
      for(i = 0; i < height; i++) {
         row = [];
         for(j = 0; j < width; j++) {
            terrain = Math.floor(Math.random() * Globals.terrains.length);
            row.push(new this.Hex(terrain, j+i));
         }

         this.grid.push(row);
      }      
   },

   getHex : function (_x, _y) {
      return this.grid[_y][_x];
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
            [x-1, y-1, 'S'],
            [x-1, y+1, 'N'],
            [x+1, y-1, 'S'],
            [x+1, y+1, 'N'],
         ];
      }
      else {
         return [
            [x, y, 'N'],
            [x, y, 'S'],
            [x, y-1, 'S'],
            [x, y+1, 'N'],
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

      var intersectEndPts = function (a, b) {
         var t;
         if(a.length < b.length) {
            t = a;
            a = b;
            b = t;
         }

         a_vertices = a.toString();
         for(i = 0; i < b.length; i++) {
            b_vertex = b[i].toString();
            if(a_vertices.indexOf(b_vertex) > -1)
               return true;
         }
         return false;
      };

      if(build == 'road') {
         var availableEndPts = $.map(state.roads[state.currentPlayer], function (edge, idx) {
            return logic.endpoints(edge);
         });
         var roadEndPts = this.endpoints(data);
         return intersectEndPts(availableEndPts, roadEndPts);
      }
      else if(build == 'settlement') {
         var availableEndPts = $.map(state.roads[state.currentPlayer], function (edge, idx) {
            return logic.endpoints(edge);
         });
         var selectedVertex = [data];

         var adjacentVertices = this.adjacent(data);

         var currentSettlements = [].concat.apply([], state.settlements);
         return (intersectEndPts(availableEndPts, selectedVertex) && !intersectEndPts(currentSettlements, adjacentVertices));
      }
      else
         return false;
   },   
}

var GraphicalBoard = function (_width, _height) {
   this.grid = [];

   this.gridWidth = _width;
   this.gridHeight = _height;
   this.canvasWidth = 1000;
   this.canvasHeight = 1000;
   this.canvasOffsetX = -100;
   this.canvasOffsetY = -100;

   this.hexRadius = 50;
   this.hexWidth = 2*this.hexRadius*Math.cos(30 * Math.PI / 180);
   this.hexHeight = this.hexRadius*1.5;
   this.hexEdgeThickness = 2;
   this.hexVertexRadius = 10;

   this.stage = new Kinetic.Stage({
      container: 'container',
      width: this.canvasWidth,
      height: this.canvasHeight
   });

   this.hexLayer = new Kinetic.Layer({
      offsetX: this.canvasOffsetX,
      offsetY: this.canvasOffsetY
   });
   this.edgeLayer = new Kinetic.Layer({
      offsetX: this.canvasOffsetX,
      offsetY: this.canvasOffsetY
   });
   this.vertexLayer = new Kinetic.Layer({
      offsetX: this.canvasOffsetX,
      offsetY: this.canvasOffsetY
   });
   
   this.init.apply(this);
};

GraphicalBoard.prototype = {
   init : function () {
      var gridObject;
      var hex, line, circle, edge_vertices, edge;
      var _x, _y, x_offset, y_offset;

      var gb = this;
      var hexRadius = this.hexRadius;
      var hexWidth = this.hexWidth;
      var hexHeight = this.hexHeight;
      var hexEdgeThickness = this.hexEdgeThickness;
      var hexVertexRadius = this.hexVertexRadius;
      var row;

      for(i = 0; i < this.gridHeight; i++) {
         row = [];
         for(j = 0; j < this.gridWidth; j++) {
            gridObject = {
               face : null,
               edges : [],
               vertices : [],
            };
            _x = (2 * j + 1 + (i&1)) * (hexWidth/2); // offset by one if odd row
            _y = (2 * i + 1) * (hexHeight/2);


            // Draw hexagon face
            hex = new Kinetic.RegularPolygon({
               x: _x,
               y: _y,
               sides: 6,
               radius: hexRadius,
               fill: 'green',
            });

            gridObject.face = hex;
            this.hexLayer.add(hex);

            var text = new Kinetic.Text({
               x: _x,
               y: _y,
               text: j + ', ' + i,
               fontSize: 12,
               fontFamily: 'Calibri',
               fill: 'black',
            });
            this.hexLayer.add(text);

            // Drawing hexagon edges (N, W, S)
            x_offset = hexRadius * Math.cos(30 * Math.PI / 180);
            y_offset = hexRadius * 0.5;

            edge_vertices = [
               [_x, _y - hexRadius],
               [_x - x_offset, _y - y_offset],
               [_x - x_offset, _y + y_offset],
               [_x, _y + hexRadius]
            ];

            for(k = 0; k < edge_vertices.length - 1; k++) {
               edge = [edge_vertices[k], edge_vertices[k+1]];
               line = new Kinetic.Line({
                  points: edge,
                  stroke: 'black',
                  strokeWidth: hexEdgeThickness,
                  drawHitFunc: function (context) {
                     // kineticjs doesn't like lines for hit functions?
                     var x1=this.getPoints()[0].x;
                     var y1=this.getPoints()[0].y;
                     var x2=this.getPoints()[1].x;
                     var y2=this.getPoints()[1].y;
                     context.beginPath();
                     context.lineWidth = 50;
                     context.moveTo(x1-12,y1-12);
                     context.lineTo(x2+12,y1-12);
                     context.lineTo(x2+12,y2+12);
                     context.lineTo(x1-12,y2+12);
                     context.closePath();
                     context.fillStrokeShape(this);
                  },
                  coords: [j, i, Globals.edgeLabels[k]],
               });

               // Edge hover interactions
               line.on('mouseover', function () {
                  this.setStrokeWidth(hexEdgeThickness*5);
                  gb.edgeLayer.draw();
               });

               line.on('mouseleave', function () {
                  this.setStrokeWidth(hexEdgeThickness);
                  gb.edgeLayer.draw();
               })
               gridObject.edges.push(line);
               this.edgeLayer.add(line);
            }

            circle = new Kinetic.Circle({
               x: _x,
               y: _y - hexRadius,
               radius: hexVertexRadius,
               fill: 'green',
               stroke: 'black',
               strokeWidth: 2,
               
               coords: [j, i, Globals.vertexLabels[0]],
            });

            circle.on('mouseover', function () {
               this.setRadius(hexVertexRadius*2);
               gb.vertexLayer.draw();
            });

            circle.on('mouseleave', function () {
               this.setRadius(hexVertexRadius);
               gb.vertexLayer.draw();
            });

            gridObject.vertices.push(circle);
            this.vertexLayer.add(circle);

            circle = circle.clone();
            circle.setAttr('y', _y + hexRadius);
            circle.setAttr('coords', [j, i, Globals.vertexLabels[1]]);

            gridObject.vertices.push(circle);
            this.vertexLayer.add(circle);

            row.push(gridObject);
         }
         
         this.grid.push(row);
      }
      // END LOOP OVER GRID


      // var logic = this;
      // edgeLayer.on('click', function (evt) {
      //    var line = evt.targetNode;
      //    var edge = line.getAttr('coords');

      //    if((evt.which == 1 && logic.canBuild('road', edge)) || evt.which == 2) {
      //       logic.state.roads[logic.state.currentPlayer].push(edge);
      //       line.setStroke('red');
      //       edgeLayer.draw();
      //    }
      // });

      // vertexLayer.on('click', function (evt) {
      //    console.log(evt.targetNode);
      //    var circle = evt.targetNode;
      //    var vertex = circle.getAttr('coords');
      //    if((evt.which == 1 && logic.canBuild('settlement', vertex)) || evt.which == 2) {
      //       logic.state.settlements[logic.state.currentPlayer].push(vertex);
      //       circle.setFill('red');
      //       vertexLayer.draw();
      //    }
      // });

      this.stage.add(this.hexLayer);
      this.stage.add(this.edgeLayer);
      this.stage.add(this.vertexLayer);
   },
};


var b;
$(function () {
  b = new GraphicalBoard(6,6);
});