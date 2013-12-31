var Globals = require('./lib/globals.js').Globals;
var State = require('./lib/state.js').State;
var HexagonGrid = require('./lib/hexgrid.js').HexagonGrid;

var socket = io.connect();
var gb, log;
var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;


var Log = function () {
    this.logTypes = ['SELF', 'GAME', 'LOBBY'];

    this.log = function (code, message) {
        var logarea = $('#log');
        // if(logarea.children().length > 15)
        //     logarea.empty();
        if(code == -1) {
          $('<p>===================================================================</p>').appendTo(logarea);
        }
        else
          $('<p><span class="code">['+this.logTypes[code]+']</span> '+message+'</p>').appendTo(logarea);
    };
};

var GraphicalBoard = function (_width, _height, _state) {
    var gb = this;
    this.state = new State();
    this.state.initializeLocalState(_state);

    // CATAN BOARD
    this.grid = [];
    this.gridWidth = _width;
    this.gridHeight = _height;
    this.canvasWidth = 500;
    this.canvasHeight = 500;

    this.hexRadius = 50;
    this.hexWidth = 2*this.hexRadius*Math.cos(30 * Math.PI / 180);
    this.hexHeight = this.hexRadius*1.5;
    this.hexEdgeThickness = 2;
    this.hexVertexRadius = 8;

    this.defaultVertexFill = 'black';
    this.defaultEdgeStroke = 'black';
    this.terrainColoring = ['brown', 'chartreuse', 'grey', 'gold', 'forestgreen', 'white'];
    this.devColoring = ['grey', 'darkred', 'greenyellow', 'greenyellow', 'greenyellow', 'yellow'];
    this.playerColoring = ['red', 'blue', 'yellow', 'white'];

    this.cardWidth = 50;
    this.cardHeight = 75;
    this.cardBaseY = 520;

    this.offsetX = this.hexRadius/4;
    this.offsetY = 0;

    this.stage = new Kinetic.Stage({
        container: 'board',
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
    this.playerLayer = new Kinetic.Layer();
    this.decoLayer = new Kinetic.Layer();

    this.baron = new Kinetic.RegularPolygon({
        x: 0,
        y: 0,
        sides: 6,
        visible: false,
        radius: this.hexRadius/4,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        fill: 'black',
    });
    this.decoLayer.add(this.baron);

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


    this.playerLayer.on('click', function (evt) {
        var wedge = evt.targetNode;
        var pnum = wedge.getAttr('player_num');
        if(pnum == gb.state.getMyNum()) // no interactions for self
            return;
        if(!gb.state.isRobbable(wedge.getAttr('player_num')))
            return;

        if(gb.state.isBaronState(2)) {
          socket.emit('requestBaronSteal', {player_num: pnum});
          log.log(0, '> STEAL FROM '+pnum);
        }
    });

    this.stage.add(this.hexLayer);
    this.stage.add(this.edgeLayer);
    this.stage.add(this.playerLayer);
    this.stage.add(this.decoLayer);
    this.stage.add(this.vertexLayer);   

    // TRADING WINDOW
    this.tradeWindow = new Kinetic.Stage({
        container: 'tradeWindow',
        width: this.canvasWidth,
        height: 3*this.cardHeight/2,
    });
    this.tradeButtonsLayer = new Kinetic.Layer();
    this.myResourcesLayer = new Kinetic.Layer();
    this.theirResourcesLayer = new Kinetic.Layer();

    this.tradeButtonsLayer.on('click', function (evt) {
        var button = evt.targetNode;
        var target = button.getParent().getAttr('target');
        if(target == 'mine') {
            gb.state.setTradeCards(gb.state.getTradeCards().concat(button.getAttr('resource')));
        }
        else if(target == 'theirs') {
            gb.state.setWantCards(gb.state.getWantCards().concat(button.getAttr('resource')));   
        }
        gb.drawTradeWindowContents();
    });

    this.myResourcesLayer.on('click', function (evt) {
        var card = evt.targetNode;
        var tradeCards = gb.state.getTradeCards();
        tradeCards.splice(tradeCards.indexOf(card.getAttr('resource')), 1);
        
        gb.state.setTradeCards(tradeCards);
        gb.drawTradeWindowContents();
    });

    this.theirResourcesLayer.on('click', function (evt) {
        var card = evt.targetNode;
        var wantCards = gb.state.getWantCards();
        wantCards.splice(wantCards.indexOf(card.getAttr('resource')), 1);
        
        gb.state.setWantCards(wantCards);
        gb.drawTradeWindowContents();
    });

    this.tradeWindow.add(this.tradeButtonsLayer);
    this.tradeWindow.add(this.myResourcesLayer);
    this.tradeWindow.add(this.theirResourcesLayer);

    // HAND
    this.handWindow = new Kinetic.Stage({
      container: 'handWindow',
      width: this.canvasWidth,
      height: this.cardHeight*2,
    });
    this.handLayer = new Kinetic.Layer();
    this.handLayer.on('click', function (evt) {
        var card = evt.targetNode;
        card.setAttr('selected', !card.getAttr('selected'));
    });
    this.handWindow.add(this.handLayer);

    // DEV
    this.devWindow = new Kinetic.Stage({
      container: 'devWindow',
      width: this.canvasWidth,
      height: this.cardHeight*3,
    });
    this.tableBorder = new Kinetic.Layer();
    this.tableLayer = new Kinetic.Layer();
    this.hiddenLayer = new Kinetic.Layer({
        y: this.cardHeight*2,
    });

    this.hiddenLayer.on('click', function (evt) {
       var thisCard = evt.targetNode;
       var oldVal = thisCard.getAttr('selected');
       this.getChildren().each(function (card) {
          card.setAttrs({
            selected: false,
            y: 0,
          });
       });
       thisCard.setAttrs({
            selected: true,
            y: -10,
          });
       gb.hiddenLayer.draw();
    });

    this.devWindow.add(this.tableBorder);
    this.devWindow.add(this.tableLayer);
    this.devWindow.add(this.hiddenLayer);

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

      var row, color, city_flag, finalEdgeThickness;

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
                   fill: this.terrainColoring[state.grid[i][j].resource],
                });

                text = new Kinetic.Text({
                   x: 0,
                   y: 0,
                   text: ''+state.grid[i][j].roll+' ('+j+', '+i+')',
                   fontSize: 16,
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
                        offsetX: gb.offsetX,
                        offsetY: gb.offsetY,
                    });

                    // var tempText = new Kinetic.Group({
                    //   x: this.getAttr('x')-150,
                    //   y: this.getAttr('y'),
                    // });

                    // var coords = this.getAttr('coords');
                    // tempText.add(new Kinetic.Rect({x:0, y:0, width: 300, height: 20, fill: 'white'}));
                    // tempText.add(new Kinetic.Text({
                    //   x:0, y:0,
                    //   text: JSON.stringify(HexagonGrid.corners(coords)),
                    //   fontSize: 10,
                    //   fontFamily: 'Calibri',
                    //   fill: 'black',
                    // }));
                    gb.baron.setAttr('tempBaron', tempBaron);
                    // gb.baron.setAttr('tempText', tempText);

                    // gb.decoLayer.add(tempText);
                    gb.decoLayer.add(tempBaron);
                    gb.decoLayer.draw();
                });

                hexGroup.on('mouseout', function () { // mouseout to prevent bubbling
                    gb.baron.getAttr('tempBaron')
                      .remove();
                    // gb.baron.getAttr('tempText')
                    //   .remove();
                    gb.decoLayer.draw();
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
               coords = [j, i, HexagonGrid.edgeLabels[k]];
               if(Globals.isUnusedEdge(coords))
                  continue;

               color = undefined;
               for(var l = 0; l < NUM_PLAYERS; l++) {
                  if(state.roads[l].toString().indexOf(coords.toString()) != -1) {
                     color = this.playerColoring[l];
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
                        if( (this.getAttr('stroke') != defaultEdgeStroke && this.getAttr('stroke') != gb.playerColoring[gb.state.getMyNum()]) )
                            return;
                      this.setStrokeWidth(this.getStrokeWidth()*5);
                      gb.edgeLayer.draw();
                   });

                   line.on('mouseleave', function () {
                        if( (this.getAttr('stroke') != defaultEdgeStroke && this.getAttr('stroke') != gb.playerColoring[gb.state.getMyNum()]) )
                            return;
                      this.setStrokeWidth(this.getStrokeWidth()/5);
                      gb.edgeLayer.draw();
                   });
               }
               gridObject.edges.push(line);
               this.edgeLayer.add(line);
                              var harborNum = Globals.getHarborNum(coords);
               if(harborNum != -1) {                                  
                  color = this.terrainColoring[this.state.getHarborAssignments()[harborNum]] || 'purple';
                  line = new Kinetic.Line({
                    points: edge,
                    stroke: color,
                    strokeWidth: hexEdgeThickness*5,
                    offsetX: this.offsetX,
                    offsetY: this.offsetY,
                  });

                  if(coords[2] == 'N') {
                    if(edge[0][1] > this.canvasHeight/2) {
                      line.move(7, 10);
                    }
                    else {
                      line.move(-10, -10);
                    }
                  }
                  else if(coords[2] == 'W') {
                      if(edge[0][0] > this.canvasWidth/2) {
                        line.move(10, 0);
                      }
                      else {
                        line.move(-10, 0);
                      }
                  }
                  else if(coords[2] == 'S') {
                    if(edge[0][1] > this.canvasHeight/2) {
                      line.move(-5, 10);
                    }
                    else {
                      line.move(5, -10);
                    }
                  }
                  this.decoLayer.add(line);
               }
            }

            // Draw hexagon vertices (N, S)
            vertices = [edge_vertices[0], edge_vertices[3]];

            for(var k = 0; k < vertices.length; k++) {
                city_flag = false;
               vertex = vertices[k];
               coords = [j, i, HexagonGrid.vertexLabels[k]];
                if(Globals.isUnusedVertex(coords))
                    continue;

               color = undefined;
               for(var l = 0; l < NUM_PLAYERS; l++) {
                  if(state.settlements[l].toString().indexOf(coords.toString()) != -1) {
                     color = this.playerColoring[l];
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
                        if( (this.getAttr('fill') != defaultVertexFill && this.getAttr('fill') != gb.playerColoring[gb.state.getMyNum()]) )
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
                        if( (this.getAttr('fill') != defaultVertexFill && this.getAttr('fill') != gb.playerColoring[gb.state.getMyNum()]) )
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
      this.drawPlayers();
      this.stage.draw();

      // Other UI
      this.drawHand();
      this.drawDevs();

      //trade
      var row, col, rect;
      var rectGroup = new Kinetic.Group({
          target: 'mine',
      });

      for(var t = 0; t < this.terrainColoring.length - 1; t++) { // dont draw desert
          col = t%2;
          row = t%3;
          rect = new Kinetic.Rect({
              x: col*this.cardWidth/2,
              y: row*this.cardHeight/2,
              width: this.cardWidth/2,
              height: this.cardHeight/2,
              fill: this.terrainColoring[t],
              resource: t,
          });
          rectGroup.add(rect);
      }
      this.tradeButtonsLayer.add(rectGroup);
      rectGroup = rectGroup.clone();
      rectGroup.setAttr('target', 'theirs');
      rectGroup.move(this.canvasWidth - this.cardWidth, 0);
      this.tradeButtonsLayer.add(rectGroup);
      this.drawTradeWindowContents();
      this.tradeWindow.draw();


      //dev
      var coloring = this.playerColoring.slice();
      coloring = (coloring.splice(this.state.getMyNum(),1)).concat(coloring);
      $('#devWindow').css({
          'border-bottom': '10px solid '+coloring[0],
          'border-left': '5px solid '+coloring[1],
          'border-top': '5px solid '+coloring[2],
          'border-right': '5px solid '+coloring[3],
      });
    },

    stateChange : function () {
      var tradeButton = $('#trade');
      var tradeClear = $('#clearTrade');
      var endTurn = $('#endTurn');

      endTurn.attr('disabled', true);
      tradeClear.attr('disabled', true);
      $('#tradeContainer').hide();
      if( !this.state.isMyTurn() ) {
        $('#roll').attr('disabled', true);
        this.hexLayer.setListening(false);
        this.edgeLayer.setListening(false);
        this.vertexLayer.setListening(false);
        this.playerLayer.setListening(false);
        this.drawHit();
        tradeButton.html('Accept Trade');
      }
      else {
        tradeClear.removeAttr('disabled');
        if(this.state.isBaronState(1)) {
          this.hexLayer.setListening(true);
          this.edgeLayer.setListening(false);
          this.vertexLayer.setListening(false);
          this.playerLayer.setListening(false);
          this.drawHit();
          log.log(0, 'BARON PHASE: You need to move the baron to a new tile.');
        }
        else if(this.state.isBaronState(2)) {
          this.hexLayer.setListening(false);
          this.edgeLayer.setListening(false);
          this.vertexLayer.setListening(false);
          this.playerLayer.setListening(true);
          this.drawHit();
          log.log(0, 'BARON PHASE: Select a player whose settlement(s) are on that tile to steal from.');
        }
        else if(this.state.isBaronState(0)) {
          tradeButton.html('Announce Trade');

          this.playerLayer.setListening(false);
          if(this.state.getRound() < 2) {
              endTurn.removeAttr('disabled');
              $('#roll').attr('disabled', true);
              this.hexLayer.setListening(false);
              this.edgeLayer.setListening(true);
              this.vertexLayer.setListening(true);
          }
          else if(this.state.getRoll()) {
              $('#tradeContainer').show();
              endTurn.removeAttr('disabled');
              $('#roll').attr('disabled', true);
              this.hexLayer.setListening(false);
              this.edgeLayer.setListening(true);
              this.vertexLayer.setListening(true);
          }
          else {
              $('#roll').removeAttr('disabled');
              this.hexLayer.setListening(false);
              this.edgeLayer.setListening(false);
              this.vertexLayer.setListening(false);
          }

          this.drawHit();
          log.log(0, 'BUILD PHASE: You can now build settlements or roads.');
        }
        else if(this.state.isBaronState(3)) { // wait for other players
          this.hexLayer.setListening(false);
          this.edgeLayer.setListening(false);
          this.vertexLayer.setListening(false);
          this.playerLayer.setListening(false);    
          this.drawHit();      
          var overflows = this.state.getOverflowPlayers().map(function (el) {
            return (el+1);
          });
          log.log(1, 'BARON PHASE: Waiting on players to discard half of their hands..('+overflows+')');
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

      for(var p = 0; p < NUM_PLAYERS; p++) {
        player = new Kinetic.Wedge(shapes[p]);
        player.setAttr('fill', this.playerColoring[p]);
        player.setAttr('player_num', p);
        if(p != this.player_num) {   
          player.on('mouseover', function () {
              if(!gb.state.isRobbable(this.getAttr('player_num')))
                return;
              this.setScale(1.5);
              gb.playerLayer.draw();
          });
          player.on('mouseleave', function () {
              if(!gb.state.isRobbable(this.getAttr('player_num')))
                  return;
              this.setScale(1);
              gb.playerLayer.draw();
          });
        }
        this.playerLayer.add(player);
      }
    },

    drawBaron : function () {
        var coords = this.state.getBaron();
        var hex = this.grid[coords[1]][coords[0]].face;
        this.baron.setAttrs({
          x: hex.getAttr('x'),
          y: hex.getAttr('y'),
          visible: true,
        })
        this.decoLayer.draw();
    },

    drawHand : function () {
       this.handLayer.removeChildren();
       var box, hand = this.state.getMyHand();
       for(var i = 0; i < hand.length; i++) {
            box = new Kinetic.Rect({
                x: (i%10)*this.cardWidth/2+20,
                y: Math.floor(i/10)*20+20,
                width: this.cardWidth,
                height: this.cardHeight,
                fill: this.terrainColoring[hand[i]],
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
                  
            this.handLayer.add(box);
       }
        var discardBtn = $('#discard');
        if((this.handLayer.getChildren().length >= OVERFLOW_HAND_SIZE && this.state.isBaronState(3))) {
            log.log(1, 'BARON PHASE: You have more than '+OVERFLOW_HAND_SIZE+' resources in your hand. You must discard half of them.');
            discardBtn.removeAttr('disabled');
            this.handLayer.setListening(true);
        }
        else {
            discardBtn.attr('disabled', true);
            this.handLayer.setListening(false);
        }
       this.handLayer.draw();
    },

    drawTradeWindowContents : function () {
        var resource, rect;
        var tradeCards = this.state.getTradeCards().sort();
        var wantCards = this.state.getWantCards().sort();
        
        this.myResourcesLayer.removeChildren();
        this.theirResourcesLayer.removeChildren();

        for(var i = 0; i < tradeCards.length; i++) {
            rect = new Kinetic.Rect({
                x: (this.cardWidth+10) + (i%10)*this.cardWidth/4,
                y: Math.floor(i/10)*this.cardHeight/4,
                width: this.cardWidth/2,
                height: this.cardHeight/2,
                fill: this.terrainColoring[tradeCards[i]],
                stroke: 'black',
                strokeWidth: 1,
                resource: tradeCards[i],
            });
            this.myResourcesLayer.add(rect);
        }

        var layerHeight = Math.floor((tradeCards.length-1)/10)*this.cardHeight/4 + this.cardHeight;
        this.myResourcesLayer.setOffsetY((-this.canvasHeight/8)+(layerHeight/2));
        this.myResourcesLayer.draw();

        for(var i = 0; i < wantCards.length; i++) {
            rect = new Kinetic.Rect({
                x: (this.canvasWidth - this.cardWidth*1.75) - (i%10)*this.cardWidth/4,
                y: Math.floor(i/10)*this.cardHeight/4,
                width: this.cardWidth/2,
                height: this.cardHeight/2,
                fill: this.terrainColoring[wantCards[i]],
                stroke: 'black',
                strokeWidth: 1,
                resource: wantCards[i],
            });
            this.theirResourcesLayer.add(rect);
        }
        layerHeight = Math.floor((wantCards.length-1)/10)*this.cardHeight/4 + this.cardHeight;
        this.theirResourcesLayer.setOffsetY((-this.canvasHeight/8)+(layerHeight/2));
        this.theirResourcesLayer.draw();

        $('#trade').attr('disabled', true);
        $('#exchange').attr('disabled', true);
        if(wantCards.length > 0 && tradeCards.length > 0 && this.state.getRoll()) {
            $('#trade').removeAttr('disabled');
            if(this.state.isMyTurn())
                $('#exchange').removeAttr('disabled');
        }
    },

    drawDevs : function () {
        this.tableLayer.removeChildren();
        var playerShownDevs, devHand, dev;
        var points = [
            [this.canvasWidth/2, 13/8*this.cardHeight],
            [this.cardHeight/4, this.cardHeight],
            [this.canvasWidth/2, this.cardHeight/4],
            [this.canvasWidth-this.cardHeight/4, this.cardHeight],
        ];
        for(var p = 0; p < NUM_PLAYERS; p++) {
            playerShownDevs = new Kinetic.Group({
              x: points[p][0],
              y: points[p][1],
              player_num: p, 
            });
            
            if(p == 0) {
              devHand = this.state.getDev(this.state.getMyNum())
                          .filter(function(dev) {return (dev < 0);})
                          .map(function(dev) {return dev*-1;});
            }
            else if(p == this.state.getMyNum())
              devHand = this.state.getDev(0);
            else
              devHand = this.state.getDev(p);

            devHand = devHand.sort();
            for(var i = 0; i < devHand.length; i++) {
              dev = devHand[i];
              dev = dev > 0 ? dev : -1*dev;
              playerShownDevs.add(new Kinetic.Rect({
                x: i*this.cardWidth/8,
                y: 0,
                width: this.cardWidth/4,
                height: this.cardHeight/4,
                fill: this.devColoring[dev],
                stroke: 'black', 
                strokeWidth: 1,
              }));
            }

            playerShownDevs.setAttrs({
              offsetX: devHand.length*this.cardWidth/16,
              offsetY: this.cardHeight/8,
              rotationDeg: p*90,
            });
            this.tableLayer.add(playerShownDevs);
        }
        this.tableLayer.draw();

        this.hiddenLayer.removeChildren();
        var myDevs = this.state.getDev(this.state.getMyNum())
                      .filter(function(dev) {return (dev > 0)}).sort();
        var card;
        for(var i = 0; i < myDevs.length; i++) {
            card = new Kinetic.Rect({
                x: i*this.cardWidth/2,
                y: 0,
                width: this.cardWidth,
                height: this.cardHeight,
                fill: this.devColoring[myDevs[i]],
                stroke: 'black',
                strokeWidth: 2,
                selected: false,
            });
            card.on('mouseover', function (evt) {
               if(!this.getAttr('selected')) {
                   this.move(0, -10);
                  gb.hiddenLayer.draw();
               }
            });
            card.on('mouseout', function (evt) {
              if(!this.getAttr('selected')) {
                   this.move(0, 10);
                  gb.hiddenLayer.draw();
              }
            });
            this.hiddenLayer.add(card);
        }
        this.hiddenLayer.setOffsetX(-(this.canvasWidth/2-myDevs.length*this.cardWidth/4))
        this.hiddenLayer.draw();
    },

    drawRoad : function (edge) {
      var gridObject = this.grid[edge[1]][edge[0]];
      var line;
      for(var i = 0; i < gridObject.edges.length; i++) {
         line = gridObject.edges[i];
         if(line.getAttr('coords')[2] == edge[2]) {
            line.setStroke(this.playerColoring[this.state.getCurrentPlayer()]);
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
            circle.setFill(this.playerColoring[this.state.getCurrentPlayer()]);
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
                    fill: this.playerColoring[this.state.getCurrentPlayer()],
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
        gb.playerLayer.getChildren().each(function (node, i) {
          var currentPlayer = gb.state.getCurrentPlayer();
          if(parseInt(node.getAttr('player_num')) == currentPlayer) {
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

   useDev : function (devNum) {
      // if(devNum == 1) {     // knight
        
      // }
      if(devNum == 2) {    // road building

      }
      else if(devNum == 3) {    // year of plenty

      }
      else if(devNum == 4) {    // monopoly

      }      
   },
};

socket.on('full', function () {
  alert('Sorry, this instance is full!');
});

socket.on('state', function (data) {
    log = new Log();
    log.log(0, 'You have joined the game as Player '+(data.state.player_num+1));
    log.log(0, 'It is currently Player '+(data.state.currentPlayer+1)+'\'s turn.');
    gb = new GraphicalBoard(data.gW, data.gH, data.state, data.player_num);
    gb.updatePlayers();
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
    gb.state.setRoll(data.roll);
    gb.stateChange();
    log.log(1, 'Player '+(gb.state.getCurrentPlayer()+1)+' has rolled a '+data.roll+'.');
});

// Baron
socket.on('promptBaronMove', function (data) {
    gb.state.setBaronState(data.baronState);
    gb.stateChange();
});
socket.on('promptBaronSteal', function (data) {
    gb.state.setBaronState(data.baronState);
    gb.state.setRobbablePlayers(data.robbable);
    gb.stateChange();
});
socket.on('baronFinish', function (data) {
    gb.state.setBaronState(data.baronState);
    gb.stateChange();
});

socket.on('moveBaron', function (data) {
    gb.state.placeBaron(data.coords);
    gb.stateChange();
    gb.drawBaron();
    log.log(1, 'BARON PHASE: The baron has been moved!');
});

socket.on('overflowNotice', function (data) {
    gb.state.setBaronState(data.baronState);
    gb.stateChange();
    gb.drawHand();
});
socket.on('overflowWait', function (data) {
    gb.state.setOverflowPlayers(data.overflowPlayers);
    gb.state.setBaronState(data.baronState);
    gb.stateChange();
});


socket.on('gain', function (data) {
    gb.state.giveResources(gb.state.getMyNum(), data.cardsAdded);
    gb.drawHand();

    if(data.action == 'roll')
      log.log(1, 'ROLL PHASE: Resources have been distributed for the roll.');
    else if(data.action == 'steal')
      log.log(0, 'BARON PHASE: You have stolen resources from Player '+(data.oppPlayer+1));
    else if(data.action == 'admin')
      log.log(0, 'You have given yourself resources.');
    else if(data.action == 'trade')
      log.log(0, 'TRADING: You have gained resources from the current player.');
    else if(data.action == 'exchange')
      log.log(0, 'EXCHANGE: You have lost resources from exchanging.');
});

socket.on('deduct', function (data) {
    gb.state.setHand(gb.state.getMyNum(), data.hand);
    gb.drawHand();  

    if(data.action == 'build')
        log.log(0, 'BUILD PHASE: You have lost resources from building.');
    else if(data.action == 'steal')
        log.log(0, 'BARON PHASE: You have had some of your resources stolen.');
    else if(data.action == 'overflow')
        log.log(0, 'BARON PHASE: You have handed over your overflow resources.');
    else if(data.action == 'trade')
        log.log(0, 'TRADING: You have given your resources to the current player.');
    else if(data.action == 'exchange')
        log.log(0, 'EXCHANGE: You have lost resources from exchanging.');
      
});

socket.on('tradeEnd', function () {
    log.log(1, 'TRADING: The announced trade has been accepted.');
    gb.state.setTradeCards([]);
    gb.state.setWantCards([]);
    gb.stateChange();
    gb.drawTradeWindowContents();
})
;
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
    // else if(data.type == 'dev')
    log.log(1, 'BUILD PHASE: Player ' + (gb.state.getCurrentPlayer() + 1) + ' has built a ' + data.type + '@' + data.coords);
});

socket.on('tradeAnnounce', function (data) {
    gb.state.setTradeCards(data.cardsGain);
    gb.state.setWantCards(data.cardsDeduct);
    $('#tradeContainer').show();
    gb.drawTradeWindowContents();
});

socket.on('devGain', function (data) {
   gb.state.giveDev(gb.state.getCurrentPlayer(), data.devNum);
   if(data.action == 'admin')
        gb.state.flushDevQueue();
   gb.drawDevs();
});

socket.on('useDev', function (data) {
    if(gb.state.isMyTurn()) {
        gb.state.activateDev(gb.state.getCurrentPlayer(), data.devNum);
        gb.useDev(data);
    }
    else
        gb.state.activateDev(gb.state.getCurrentPlayer(), 0, data.devNum);
    gb.stateChange();
    gb.drawDevs();
});

socket.on('nextTurn', function (data) {
    log.log(1, 'Player ' + (gb.state.getCurrentPlayer()+1) + ' has ended their turn.');
    gb.state.flushDevQueue();
    gb.state.setCurrentPlayer(data.currentPlayer);
    gb.updatePlayers();

    gb.state.setTradeCards([]);
    gb.state.setWantCards([]);

    gb.state.setRound(data.round);
    gb.state.setOverflowPlayers([]);
    gb.state.setBaronState(0);
    gb.state.setRoll(0);

    gb.stateChange();
    gb.drawTradeWindowContents();
    gb.drawDevs();

    if(data.round < 2 && gb.state.isMyTurn()) {
        if(gb.state.getMyNum() == NUM_PLAYERS - 1) 
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
    $('#roll').click(function (evt) {
      socket.emit('roll', {});
      log.log(0, '> ROLL');
    })

   $('#endTurn').click(function (evt) {
      socket.emit('endTurn', {});
      log.log(0, '> END TURN');
   });

   $('#giveResource').click(function (evt) {
        var resType = parseInt($('#resource').val());
       socket.emit('giveResource', {resource: resType});
       log.log(0, '> GIVE RESOURCE '+resType);
   });

  $('#giveDev').click(function (evt) {
       socket.emit('giveDev', {});
       log.log(0, '> GRAB DEV');
   });

   $('#discard').click(function (evt) {
      var cardsDiscard = [];
      gb.handLayer.getChildren().each(function (card, idx) {
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
      log.log(0, 'Player '+(gb.state.getMyNum()+1)+': '+text);
      $(this).val('');
     }
   });

   $('#trade').click(function (evt) {
      if(gb.state.isMyTurn()) {
          var tradeCards = gb.state.getTradeCards();
          var wantCards = gb.state.getWantCards();

          socket.emit('tradeAnnounceRequest', {
              tradeCards: tradeCards,
              wantCards: wantCards,
          });
          log.log(0, '> ANNOUNCE TRADE '+tradeCards+' for '+wantCards);
      }
      else {
        socket.emit('tradeAccept', {});
        log.log(0, '> ACCEPT TRADE');
      }
   });

   $('#exchange').click(function (evt) {
      var tradeCards = gb.state.getTradeCards();
      var wantCards = gb.state.getWantCards();

      socket.emit('exchangeRequest', {
          tradeCards: tradeCards,
          wantCards: wantCards,
      });
      log.log(0, '> EXCHANGE '+tradeCards+' for '+wantCards);
   });   

   $('#clearTrade').click(function (evt) {
      gb.state.setTradeCards([]);
      gb.state.setWantCards([]);

      gb.drawTradeWindowContents();      
   });

   $('#buyDev').click(function (evt) {
      socket.emit('buildRequest', {
          type: 'dev',
      });
      log.log(0, '> BUY DEV');
   });

   $('#useDev').click(function (evt) {
      socket.emit('useDevRequest', {
        devNum: 1,
      });
      log.log(0, '> USE KNIGHT');
   });
});

