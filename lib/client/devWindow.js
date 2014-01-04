var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;

var cardWidth = 35,
	cardHeight = 50,
	canvasWidth = 500,
	canvasHeight = cardHeight*3;

var devColoring = ['grey', 'darkred', 'greenyellow', 'greenyellow', 'greenyellow', 'yellow'],
	devLabeling = ['Unknown', 'Knight', 'Road Building', 'Year of Plenty', 'Monopoly', 'Victory Point'],
    playerColoring = ['red', 'blue', 'yellow', 'white'];

var devWindow = function (state) {
    var self = this,
        stage = new Kinetic.Stage({
	    	container: 'devWindow',
	    	width: canvasWidth,
	    	height: canvasHeight,
	    }),
	    tableBorder = new Kinetic.Layer(),
	    tableLayer = new Kinetic.Layer(),
	    hiddenLayer = new Kinetic.Layer({
            x: canvasWidth/2,
	    	y: cardHeight*2,
	    });

    stage.add(tableBorder);
    stage.add(tableLayer);
    stage.add(hiddenLayer);

    this.init = function () {
        playerColoring = (playerColoring.splice(state.getMyNum(),1)).concat(playerColoring);
        $('#devWindow').css({
            'border-bottom': '15px solid '+playerColoring[0],
            'border-left': '5px solid '+playerColoring[1],
            'border-top': '5px solid '+playerColoring[2],
            'border-right': '5px solid '+playerColoring[3],
        });

        self.draw();
    }


    this.draw = function () {

        //************************************************************************
        //  ACTIVE DEVELOPMENT CARDS
        //************************************************************************
            
    	tableLayer.removeChildren();

    	var playerShownDevs, 
            devHand, 
            dev,
            points = [
    	    	[canvasWidth/2, 13/8*cardHeight],
    	    	[cardHeight/4, cardHeight],
    	    	[canvasWidth/2, cardHeight/4],
    	    	[canvasWidth-cardHeight/4, cardHeight],
        	];

    	for(var p = 0; p < NUM_PLAYERS; p++) {
    		playerShownDevs = new Kinetic.Group({
    			x: points[p][0],
    			y: points[p][1],
    			player_num: p, 
    		});

    		// swap first position with your hand
    		if(p == 0) {
    			devHand = state.getDev(state.getMyNum())
	    			.filter(function(dev) {return (dev < 0);})
	    			.map(function(dev) {return dev*-1;});
    		}
    		else if(p == state.getMyNum())
    			devHand = state.getDev(0);
    		else
    			devHand = state.getDev(p);
    		
    		devHand = devHand.sort();

    		for(var i = 0; i < devHand.length; i++) {
    			dev = devHand[i];
    			dev = dev > 0 ? dev : -1*dev;

    			playerShownDevs.add(new Kinetic.Rect({
    				x: i*cardWidth/8,
    				y: 0,
    				width: cardWidth/4,
    				height: cardHeight/4,
    				fill: devColoring[dev],
    				stroke: 'black', 
    				strokeWidth: 1,
    			}));
    		}

    		playerShownDevs.setAttrs({
    			offsetX: devHand.length*(cardWidth)/16,
    			offsetY: cardHeight/8,
    			rotationDeg: p*90,
    		});
    		tableLayer.add(playerShownDevs);
    	}
    	// tableLayer.draw();

        //************************************************************************
        //  INACTIVE DEVELOPMENT CARDS
        //************************************************************************
                  
    	hiddenLayer.removeChildren();
    	var card,
            inactiveDevs = state.getDev(state.getMyNum())
                .filter(function(dev) {return (dev > 0)}).sort(),
            trueInactiveLength = inactiveDevs.length;

        if(state.isMyTurn()) { //only draw queue in hidden layer for current player
            inactiveDevs = inactiveDevs.concat(state.getDevQueue().sort());
        }

		for(var i = 0; i < inactiveDevs.length; i++) {
			card = new Kinetic.Rect({
				x: i*(cardWidth)/2,
				y: 0,
				width: cardWidth,
				height: cardHeight,
				fill: devColoring[inactiveDevs[i]],
				stroke: 'black',
				strokeWidth: 2,
				selected: false,
				devNum: inactiveDevs[i],
				opacity: (i < trueInactiveLength) ? 1 : 0.5,
            });
			hiddenLayer.add(card);
		}
		hiddenLayer.setOffsetX((inactiveDevs.length+1)*(cardWidth)/4);
		// hiddenLayer.draw();


        //************************************************************************
        //  BUTTONS
        //************************************************************************

        var buyDev = $('#buyDev');
        var useDev = $('#useDev');

        buyDev.attr('disabled', true);
        useDev.attr('disabled', true);

        if( !state.isMyTurn() ) {

        }
        else {
            if(state.isBaronState(0)) {
                if(state.getRoll())
                    buyDev.removeAttr('disabled');

                if(trueInactiveLength.length)
                    useDev.removeAttr('disabled');
            }
        }

        stage.draw();
    };

    //************************************************************************
    //  EVENT HANDLERS
    //************************************************************************
    
    hiddenLayer.on('click', function (evt) {
        var thisCard = evt.targetNode;
        var oldVal = thisCard.getAttr('selected');
        this.getChildren().each(function (card) {
            card.setAttrs({
                selected: false,
                y: 0,
            });
        });
        thisCard.setAttrs({
            selected: !oldVal,
            y: -10,
        });
        hiddenLayer.draw();
    })
    .on('mouseover', function (evt) {
        var card = evt.targetNode,
            label = new Kinetic.Text({
                x: canvasWidth/2,
                y: cardHeight,
                text: devLabeling[card.getAttr('devNum')],
                fill: 'black',
                fontSize: 12,
                fontFamily: 'Calibri',
                align: 'center',
            });
            label.setOffsetX(label.getWidth()/2);

        card.setAttr('label', label);
        tableBorder.add(label);
        if(!card.getAttr('selected')) {
            card.move(0, -10);
            hiddenLayer.draw();
        }
        tableBorder.draw();
    })
    .on('mouseout', function (evt) {
        var card = evt.targetNode;

        card.getAttr('label').remove();
        if(!card.getAttr('selected')) {
            card.move(0, 10);
            hiddenLayer.draw();
        }
        tableBorder.draw();
    });

    $('#buyDev').click(function (evt) {
        $.event.trigger({
            type: 'dev:buy',
            args: {},
        });
    });

    $('#useDev').click(function (evt) {
        var devNum = hiddenLayer.getChildren().filter(function (card) {
            return card.getAttr('selected');
        })[0].getAttr('devNum');

        $.event.trigger({
            type: 'dev:use',
            args: {devNum: devNum},
        });
    });

    self.init();
};

exports.devWindow = devWindow;