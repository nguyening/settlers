/*
   5 types of resources, 2 tiles
   1 desert

   offset coordinates

var Game = {
   settlements : [
      0 : [{x:, y:, side: , type: }],
      1 : []
   ],
   roads : [],
   hands : [],
   baron : null
};
*/

var Board = function (_width, _height) {
   this.grid = [];
   this.terrains = [1,2,3,4,5];

   this.width = _width;
   this.height = _height;

   this.edgeLabels = ['N', 'W', 'S'];
   this.vertexLabels = ['N', 'S'];

   this.state = {
      settlements : [
         [],
         [],
         [],
         []
      ],
      roads : [
         [],
         [],
         [],
         []
      ],
      hands : [
         [],
         [],
         [],
         []
      ],
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


};

Board.prototype = {
   construct : function () {
      var row, terrain;
      for(i = 0; i < this.height; i++) {
         row = [];
         for(j = 0; j < this.width; j++) {
            terrain = Math.floor(Math.random() * this.terrains.length);
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
         console.log(currentSettlements);
         console.log(adjacentVertices);
         console.log(intersectEndPts(currentSettlements, adjacentVertices));
         return (intersectEndPts(availableEndPts, selectedVertex) && !intersectEndPts(currentSettlements, adjacentVertices));
      }
      else
         return false;
   },

// drawing

   draw : function (argument) {
      var stage = new Kinetic.Stage({
         container: 'container',
         width: 1000,
         height: 1000
      });

      var hexLayer = new Kinetic.Layer({
         offsetX: -100,
         offsetY: -100
      });
      var edgeLayer = new Kinetic.Layer({
         offsetX: -100,
         offsetY: -100
      });
      var vertexLayer = new Kinetic.Layer({
         offsetX: -100,
         offsetY: -100
      });
      

      var hex, _x, _y;
      var vertices, line, x_offset, y_offset;
      var hexRadius = 50, 
         hexWidth = 2*hexRadius*Math.cos(30 * Math.PI / 180),
         hexHeight = hexRadius*1.5;
      var hexEdgeThickness = 2;
      var hexVertexRadius = 10;

      for(i = 0; i < this.height; i++) {
         for(j = 0; j < this.width; j++) {
            _x = (2 * j + 1 + (i&1)) * (hexWidth/2);
            _y = (2 * i + 1) * (hexHeight/2);

            hex = new Kinetic.RegularPolygon({
               x: _x, // offset by one if odd row
               y: _y,
               sides: 6,
               radius: hexRadius,
               fill: 'green',
            });       
            hexLayer.add(hex);

            var text = new Kinetic.Text({
               x: _x,
               y: _y,
               text: j + ', ' + i,
               fontSize: 12,
               fontFamily: 'Calibri',
               fill: 'black',
            });
            hexLayer.add(text);

            x_offset = hexRadius * Math.cos(30 * Math.PI / 180);
            y_offset = hexRadius * 0.5;

            vertices = [
               [_x, _y - hexRadius],
               [_x - x_offset, _y - y_offset],
               [_x - x_offset, _y + y_offset],
               [_x, _y + hexRadius]
            ];
            for(k = 0; k < vertices.length - 1; k++) {

               var pointsToDraw = [vertices[k], vertices[k+1]];
               line = new Kinetic.Line({
                  points: pointsToDraw,
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
                  coords: [j, i, this.edgeLabels[k]],
               });
               line.on('mouseover', function () {
                  this.setStrokeWidth(hexEdgeThickness*5);
                  edgeLayer.draw();
               });

               line.on('mouseleave', function () {
                  this.setStrokeWidth(hexEdgeThickness);
                  edgeLayer.draw();
               })
               edgeLayer.add(line);
            }

            var circle = new Kinetic.Circle({
               x: _x,
               y: _y - hexRadius,
               radius: hexVertexRadius,
               fill: 'green',
               stroke: 'black',
               strokeWidth: 2,
               
               coords: [j, i, this.vertexLabels[0]],
            });

            circle.on('mouseover', function () {
               this.setRadius(hexVertexRadius*2);
               vertexLayer.draw();
            });

            circle.on('mouseleave', function () {
               this.setRadius(hexVertexRadius);
               vertexLayer.draw();
            });

            vertexLayer.add(circle);
            circle = circle.clone();
            circle.setAttr('y', _y + hexRadius);
            circle.setAttr('coords', [j, i, this.vertexLabels[1]]);

            vertexLayer.add(circle);
            // END LOOP OVER GRID
         }
      }


      var logic = this;
      edgeLayer.on('click', function (evt) {
         var line = evt.targetNode;
         var edge = line.getAttr('coords');

         if((evt.which == 1 && logic.canBuild('road', edge)) || evt.which == 2) {
            logic.state.roads[logic.state.currentPlayer].push(edge);
            line.setStroke('red');
            edgeLayer.draw();
         }
      });

      vertexLayer.on('click', function (evt) {
         console.log(evt.targetNode);
         var circle = evt.targetNode;
         var vertex = circle.getAttr('coords');
         if((evt.which == 1 && logic.canBuild('settlement', vertex)) || evt.which == 2) {
            logic.state.settlements[logic.state.currentPlayer].push(vertex);
            circle.setFill('red');
            vertexLayer.draw();
         }
      })

      stage.add(hexLayer);
      stage.add(edgeLayer);
      stage.add(vertexLayer);
   }
};


var b;
$(function () {
  b = new Board(6,6);
  b.draw(); 
});