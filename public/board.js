var socket = io.connect();
var gb;

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

   var gb = this;
   // Click bindings
   this.edgeLayer.on('click', function (evt) {
      var line = evt.targetNode;
      var edge = line.getAttr('coords');
      gb.build('road', line, evt.which==2);
   });

   this.vertexLayer.on('click', function (evt) {
      var circle = evt.targetNode;
      var vertex = circle.getAttr('coords');
      gb.build('settlement', circle, evt.which==2);
   });

   this.stage.add(this.hexLayer);
   this.stage.add(this.edgeLayer);
   this.stage.add(this.vertexLayer);   
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

      this.stage.draw();
   },

   build : function (type, tN, override) {
      console.log(override);
      socket.emit('build', {
         'type': type,
         coords: tN.getAttr('coords'),
         'override': override
      });
   },

   drawRoad : function (edge) {
      var gridObject = this.grid[edge[1]][edge[0]];
      var line;
      for(i = 0; i < gridObject.edges.length; i++) {
         line = gridObject.edges[i];
         if(line.getAttr('coords')[2] == edge[2]) {
            line.setStroke('red');
            this.edgeLayer.draw();
            break;
         }
      }
   },

   drawSettlement : function (vertex) {
      var gridObject = this.grid[vertex[1]][vertex[0]];
      var circle;
      for(i = 0; i < gridObject.vertices.length; i++) {
         circle = gridObject.vertices[i];
         if(circle.getAttr('coords')[2] == vertex[2]) {
            circle.setFill('red');
            this.vertexLayer.draw();
            break;
         }
      }
   },
};

socket.on('acceptConnection', function (data) {
   gb = new GraphicalBoard(data.gW,data.gH);
});

socket.on('buildAccept', function (data) {   
   if(data.type == 'road') {
      gb.drawRoad(data.coords);
   }  
   else if(data.type == 'settlement') {
      gb.drawSettlement(data.coords);
   };
});

$(function () {
   socket.emit('newConnection', {});
});