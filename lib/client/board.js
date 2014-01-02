var Globals = require('/lib/globals.js').Globals;
var HexagonGrid = require('/lib/hexgrid.js').HexagonGrid;

var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;

var gridWidth = 6,
    gridHeight = 7,
    canvasWidth = 500,
    canvasHeight = 500,

    hexRadius = 50,
    hexWidth = 2*hexRadius*Math.cos(30 * Math.PI / 180),
    hexHeight = hexRadius*1.5,
    cardWidth = 50,
    cardHeight = 75,
    cardBaseY = 520,

    offsetX = hexRadius/4,
    offsetY = 0,

    hexEdgeThickness = 2,
    hexVertexRadius = 8,
    defaultVertexFill = 'black',
    defaultEdgeStroke = 'black',
    terrainColoring = ['brown', 'chartreuse', 'grey', 'gold', 'forestgreen', 'white'],
    playerColoring = ['red', 'blue', 'yellow', 'white'];

var Board = function (state) {
    var self = this,
        grid = [],
        stage = new Kinetic.Stage({
            container: 'board',
            width: canvasWidth,
            height: canvasHeight
        }),
        hexLayer = new Kinetic.Layer({
            offsetX : offsetX,
            offsetY : offsetY,
        }),
        edgeLayer = new Kinetic.Layer({
            offsetX : offsetX,
            offsetY : offsetY,
        }),
        vertexLayer = new Kinetic.Layer({
            offsetX : offsetX,
            offsetY : offsetY,
        }),
        playerLayer = new Kinetic.Layer(),
        decoLayer = new Kinetic.Layer(),
        baron = new Kinetic.RegularPolygon({
            x: 0,
            y: 0,
            sides: 6,
            visible: false,
            radius: hexRadius/4,
            offsetX: offsetX,
            offsetY: offsetY,
            fill: 'black',
        });

    decoLayer.add(baron);
    stage.add(hexLayer);
    stage.add(edgeLayer);
    stage.add(playerLayer);
    stage.add(decoLayer);
    stage.add(vertexLayer);

    this.init = function () {

        //************************************************************************
        //  DRAWING BOARD
        //************************************************************************
        
        var gridObject,

            hexGroup,
            hex,
            line,
            circle,
            text,
            edge_vertices,
            edge,
            vertices,
            vertex,

            _x,
            _y,
            x_offset,
            y_offset,
            coords,

            row,
            color,
            city_flag,
            finalEdgeThickness,
            harborNum;

        for(var i = 0; i < gridHeight; i++) {
            row = [];

            for(var j = 0; j < gridWidth; j++) {
                gridObject = {
                    face : null,
                    edges : [],
                    vertices : [],
                };
                _x = (2 * j + 1 + (i&1)) * (hexWidth/2); // offset by one if odd row
                _y = (2 * i + 1) * (hexHeight/2);


                // drawing hex tiles if they're a part of the map
                if(!Globals.isUnusedFace([j, i])) {
                    hexGroup = new Kinetic.Group({
                        x: _x, 
                        y: _y, 
                        coords: [j, i]
                    }),
                    hex = new Kinetic.RegularPolygon({
                        x: 0,
                        y: 0,
                        sides: 6,
                        radius: hexRadius,
                        fill: terrainColoring[state.grid[i][j].resource],
                    }),
                    text = new Kinetic.Text({
                        x: 0,
                        y: 0,
                        text: ''+state.grid[i][j].roll,//+' ('+j+', '+i+')',
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
                    gridObject.face = hexGroup;
                    hexLayer.add(hexGroup);
                }

                // drawing hexagon edges (N, W, S)
                x_offset = hexRadius * Math.cos(30 * Math.PI / 180),
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
                            color = playerColoring[l];
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

                    gridObject.edges.push(line);
                    edgeLayer.add(line);

                    harborNum = Globals.getHarborNum(coords);
                    if(harborNum != -1) {                                  
                        color = terrainColoring[state.getHarborAssignments()[harborNum]] || 'purple';
                        line = new Kinetic.Line({
                            points: edge,
                            stroke: color,
                            strokeWidth: hexEdgeThickness*5,
                            offsetX: offsetX,
                            offsetY: offsetY,
                        });

                        if(coords[2] == 'N') {
                            if(edge[0][1] > canvasHeight/2) {
                                line.move(7, 10);
                            }
                            else {
                                line.move(-10, -10);
                            }
                        }
                        else if(coords[2] == 'W') {
                            if(edge[0][0] > canvasWidth/2) {
                                line.move(10, 0);
                            }
                            else {
                                line.move(-10, 0);
                            }
                        }
                        else if(coords[2] == 'S') {
                            if(edge[0][1] > canvasHeight/2) {
                                line.move(-5, 10);
                            }
                            else {
                                line.move(5, -10);
                            }
                        }
                        decoLayer.add(line);
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
                            color = playerColoring[l];

                            if(state.cities[l].toString().indexOf(coords.toString()) != -1) {
                                city_flag = true;
                            }

                            break;
                        }
                    }

                    color = color || defaultVertexFill;
                    if(city_flag) {
                        circle  = new Kinetic.Star({
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
                    }

                    gridObject.vertices.push(circle);
                    vertexLayer.add(circle);
                }

                row.push(gridObject);
            }

            grid.push(row);
        }

        //************************************************************************
        //  DRAWING PLAYER MARKERS
        //************************************************************************
        
        var player,
            shapes = [
                {
                    x: 0,
                    y: 0,
                    radius: 75,
                    angleDeg: 90,
                    fill: 'green',
                }, 
                {
                    x: canvasWidth+15,
                    y: 0,
                    radius: 75,
                    angleDeg: 90,
                    rotationDeg: 90,
                    fill: 'green',
                }, 
                {
                    x: 0,
                    y: canvasWidth,
                    radius: 75,
                    angleDeg: 90,
                    rotationDeg: -90,
                    fill: 'green'
                }, 
                {
                    x: canvasWidth,
                    y: canvasWidth,
                    radius: 75,
                    angleDeg: 90,
                    rotationDeg: 180,
                    fill: 'green'
                }, 
            ];

        for(var p = 0; p < NUM_PLAYERS; p++) {
            player = new Kinetic.Wedge(shapes[p]);
            player.setAttr('fill', playerColoring[p]);
            player.setAttr('player_num', p);
            playerLayer.add(player);
        }

        self.draw();
    };

    this.draw = function () {

        //************************************************************************
        //  CURRENT PLAYER
        //************************************************************************

        playerLayer.getChildren().each(function (node, i) {
            var currentPlayer = state.getCurrentPlayer();

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

        //************************************************************************
        //  BARON
        //************************************************************************

        var coords = state.getBaron(),
            hex = grid[coords[1]][coords[0]].face;

        baron.setAttrs({
            x: hex.getAttr('x'),
            y: hex.getAttr('y'),
            visible: true,
        }); 

        //************************************************************************
        //  CLICKABLE ELEMENTS
        //************************************************************************
            
        if( !state.isMyTurn() ) {
            hexLayer.setListening(false);
            edgeLayer.setListening(false);
            vertexLayer.setListening(false);
            playerLayer.setListening(false);
        }
        else {
            if(state.isBaronState(1)) {
                hexLayer.setListening(true);
                edgeLayer.setListening(false);
                vertexLayer.setListening(false);
                playerLayer.setListening(false);
            }
            else if(state.isBaronState(2)) {
                hexLayer.setListening(false);
                edgeLayer.setListening(false);
                vertexLayer.setListening(false);
                playerLayer.setListening(true);
            }
            else if(state.isBaronState(0)) {
                playerLayer.setListening(false);

                if(state.getRound() < 2) {
                    hexLayer.setListening(false);
                    edgeLayer.setListening(true);
                    vertexLayer.setListening(true);
                }
                else if(state.getRoll()) {
                    hexLayer.setListening(false);
                    edgeLayer.setListening(true);
                    vertexLayer.setListening(true);
                }
                else {
                    hexLayer.setListening(false);
                    edgeLayer.setListening(false);
                    vertexLayer.setListening(false);
                }

            }
            else if(state.isBaronState(3)) { // wait for other players
                hexLayer.setListening(false);
                edgeLayer.setListening(false);
                vertexLayer.setListening(false);
                playerLayer.setListening(false);    
            }
        }

        stage.draw();
    };

    this.add = function (structure, coords) {
        var shape,
            gridObject = grid[coords[1]][coords[0]];

        if(structure == 'road') {
            for(var i = 0; i < gridObject.edges.length; i++) {
                shape = gridObject.edges[i];

                if(shape.getAttr('coords')[2] == coords[2]) {
                    shape.setStroke(playerColoring[state.getCurrentPlayer()]);
                    edgeLayer.draw();
                    break;
                }
            }
        }
        else if(structure == 'settlement') {
            for(var i = 0; i < gridObject.vertices.length; i++) {
                shape = gridObject.vertices[i];

                if(shape.getAttr('coords')[2] == coords[2]) {
                    shape.setFill(playerColoring[state.getCurrentPlayer()]);
                    shape.setOpacity(1);
                    vertexLayer.draw();
                    break;
                }
            }
        }
        else if(structure == 'city') {
            var star;

            for(var i = 0; i < gridObject.vertices.length; i++) {
                shape = gridObject.vertices[i];

                if(shape.getAttr('coords')[2] == coords[2]) {
                    star  = new Kinetic.Star({
                        x: shape.getAttr('x'),
                        y: shape.getAttr('y'),
                        numPoints: 6,
                        innerRadius: hexVertexRadius,
                        outerRadius: hexVertexRadius*2,
                        fill: playerColoring[state.getCurrentPlayer()],
                        stroke: 'black',
                        strokeWidth: 1,
                    });
                    shape.remove();
                    vertexLayer.add(star);
                    vertexLayer.draw();
                    break;
                }
            }
        }
    };

    //************************************************************************
    //  EVENT HANDLERS
    //************************************************************************

    hexLayer.on('click', function (evt) {
        var hex = evt.targetNode.getParent();   // text and hexagon are both in a group

        $.event.trigger({
            type: 'baron:move',
            args: {
                coords: hex.getAttr('coords'),
            },
        });
    })
    .on('mouseover', function (evt) {
        var hex = evt.targetNode.getParent(),
            tempBaron = new Kinetic.RegularPolygon({
                x: hex.getAttr('x'),
                y: hex.getAttr('y'),
                sides: 6,
                radius: hexRadius/4,
                fill: 'black',
                opacity: 0.5,
                offsetX: offsetX,
                offsetY: offsetY,
            });

        baron.setAttr('tempBaron', tempBaron);
        decoLayer.add(tempBaron);
        decoLayer.draw();
    })
    .on('mouseout', function (evt) {
        // var hex = evt.targetNode.getParent();

        baron.getAttr('tempBaron')
            .remove();
        decoLayer.draw();
    });

    edgeLayer.on('click', function (evt) {
        var line = evt.targetNode,
            coords = line.getAttr('coords');

        if(line.getAttr('stroke') == defaultEdgeStroke) {
            $.event.trigger({
                type: 'build',
                args: {
                    type: 'road',
                    coords: coords,
                },
            });
        }
    })
    .on('mouseover', function (evt) {
        var line = evt.targetNode;

        if( (line.getAttr('stroke') != defaultEdgeStroke && 
            line.getAttr('stroke') != playerColoring[state.getMyNum()]) )
            return;

        line.setStrokeWidth(line.getStrokeWidth()*5);
        edgeLayer.draw();
    })
    .on('mouseout', function (evt) {
        var line = evt.targetNode;

        if( (line.getAttr('stroke') != defaultEdgeStroke && 
            line.getAttr('stroke') != playerColoring[state.getMyNum()]) )
            return;

        line.setStrokeWidth(line.getStrokeWidth()/5);
        edgeLayer.draw();
    });

    vertexLayer.on('click', function (evt) {
        var circle = evt.targetNode,
            coords = circle.getAttr('coords');

        if(circle.getAttr('fill') != defaultVertexFill) {
            $.event.trigger({
                type: 'build',
                args: {
                    type: 'city',
                    coords: coords
                },
            });
        }
        else {
            $.event.trigger({
                type: 'build',
                args: {
                    type: 'settlement',
                    coords: coords
                },
            });
        }
    })
    .on('mouseover', function (evt) {
        var circle = evt.targetNode;

        if( (circle.getAttr('fill') != defaultVertexFill && 
            circle.getAttr('fill') != playerColoring[state.getMyNum()]) )
            return;

        circle.setAttrs({
            opacity: 1,
            radius: hexVertexRadius*3,
            stroke: 'black',
            strokeWidth: 2,
        });
        vertexLayer.draw();
    })
    .on('mouseout', function (evt) {
        var circle = evt.targetNode;

        if( (circle.getAttr('fill') != defaultVertexFill && 
            circle.getAttr('fill') != playerColoring[state.getMyNum()]) )
            return;

        circle.setAttrs({
            opacity: (circle.getAttr('fill') == defaultVertexFill) ? 0 : 1,
            radius: hexVertexRadius,
            stroke: null,
            strokeWidth: 0,
        });
        vertexLayer.draw();
    });

    playerLayer.on('click', function (evt) {
        var wedge = evt.targetNode,
            p = wedge.getAttr('player_num');

        if(!state.isRobbable(p) || p == state.getMyNum())
            return;

        if(state.isBaronState(2))
            $.event.trigger({
                type: 'baron:steal',
                args: {
                    player_num: p,
                },
            });
    })
    .on('mouseover', function (evt) {
        var wedge = evt.targetNode,
            p = wedge.getAttr('player_num');

        if(!state.isRobbable(p) || p == state.getMyNum())
            return;

        wedge.setScale(1.5);
        playerLayer.draw();
    })
    .on('mouseout', function (evt) {
        var wedge = evt.targetNode,
            p = wedge.getAttr('player_num');

        if(!state.isRobbable(p) || p == state.getMyNum())
            return;

        wedge.setScale(1);
        playerLayer.draw();
    });

    self.init();
};

exports.Board = Board;