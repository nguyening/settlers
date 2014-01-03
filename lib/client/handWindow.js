var NUM_PLAYERS = 4;
var OVERFLOW_HAND_SIZE = 7;

var cardWidth = 50,
	cardHeight = 75,
	canvasWidth = 300,
	canvasHeight = cardHeight*1.75;

var cardColoring = ['brown', 'chartreuse', 'grey', 'gold', 'forestgreen', 'grey'];

var handWindow = function (state) {
	var self = this,
		stage = new Kinetic.Stage({
			container: 'handWindow',
			width: canvasWidth,
			height: canvasHeight,
		}),
		handLayer = new Kinetic.Layer();

	stage.add(handLayer);

	this.init = function () {
		self.draw();
	};

	this.draw = function () {
		handLayer.removeChildren();

		var box, 
			hand = state.getMyHand().sort();

		for(var i = 0; i < hand.length; i++) {
			box = new Kinetic.Rect({
				x: (i%10)*cardWidth/2+20,
				y: Math.floor(i/10)*20+20,
				width: cardWidth,
				height: cardHeight,
				fill: cardColoring[hand[i]],
				stroke: 'black',
				strokeWidth: 2,
				resource: hand[i],
				selected: false,
			});

			handLayer.add(box);
		}
		
		var discardBtn = $('#discard');
		if((handLayer.getChildren().length >= OVERFLOW_HAND_SIZE && state.isBaronState(3))) {
			discardBtn.removeAttr('disabled');
			handLayer.setListening(true);
		}
		else {
			discardBtn.attr('disabled', true);
			handLayer.setListening(false);
		}

		stage.draw();
	};

	//************************************************************************
	//  EVENT HANDLERS
	//************************************************************************
	
	handLayer.on('click', function (evt) {
		var card = evt.targetNode;
		card.setAttr('selected', !card.getAttr('selected'));
	})
	.on('mouseover', function (evt) {
		var card = evt.targetNode;
		if(!card.getAttr('selected')) {
			card.move(0, -10);
			handLayer.draw();
		}
	})
	.on('mouseout', function (evt) {
		var card = evt.targetNode;
		if(!card.getAttr('selected')) {
			card.move(0, 10);
			handLayer.draw();
		}
	});

	$('#discard').click(function (evt) {
		var cardsDiscard = [];
		handLayer.getChildren().each(function (card, idx) {
			if(card.getAttr('selected'))
				cardsDiscard.push(card.getAttr('resource'));
		});

		$.event.trigger({
			type: 'res:discard',
			args: {cardsDiscard: cardsDiscard},
		});
	});

	self.init();
};

exports.handWindow = handWindow;