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
         0 : [],
         1 : [],
         2 : [],
         3 : []
      ],
      roads : [
         0 : [],
         1 : [],
         2 : [],
         3 : []
      ],
      hands : [
         0 : [],
         1 : [],
         2 : [],
         3 : []
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
         {x: _x, y: _y, side: 'N'},
         {x: _x, y: _y, side: 'W'},
         {x: _x, y: _y, side: 'S'},
      ];
   },

   getHexVertices : function (_x, _y) {
      return [
         {x: _x, y: _y, side: 'N'},
         {x: _x, y: _y, side: 'S'},
      ];
   },

// relations
// based on those presented in http://www-cs-students.stanford.edu/~amitp/game-programming/grids/
   neighbors : function (face) {
      var x = face.x, y = face.y;
      if(y % 2) {
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
      var x = face.x, y = face.y;
      if(y % 2) {
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
      var x = face.x, y = face.y;
      if(y % 2) {
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
      var x = edge.x, y = edge.y, label = edge.label;
      if(label == 'N') {
         if(y % 2) 
            return [[x, y, 'N'], [x-1, y-1, 'S']];
         else
            return [[x, y, 'N'], [x, y-1, 'S']];
      }
      else if(label == 'W') {
         if(y % 2) 
            return [[x-1, y+1, 'N'], [x-1, y-1, 'S']];
         else
            return [[x, y+1, 'N'], [x, y-1, 'S']];
      }
      else if(label == 'S') {
         if(y % 2) 
            return [[x, y, 'S'], [x-1, y+1, 'N']];
         else
            return [[x, y, 'S'], [x, y+1, 'N']];
      }

      return false;
   },

   touches : function (vertex) {
      var x = vertex.x, y = vertex.y, label = vertex.label;
      if(label == 'N') {
         if(y % 2)
            return [[x, y], [x-1, y-1], [x, y-1]];
         else
            return [[x, y], [x, y-1], [x+1, y-1]];
      }
      else if(label == 'S') {
         if(y % 2)
            return [[x, y], [x-1, y+1], [x, y+1]];
         else
            return [[x, y], [x, y+1], [x+1, y+1]];
      }

     return false; 
   },

   protrudes : function (vertex) {
      var x = vertex.x, y = vertex.y, label = vertex.label;
      if(label == 'N') {
         if(y % 2) {
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
         if(y % 2) {
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

// game-logic

   canBuild : function (type, data=null) {
      if(data == null)
         return false;
      var intersect = function (a, b) {
         var t;
         if(b.length > a.length) { t = b; b = a; a = t; }   // iterate over shorter array
         return a.filter(function (el) {
            return b.indexOf(el) !== -1);
         });
      };

      if(type == 'road') {
         var state = this.state;
         var availableEndPts = $.map(state.roads[state.currentPlayer], function (edge, idx) {
            this.endpoints(val);
         });
         var roadEndPts = this.endpoints(data);

         if(intersect(availableEndPts, roadEndPts))
            return true;
         else
            return false;
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

      var layer = new Kinetic.Layer({
         offsetX: -100,
         offsetY: -100
      });


      var hex, _x, _y;
      var vertices, line, x_offset, y_offset;
      var hexRadius = 50, 
         hexWidth = 2*hexRadius*Math.cos(30 * Math.PI / 180),
         hexHeight = hexRadius*1.5;
      var hexEdgeThickness = 2;

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
            layer.add(hex);

            x_offset = hexRadius * Math.cos(30 * Math.PI / 180);
            y_offset = hexRadius * 0.5;

            // vertices = [
            //    [_x, _y + hexRadius],
            //    [_x + x_offset, _y + y_offset],
            //    [_x + x_offset, _y - y_offset],
            //    [_x, _y - hexRadius],
            //    [_x - x_offset, _y - y_offset],
            //    [_x - x_offset, _y + y_offset],
            // ];

            vertices = [
               [_x, _y - hexRadius],
               [_x - x_offset, _y - y_offset],
               [_x - x_offset, _y + y_offset],
               [_x, _y + hexRadius]
            ];
            for(k = 0; k < vertices.length - 1; k++) {

               // var pointsToDraw = (k + 1 == vertices.length) ? [vertices[k], vertices[0]] : [vertices[k], vertices[k+1]];
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
                  coords: {x: j, y: i, this.edgeLabels[k]},
               });
               line.on('mouseover', function () {
                  this.setStrokeWidth(hexEdgeThickness*5);
                  layer.draw();
               });

               line.on('mouseleave', function () {
                  this.setStrokeWidth(hexEdgeThickness);
                  layer.draw();
               })
               layer.add(line);
            }


         }
      }


      var logic = this;
      layer.on('click', function (evt) {
         // console.log(evt.targetNode);
         if(evt.targetNode instanceof Kinetic.Line) {
            var line = evt.targetNode;
            var edge = line.getAttr('coords');
            if((e.which == 1 && logic.canBuild('road', edge)) || e.which == 3) {
               logic.state.roads[currentPlayer].push(edge);
               line.setStroke('red');
               this.draw();
            }
         }
      });

      // add the layer to the stage
      stage.add(layer);
   }
};



$(function () {
  var b = new Board(6,6);
  b.draw(); 
});