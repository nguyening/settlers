var socket = io.connect();
var gb;

var GraphicalBoard = function (_width, _height, _state) {
    this.grid = [];
    this.state = _state || Globals.defaultState;
    this.gridWidth = _width;
    this.gridHeight = _height;
    this.canvasWidth = 500;
    this.canvasHeight = 500;

    this.hexRadius = 50;
    this.hexWidth = 2*this.hexRadius*Math.cos(30 * Math.PI / 180);
    this.hexHeight = this.hexRadius*1.5;
    this.hexEdgeThickness = 2;
    this.hexVertexRadius = 8;
    this.defaultVertexFill = 'white';
    this.defaultEdgeStroke = 'black';

    this.stage = new Kinetic.Stage({
        container: 'container',
        width: this.canvasWidth,
        height: this.canvasHeight
    });

    this.hexLayer = new Kinetic.Layer();
    this.edgeLayer = new Kinetic.Layer();
    this.vertexLayer = new Kinetic.Layer();

    var gb = this;
    // Click bindings
    this.edgeLayer.on('click', function (evt) {
        var line = evt.targetNode;
        var edge = line.getAttr('coords');
        if(line.getAttr('stroke') == gb.defaultEdgeStroke) {
            gb.build('road', edge, evt.which==2);
        }
    });

    this.vertexLayer.on('click', function (evt) {
        var circle = evt.targetNode;
        var vertex = circle.getAttr('coords');
        if(circle.getAttr('fill') != gb.defaultVertexFill) {
            gb.build('city', vertex);
        }
        else {
            gb.build('settlement', vertex, evt.which==2);
        }
    });

    this.stage.add(this.hexLayer);
    this.stage.add(this.edgeLayer);
    this.stage.add(this.vertexLayer);   
    this.init.apply(this, [this.state]);
};

GraphicalBoard.prototype = {
   init : function (state) {
      var gridObject;
      var hex, line, circle, edge_vertices, edge, vertices, vertex;
      var _x, _y, x_offset, y_offset, coords;

      var gb = this;
      var hexRadius = this.hexRadius;
      var hexWidth = this.hexWidth;
      var hexHeight = this.hexHeight;
      var hexEdgeThickness = this.hexEdgeThickness;
      var hexVertexRadius = this.hexVertexRadius;
      var defaultVertexFill = this.defaultVertexFill;
      var defaultEdgeStroke = this.defaultEdgeStroke;

      var row, color, city_flag;

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


            if(!Globals.isUnusedFace([j, i])) {
                // Draw hexagon face
                hex = new Kinetic.RegularPolygon({
                   x: _x,
                   y: _y,
                   sides: 6,
                   radius: hexRadius,
                   fill: Globals.terrainTypes[state.grid[i][j].resource],
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
            }

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
               coords = [j, i, Globals.edgeLabels[k]];
               if(Globals.isUnusedEdge(coords))
                  continue;

               color = undefined;
               for(l = 0; l < Globals.playerData.length; l++) {
                  if(state.roads[l].toString().indexOf(coords.toString()) != -1) {
                     color = Globals.playerData[l][0];
                     break;
                  }
               }
               color = color || defaultEdgeStroke;

               line = new Kinetic.Line({
                  points: edge,
                  stroke: color,
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
                  'coords': coords,
               });

               if(color == defaultEdgeStroke) {
                   // Edge hover interactions
                   line.on('mouseover', function () {
                      this.setStrokeWidth(hexEdgeThickness*5);
                      gb.edgeLayer.draw();
                   });

                   line.on('mouseleave', function () {
                      this.setStrokeWidth(hexEdgeThickness);
                      gb.edgeLayer.draw();
                   });
               }
               gridObject.edges.push(line);
               this.edgeLayer.add(line);
            }

            // Draw hexagon vertices (N, S)
            vertices = [edge_vertices[0], edge_vertices[3]];

            for(k = 0; k < vertices.length; k++) {
                city_flag = false;
               vertex = vertices[k];
               coords = [j, i, Globals.vertexLabels[k]];
                if(Globals.isUnusedVertex(coords))
                    continue;

               color = undefined;
               for(l = 0; l < Globals.playerData.length; l++) {
                  if(state.settlements[l].toString().indexOf(coords.toString()) != -1) {
                     color = Globals.playerData[l][0];
                      if(state.cities[l].toString().indexOf(coords.toString()) != -1) {
                        city_flag = true;
                      }
                     break;
                  }
               }
               color = color || defaultVertexFill;
               if(city_flag) {
                star  = new Kinetic.Star({
                    x: vertex[0],
                    y: vertex[1],
                    numPoints: 6,
                    innerRadius: hexVertexRadius,
                    outerRadius: hexVertexRadius*2,
                    fill: color,
                    stroke: 'black',
                    strokeWidth: 1,
                    coords: coords,
                });
                gridObject.vertices.push(star);
                this.vertexLayer.add(star);
               }
               else {
                   circle = new Kinetic.Circle({
                      x: vertex[0],
                      y: vertex[1],
                      radius: hexVertexRadius,
                      fill: color,
                      opacity: (color == defaultVertexFill) ? 0 : 1,
                      'coords': coords,
                   });

                   circle.on('mouseover', function () {
                        this.setAttrs({
                            opacity: 1,
                            radius: hexVertexRadius*3,
                            stroke: 'black',
                            strokeWidth: 2,
                        });
                      gb.vertexLayer.draw();
                   });

                   circle.on('mouseleave', function () {
                        this.setAttrs({
                            opacity: (this.getAttr('fill') == defaultVertexFill) ? 0 : 1,
                            radius: hexVertexRadius,
                            stroke: null,
                            strokeWidth: 0,
                        });
                      gb.vertexLayer.draw();
                   });

                   gridObject.vertices.push(circle);
                   this.vertexLayer.add(circle);
               }
            }

            row.push(gridObject);
         }
         
         this.grid.push(row);
      }

      this.stage.draw();
   },

   build : function (type, coords, override) {
      socket.emit('buildRequest', {
         'type': type,
         'coords': coords,
         'override': override
      });
   },

   drawRoad : function (edge) {
      var gridObject = this.grid[edge[1]][edge[0]];
      var line;
      for(i = 0; i < gridObject.edges.length; i++) {
         line = gridObject.edges[i];
         if(line.getAttr('coords')[2] == edge[2]) {
            line.setStroke(Globals.playerData[this.state.currentPlayer][0]);
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
            circle.setFill(Globals.playerData[this.state.currentPlayer][0]);
            this.vertexLayer.draw();
            break;
         }
      }
    },

    drawCity : function (vertex) {
        var gridObject = this.grid[vertex[1]][[vertex[0]]];
        var star;
        for(i = 0; i < gridObject.vertices.length; i++) {
            circle = gridObject.vertices[i];
            if(circle.getAttr('coords')[2] == vertex[2]) {
                star  = new Kinetic.Star({
                    x: circle.getAttr('x'),
                    y: circle.getAttr('y'),
                    numPoints: 6,
                    innerRadius: this.hexVertexRadius,
                    outerRadius: this.hexVertexRadius*2,
                    fill: Globals.playerData[this.state.currentPlayer][0],
                    stroke: 'black',
                    strokeWidth: 1,
                });
                circle.remove();
                this.vertexLayer.add(star);
                this.vertexLayer.draw();
                break;
            }
        }
    },

   //lobby-drawing
    updatePlayers : function function_name (argument) {
        var players = $('#players');
        for(var key in this.state.players) {
            var playerDom = players.find('#p'+key)
                .text(this.state.players[key]);

            if(key == this.state.currentPlayer) {
                players.find('li').css('font-weight', 'normal');
                playerDom.css('font-weight', 'bold');
            }
        }
   },
};

socket.on('state', function (data) {
    $('#sessid').text(data.sessid);

    gb = new GraphicalBoard(data.gW, data.gH, data.state);
    gb.updatePlayers();
});

socket.on('buildAccept', function (data) {   
    if(data.type == 'road') {
        gb.drawRoad(data.coords);
    }  
    else if(data.type == 'settlement') {
        gb.drawSettlement(data.coords);
    }
    else if(data.type == 'city') {
        gb.drawCity(data.coords);
    }
});

socket.on('nextTurn', function (data) {
   gb.state.currentPlayer = data.currentPlayer;
   gb.updatePlayers();
});

socket.on('players', function (data) {
    gb.state.players = data.players;
    gb.updatePlayers();
});

$(function () {
    socket.emit('grabState', {});
   $('#endTurn').click(function (evt) {
      socket.emit('endTurn', {});
   });
});
