var socket = io.connect();
var gb, log;
var GraphicalBoard = function (_width, _height, _state, sessid) {
    //czech http://stackoverflow.com/a/18949651/1487756
    this.player_num = Array.apply(null, {length : Globals.playerData.length})
                .map(function(el,i) {return _state.players[i];}).indexOf(sessid);

    this.grid = [];
    this.state = _state || Globals.defaultState.slice(0);
    this.gridWidth = _width;
    this.gridHeight = _height;
    this.canvasWidth = 500;
    this.canvasHeight = 600;
    this.hexRadius = 50;
    this.hexWidth = 2*this.hexRadius*Math.cos(30 * Math.PI / 180);
    this.hexHeight = this.hexRadius*1.5;
    this.hexEdgeThickness = 2;
    this.hexVertexRadius = 8;
    this.defaultVertexFill = 'black';
    this.defaultEdgeStroke = 'black';

    this.cardWidth = 50;
    this.cardHeight = 75;
    this.cardBaseY = 520;

    this.offsetX = this.hexRadius/4;
    this.offsetY = 0;

    this.stage = new Kinetic.Stage({
        container: 'container',
        width: this.canvasWidth,
        height: this.canvasHeight
    });

    this.hexLayer = new Kinetic.Layer({
        offsetX : this.offsetX,
        offsetY : this.offsetY,
    });
    this.edgeLayer = new Kinetic.Layer({
        offsetX : this.offsetX,
        offsetY : this.offsetY,
    });
    this.vertexLayer = new Kinetic.Layer({
        offsetX : this.offsetX,
        offsetY : this.offsetY,
    });
    this.handLayer = new Kinetic.Layer({
        offsetX : -this.canvasWidth/2,
        offsetY : -this.cardBaseY,
    });
    this.playerLayer = new Kinetic.Layer();

    this.baron = new Kinetic.RegularPolygon({
        x: 0,
        y: 0,
        sides: 6,
        visible: false,
        radius: this.hexRadius/4,
        fill: 'black',
    });
    this.vertexLayer.add(this.baron);

    var gb = this;
    // Click bindings
    this.hexLayer.on('click', function (evt) {
      var hex = evt.targetNode.getParent();   // text and hexagon are both in a group
      socket.emit('requestBaronMove', {
        coords: hex.getAttr('coords'),
      });
      log.log(0, '> MOVE BARON '+hex.getAttr('coords'));
    })

    this.edgeLayer.on('click', function (evt) {
        var line = evt.targetNode;
        var edge = line.getAttr('coords');
        if(line.getAttr('stroke') == gb.defaultEdgeStroke) {
            gb.build('road', edge);
        }
    });

    this.vertexLayer.on('click', function (evt) {
        var circle = evt.targetNode;
        var vertex = circle.getAttr('coords');
        if(circle.getAttr('fill') != gb.defaultVertexFill) {
            gb.build('city', vertex);
        }
        else {
            gb.build('settlement', vertex);
        }
    });

    this.handLayer.on('click', function (evt) {
        var card = evt.targetNode;
        card.setAttr('selected', !card.getAttr('selected'));
    });

    this.playerLayer.on('click', function (evt) {
        var wedge = evt.targetNode;
        var pnum = wedge.getAttr('player_num');
        if(pnum == gb.player_num) // no interactions for self
            return;

        if(gb.state.baronState == 2) {
          socket.emit('requestBaronSteal', {player_num: pnum});
          log.log(0, '> STEAL FROM '+pnum);
        }
        // TODO: add trading
        // else if(this.state.trading)
    });

    this.stage.add(this.hexLayer);
    this.stage.add(this.edgeLayer);
    this.stage.add(this.vertexLayer);   
    this.stage.add(this.playerLayer);
    this.stage.add(this.handLayer);
    this.init.apply(this, [this.state]);
};

GraphicalBoard.prototype = {
   init : function (state) {
      var gridObject;
      var hexGroup, hex, line, circle, text, edge_vertices, edge, vertices, vertex;
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

      for(var i = 0; i < this.gridHeight; i++) {
         row = [];
         for(var j = 0; j < this.gridWidth; j++) {

            gridObject = {
               face : null,
               edges : [],
               vertices : [],
            };
            _x = (2 * j + 1 + (i&1)) * (hexWidth/2); // offset by one if odd row
            _y = (2 * i + 1) * (hexHeight/2);


            if(!Globals.isUnusedFace([j, i])) {
                hexGroup = new Kinetic.Group({x:_x, y:_y, coords: [j, i]});
                // Draw hexagon face
                hex = new Kinetic.RegularPolygon({
                   x: 0,
                   y: 0,
                   sides: 6,
                   radius: hexRadius,
                   fill: Globals.terrainTypes[state.grid[i][j].resource],
                });

                text = new Kinetic.Text({
                   x: 0,
                   y: 0,
                   text: ''+state.grid[i][j].roll,
                   fontSize: 12,
                   fontFamily: 'Calibri',
                   fill: 'black',
                });
                // centering text
                text.setOffset({
                  x: text.getWidth()/2,
                  y: text.getHeight()/2,
                });

                hexGroup.add(hex);
                hexGroup.add(text);

                hexGroup.on('mouseover', function () {
                    var tempBaron = new Kinetic.RegularPolygon({
                        x: this.getAttr('x'),
                        y: this.getAttr('y'),
                        sides: 6,
                        radius: gb.hexRadius/4,
                        fill: 'black',
                        opacity: 0.5,
                    });
                    gb.baron.setAttr('tempBaron', tempBaron);
                    gb.vertexLayer.add(tempBaron);
                    gb.vertexLayer.draw();
                });

                hexGroup.on('mouseout', function () { // mouseout to prevent bubbling
                    gb.baron.getAttr('tempBaron')
                      .remove();
                    gb.vertexLayer.draw();
                });
                gridObject.face = hexGroup;
                this.hexLayer.add(hexGroup);
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

            for(var k = 0; k < edge_vertices.length - 1; k++) {
               edge = [edge_vertices[k], edge_vertices[k+1]];
               coords = [j, i, Globals.edgeLabels[k]];
               if(Globals.isUnusedEdge(coords))
                  continue;

               color = undefined;
               for(var l = 0; l < Globals.playerData.length; l++) {
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

               // only bind interactions to edges that haven't been built on yet
               if(color == defaultEdgeStroke) {
                   // Edge hover interactions
                   line.on('mouseover', function () {
                        if( (this.getAttr('stroke') != defaultEdgeStroke && this.getAttr('stroke') != Globals.playerData[gb.player_num][0]) )
                            return;
                      this.setStrokeWidth(hexEdgeThickness*5);
                      gb.edgeLayer.draw();
                   });

                   line.on('mouseleave', function () {
                        if( (this.getAttr('stroke') != defaultEdgeStroke && this.getAttr('stroke') != Globals.playerData[gb.player_num][0]) )
                            return;
                      this.setStrokeWidth(hexEdgeThickness);
                      gb.edgeLayer.draw();
                   });
               }
               gridObject.edges.push(line);
               this.edgeLayer.add(line);
            }

            // Draw hexagon vertices (N, S)
            vertices = [edge_vertices[0], edge_vertices[3]];

            for(var k = 0; k < vertices.length; k++) {
                city_flag = false;
               vertex = vertices[k];
               coords = [j, i, Globals.vertexLabels[k]];
                if(Globals.isUnusedVertex(coords))
                    continue;

               color = undefined;
               for(var l = 0; l < Globals.playerData.length; l++) {
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
                        if( (this.getAttr('fill') != defaultVertexFill && this.getAttr('fill') != Globals.playerData[gb.player_num][0]) )
                            return;
                        this.setAttrs({
                            opacity: 1,
                            radius: hexVertexRadius*3,
                            stroke: 'black',
                            strokeWidth: 2,
                        });
                      gb.vertexLayer.draw();
                   });

                   circle.on('mouseleave', function () {
                        if( (this.getAttr('fill') != defaultVertexFill && this.getAttr('fill') != Globals.playerData[gb.player_num][0]) )
                            return;
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

      this.drawBaron();

      // Other UI
      this.drawPlayers();
      this.drawHand();
      this.stage.draw();
    },

    stateChange : function () {
      if( (gb.state.currentPlayer != gb.player_num) ) {
        gb.hexLayer.setListening(false);
        gb.edgeLayer.setListening(false);
        gb.vertexLayer.setListening(false);
        gb.playerLayer.setListening(false);
        gb.drawHit();
      }
      else {
        if(gb.state.baronState == 1) {
          gb.hexLayer.setListening(true);
          gb.edgeLayer.setListening(false);
          gb.vertexLayer.setListening(false);
          gb.playerLayer.setListening(false);
          gb.drawHit();
        }
        else if(gb.state.baronState == 2) {
          gb.hexLayer.setListening(false);
          gb.edgeLayer.setListening(false);
          gb.vertexLayer.setListening(false);
          gb.playerLayer.setListening(true);
          gb.drawHit();
        }
        else if(gb.state.baronState == 0) {
          gb.hexLayer.setListening(false);
          gb.edgeLayer.setListening(true);
          gb.vertexLayer.setListening(true);
          // TODO: if trading, listen on player layer
          gb.playerLayer.setListening(false);
          gb.drawHit();
        }
        else if(gb.state.baronState == 3) { // wait for other players
          gb.hexLayer.setListening(false);
          gb.edgeLayer.setListening(false);
          gb.vertexLayer.setListening(false);
          gb.playerLayer.setListening(false);    
          gb.drawHit();      
        }
      }
    },

    drawHit : function () {
      this.hexLayer.drawHit();
      this.edgeLayer.drawHit();
      this.vertexLayer.drawHit();
      this.playerLayer.drawHit();
    },

    drawPlayers : function () {
      var player;
      var shapes = [{
          x: 0,
          y: 0,
          radius: 75,
          angleDeg: 90,
          fill: 'green',
        }, 
        {
          x: this.canvasWidth+15,
          y: 0,
          radius: 75,
          angleDeg: 90,
          rotationDeg: 90,
          fill: 'green',
        }, 
        {
          x: 0,
          y: this.canvasWidth,
          radius: 75,
          angleDeg: 90,
          rotationDeg: -90,
          fill: 'green'
        }, 
        {
          x: this.canvasWidth,
          y: this.canvasWidth,
          radius: 75,
          angleDeg: 90,
          rotationDeg: 180,
          fill: 'green'
        }, 

        ];

      for(var p = 0; p < Globals.playerData.length; p++) {
        player = new Kinetic.Wedge(shapes[p]);
        player.setAttr('fill', Globals.playerData[p][0]);
        player.setAttr('player_num', p);
        if(p != this.player_num) {   
          player.on('mouseover', function () {
              this.setScale(1.5);
              gb.playerLayer.draw();
          });
          player.on('mouseleave', function () {
              this.setScale(1);
              gb.playerLayer.draw();
          });
        }
        this.playerLayer.add(player);
      }
    },

    drawBaron : function () {
        var coords = this.state.baron;
        var hex = this.grid[coords[1]][coords[0]].face;
        this.baron.setAttrs({
          x: hex.getAttr('x'),
          y: hex.getAttr('y'),
          visible: true,
        })
        this.vertexLayer.draw();
    },

    drawHand : function () {
       this.handLayer.removeChildren();
       var group = new Kinetic.Group({x:0, y:0});
       var box, hand = this.state.hands[this.player_num];
       for(var i = 0; i < hand.length; i++) {
            box = new Kinetic.Rect({
                x: i*this.cardWidth/2,
                y: 0,
                width: this.cardWidth,
                height: this.cardHeight,
                fill: Globals.terrainTypes[hand[i]],
                stroke: 'black',
                strokeWidth: 2,
                resource: hand[i],
                selected: false,
            });

            box.on('mouseover', function (evt) {
              if(!this.getAttr('selected')) {
                this.move(0, -10);
                gb.handLayer.draw();
              }
            });

            box.on('mouseout', function (evt) {
                if(!this.getAttr('selected')) {
                  this.move(0, 10);
                  gb.handLayer.draw();
                }
            });
                  
            group.add(box);
       }
       group.setOffsetX((hand.length+1)*this.cardWidth/4);
       this.handLayer.add(group);
       this.handLayer.draw();
    },

    drawRoad : function (edge) {
      var gridObject = this.grid[edge[1]][edge[0]];
      var line;
      for(var i = 0; i < gridObject.edges.length; i++) {
         line = gridObject.edges[i];
         if(line.getAttr('coords')[2] == edge[2]) {
            line.setStroke(Globals.playerData[this.state.currentPlayer][0]);
            // line.setListening(false);
            this.edgeLayer.draw();
            break;
         }
      }
    },

    drawSettlement : function (vertex) {
      var gridObject = this.grid[vertex[1]][vertex[0]];
      var circle;
      for(var i = 0; i < gridObject.vertices.length; i++) {
         circle = gridObject.vertices[i];
         if(circle.getAttr('coords')[2] == vertex[2]) {
            circle.setFill(Globals.playerData[this.state.currentPlayer][0]);
            circle.setOpacity(1);
            this.vertexLayer.draw();
            break;
         }
      }
    },

    drawCity : function (vertex) {
        var gridObject = this.grid[vertex[1]][[vertex[0]]];
        var star;
        for(var i = 0; i < gridObject.vertices.length; i++) {
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
    updatePlayers : function function_name () {
        // var players = $('#players');
        // for(var key in this.state.players) {
        //     var playerDom = players.find('#p'+key)
        //         .text(this.state.players[key]);

        //     if(key == this.state.currentPlayer) {
        //         players.find('li').css('font-weight', 'normal');
        //         playerDom.css('font-weight', 'bold');
        //     }
        // }

        gb.playerLayer.getChildren().each(function (node, i) {
          if(parseInt(node.getAttr('player_num')) == gb.state.currentPlayer) {
            node.setAttrs({
              stroke: 'black',
              strokeWidth: 5,
            });
          }
          else {
            node.setAttrs({
              stroke: null,
              strokeWidth: 0,
            });
          }
        });   
        gb.playerLayer.draw();
   },

  build : function (type, coords) {
      socket.emit('buildRequest', {
         'type': type,
         'coords': coords
      });
      log.log(0, '> BUILD '+type+'@'+coords);
   },
};

var Log = function () {
    this.logTypes = ['SELF', 'GAME', 'LOBBY'];

    this.log = function (code, message) {
        var logarea = $('#log');
        if(logarea.children().length > 25)
            logarea.empty();
        if(code == -1) {
          $('<p>===================================================================</p>').appendTo(logarea);
        }
        else
          $('<p><span class="code">['+this.logTypes[code]+']</span> '+message+'</p>').appendTo(logarea);
    };
};

socket.on('state', function (data) {
    gb = new GraphicalBoard(data.gW, data.gH, data.state, data.sessid);
    gb.updatePlayers();
    log = new Log();
    log.log(0, 'You ('+data.sessid+') have joined the game as Player '+(gb.player_num+1));
    gb.stateChange();
});

socket.on('players', function (data) {
    gb.state.players = data.players;
    gb.updatePlayers();
    if(data.reason == 'DROP')
        log.log(2, 'Player '+(data.player_num+1)+' ('+data.player+') has left the game.');
    else if(data.reason == 'NEW')
        log.log(2, data.player+' has joined as Player '+(data.player_num+1));
    else 
        log.log(2, 'Lobby has been updated.');
});

socket.on('roll', function (data) {
    log.log(1, 'Player '+(gb.state.currentPlayer+1)+' has rolled a '+data.roll+'.');
});

// Baron
socket.on('promptBaronMove', function (data) {
    gb.state.baronState = data.baronState;
    gb.stateChange();
    log.log(0, 'BARON PHASE: You need to move the baron to a new tile.');
});
socket.on('promptBaronSteal', function (data) {
    gb.state.baronState = data.baronState;
    // data.robbablePlayers;
    gb.stateChange();
    log.log(0, 'BARON PHASE: Select a player whose settlement(s) are on that tile to steal from.');
});
socket.on('baronFinish', function (data) {
    gb.state.baronState = data.baronState;
    gb.stateChange();
    log.log(0, 'BUILD PHASE: You can now build settlements or roads.');
});

socket.on('moveBaron', function (data) {
    gb.state.baron = data.coords;
    gb.drawBaron();
    log.log(1, 'BARON PHASE: The baron has been moved!');
});

socket.on('overflowNotice', function (data) {
    gb.state.baronState = data.baronState;
    gb.stateChange();
    log.log(1, 'BARON PHASE: You have more than '+Globals.overflowHandSize+' resources in your hand. You must discard half of them.');
});
socket.on('overflowWait', function (data) {
    var overflows = data.overflowPlayers.map(function (el) {
      return (el+1);
    });
    gb.state.baronState = data.baronState;
    gb.stateChange();
    log.log(1, 'BARON PHASE: Waiting on players to discard half of their hands..('+overflows+')');
});


socket.on('distributeResources', function (data) {
    // data.cardsAdded
    gb.state.hands = data.hands;
    gb.drawHand();
    log.log(1, 'ROLL PHASE: Resources have been distributed for the roll.');
});

socket.on('deduct', function (data) {
    gb.state.hands[gb.player_num] = data.hand;
    if(data.action == 'build')
        log.log(0, 'BUILD PHASE: You have lost resources from building.');
    else if(data.action == 'steal')
        log.log(0, 'BARON PHASE: You have had some of your resources stolen.');
    else if(data.action == 'overflow')
        log.log(0, 'BARON PHASE: You have handed over your overflow resources.');
    gb.drawHand();  
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
    log.log(1, 'BUILD PHASE: Player ' + (gb.state.currentPlayer + 1) + ' has built a ' + data.type + '@' + data.coords);
});

socket.on('nextTurn', function (data) {
    log.log(1, 'Player ' + (gb.state.currentPlayer+1) + ' has ended their turn.');
    gb.state.currentPlayer = data.currentPlayer;
    gb.updatePlayers();
    gb.stateChange();

    if(data.round < 2 && gb.player_num == gb.state.currentPlayer) {
        if(gb.player_num == Globals.playerData - 1) 
          log.log(0, 'SETUP PHASE: You are allowed to place two settlements and two roads for free this turn.');
        else
          log.log(0, 'SETUP PHASE: You are allowed to place one settlement and one road for free this turn.');
    }
    else if(data.round >= 2){
      log.log(-1);
      log.log(1, 'Round '+(data.round-1));
    }
});

socket.on('chatMsg', function (data) {
  log.log(1, 'Player '+(data.author+1)+': '+data.message);
});

$(function () {
    socket.emit('grabState', {});
   $('#endTurn').click(function (evt) {
      socket.emit('endTurn', {});
      log.log(0, '> END TURN');
   });

   $('#giveResource').click(function (evt) {
        var resType = parseInt($('#resource').val());
       socket.emit('giveResource', {resource: resType});
       log.log(0, '> GIVE RESOURCE '+resType);
   });

   $('#discard').click(function (evt) {
      var cardsDiscard = [];
      gb.handLayer.getChildren()[0].getChildren().each(function (card, idx) {
          if(card.getAttr('selected'))
            cardsDiscard.push(card.getAttr('resource'));
      });
      socket.emit('overflowResolve', {
          cardsDiscard: cardsDiscard,
      });
      log.log(0, '> DISCARD OVERFLOW: '+cardsDiscard);
   });

   $('#dialog').keypress(function (evt) {
     if(evt.which == 13) {
      var text = $(this).val();
      socket.emit('chat', {message: text});
      log.log(0, 'Player '+(gb.player_num+1)+': '+text);
      $(this).val('');
     }
   });
});
