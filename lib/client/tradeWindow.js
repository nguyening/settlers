var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;

var cardWidth = 50,
	cardHeight = 75,
	canvasWidth = 500,
	canvasHeight = cardHeight*1.5;

var cardColoring = ['brown', 'chartreuse', 'grey', 'gold', 'forestgreen', 'grey'];

var tradeWindow = function (state) {
	var self = this,
		stage = new Kinetic.Stage({
			container: 'tradeWindow',
			width: canvasWidth,
			height: canvasHeight,
		}),
		tradeButtonsLayer = new Kinetic.Layer(),
		myResourcesLayer = new Kinetic.Layer(),
		theirResourcesLayer = new Kinetic.Layer();

	stage.add(tradeButtonsLayer);
	stage.add(myResourcesLayer);
	stage.add(theirResourcesLayer);

	this.init = function () {
		var row, 
			col, 
			rect,
			rectGroup = new Kinetic.Group({
				target: 'mine',
			});

		for(var t = 0; t < cardColoring.length - 1; t++) { // dont draw desert
			col = t%2;
			row = t%3;
			rect = new Kinetic.Rect({
				x: col*cardWidth/2,
				y: row*cardHeight/2,
				width: cardWidth/2,
				height: cardHeight/2,
				fill: cardColoring[t],
				resource: t,
			});
			rectGroup.add(rect);
		}
		tradeButtonsLayer.add(rectGroup);

		rectGroup = rectGroup.clone();
		rectGroup.setAttr('target', 'theirs');
		rectGroup.move(canvasWidth - cardWidth, 0);
		tradeButtonsLayer.add(rectGroup);
		
		self.draw();
	};


	this.draw = function () {
		myResourcesLayer.removeChildren();
		theirResourcesLayer.removeChildren();

		var resource, 
			rect,
			tradeCards = state.getTradeCards().sort(),
			wantCards = state.getWantCards().sort(),
			layerHeight = Math.floor(tradeCards.length/10)*cardHeight/4 + cardHeight;

		// drawing trade cards
		for(var i = 0; i < tradeCards.length; i++) {
			rect = new Kinetic.Rect({
				x: (cardWidth+10) + (i%10)*cardWidth/4,
				y: Math.floor(i/10)*cardHeight/4,
				width: cardWidth/2,
				height: cardHeight/2,
				fill: cardColoring[tradeCards[i]],
				stroke: 'black',
				strokeWidth: 1,
				resource: tradeCards[i],
			});
			myResourcesLayer.add(rect);
		}

		myResourcesLayer.setOffsetY((-canvasHeight/2)+(layerHeight/4));

		// drawing want cards
		for(var i = 0; i < wantCards.length; i++) {
			rect = new Kinetic.Rect({
				x: (canvasWidth - cardWidth*1.75) - (i%10)*cardWidth/4,
				y: Math.floor(i/10)*cardHeight/4,
				width: cardWidth/2,
				height: cardHeight/2,
				fill: cardColoring[wantCards[i]],
				stroke: 'black',
				strokeWidth: 1,
				resource: wantCards[i],
			});
			theirResourcesLayer.add(rect);
		}

		layerHeight = Math.floor(wantCards.length/10)*cardHeight/4 + cardHeight;
		theirResourcesLayer.setOffsetY((-canvasHeight/2)+(layerHeight/4));

		// drawing non-static buttons
        var tradeButton = $('#trade'),
	        tradeCancel = $('#cancelTrade'),
	        tradeExchg = $('#exchange');

		tradeButton.attr('disabled', true);
		tradeExchg.attr('disabled', true);
        tradeCancel.attr('disabled', true);

        if( !state.isMyTurn() ) {
            tradeButton.html('Accept Trade');
            
            if(wantCards.length > 0 && tradeCards.length > 0)						//conditions for accepting trade
				tradeButton.removeAttr('disabled');
        }
        else {
            tradeButton.html('Announce Trade');

			if(wantCards.length > 0 && tradeCards.length > 0 && state.getRoll()) {	//conditions for announcing
				tradeButton.removeAttr('disabled');
				tradeExchg.removeAttr('disabled');
			}
			else if(state.getActiveDev() == 3 && 
					wantCards.length == 2 && 
					tradeCards.length == 0) {
					tradeExchg.removeAttr('disabled');		
	        }
		}
		
        stage.draw();
	};

	//************************************************************************
	//  EVENT HANDLERS
	//************************************************************************
	
	tradeButtonsLayer.on('click', function (evt) {
		if(!state.isMyTurn()) return;

		var button = evt.targetNode,
			target = button.getParent().getAttr('target'),
			resource = button.getAttr('resource');

		if(target == 'mine') {
			state.setTradeCards(state.getTradeCards().concat(resource));
		}
		else if(target == 'theirs') {
			state.setWantCards(state.getWantCards().concat(resource));   
		}

		self.draw();
	});

	myResourcesLayer.on('click', function (evt) {
		var card = evt.targetNode;
		var tradeCards = state.getTradeCards();
		tradeCards.splice(tradeCards.indexOf(card.getAttr('resource')), 1);

		state.setTradeCards(tradeCards);
		self.draw();
	});

	theirResourcesLayer.on('click', function (evt) {
		var card = evt.targetNode;
		var wantCards = state.getWantCards();
		wantCards.splice(wantCards.indexOf(card.getAttr('resource')), 1);

		state.setWantCards(wantCards);
		self.draw();
	});


	$('#trade').click(function (evt) {
		if(state.isMyTurn()) {
			var tradeCards = state.getTradeCards(),
				wantCards = state.getWantCards();

			$.event.trigger({
				type: 'trade:announce',
				args: {
					tradeCards: tradeCards,
					wantCards: wantCards,
				},
			});

			$('#cancelTrade').removeAttr('disabled');
		}
		else {
			$.event.trigger({
				type: 'trade:accept',
				args: {},
			});
		}
	});

	$('#exchange').click(function (evt) {
		var tradeCards = state.getTradeCards();
		var wantCards = state.getWantCards();

		$.event.trigger({
			type: 'trade:exchange',
			args: {
				tradeCards: tradeCards,
				wantCards: wantCards,
			},
		});
	});   

	$('#cancelTrade').click(function (evt) {
		$.event.trigger({
			type: 'trade:cancel',
			args: {},
		});

		self.draw();
	});	

	self.init();
};

exports.tradeWindow = tradeWindow;