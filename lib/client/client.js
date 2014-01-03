var State = require('/lib/state.js').State;
var tradeWindow = require('/lib/client/tradeWindow.js').tradeWindow;
var devWindow = require('/lib/client/devWindow.js').devWindow;
var handWindow = require('/lib/client/handWindow.js').handWindow;
var Board = require('/lib/client/board.js').Board;

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

        logarea.scrollTop(logarea[0].scrollHeight);
    };
};

var Client = function () {
	var self = this,
        socket = io.connect(),
        log = new Log(),
        state = new State(),
        board,
        hand,
        trade,
        dev;

    this.getBoard = function () {
        return board;
    };

    this.start = function () {
        socket.emit('grabState', {});    
    };

    //************************************************************************
    //  COMPONENT EVENT HANDLERS
    //************************************************************************

    $(document).on('roll', function (evt) {
        socket.emit('roll', {});
        log.log(0, '> ROLL');
    })
    .on('build', function (evt) {
        var type = evt.args.type,
            coords = evt.args.coords;

        socket.emit('buildRequest', {
            'type': type,
            'coords': coords
        });
        log.log(0, '> BUILD '+type+'@'+coords);
    })
    .on('endTurn', function (evt) {
        socket.emit('endTurn', {});
        log.log(0, '> END TURN');
    })
    .on('dev:buy', function (evt) {
        socket.emit('buildRequest', {
            type: 'dev',
        });
        log.log(0, '> BUY DEV');
    })
    .on('dev:use', function (evt) {
        var devNum = evt.args.devNum;

        socket.emit('useDevRequest', {
            devNum: devNum,
        });
        log.log(0, '> USE DEV'+devNum);
    })
    .on('res:discard', function (evt) {
        var cardsDiscard = evt.args.cardsDiscard;

        socket.emit('overflowResolve', {
            cardsDiscard: cardsDiscard,
        });
        log.log(0, '> DISCARD OVERFLOW: '+cardsDiscard);
    })
    .on('trade:announce', function (evt) {
        var tradeCards = evt.args.tradeCards,
            wantCards = evt.args.wantCards;

        socket.emit('tradeAnnounceRequest', {
            tradeCards: tradeCards,
            wantCards: wantCards,
        });
        log.log(0, '> ANNOUNCE TRADE '+tradeCards+' for '+wantCards);
    })
    .on('trade:accept', function (evt) {
        socket.emit('tradeAccept', {});
        log.log(0, '> ACCEPT TRADE');
    })
    .on('trade:exchange', function (evt) {
        var tradeCards = evt.args.tradeCards,
            wantCards = evt.args.wantCards;

        socket.emit('exchangeRequest', {
            tradeCards: tradeCards,
            wantCards: wantCards,
        });
        log.log(0, '> EXCHANGE '+tradeCards+' for '+wantCards);
    })
    .on('trade:cancel', function (evt) {
        socket.emit('tradeAnnounceCancel',{});
    })
    .on('baron:move', function (evt) {
        var coords = evt.args.coords;

        socket.emit('requestBaronMove', {
            coords: coords,
        });
        log.log(0, '> MOVE BARON '+coords);
    })
    .on('baron:steal', function (evt) {
        var p = evt.args.player_num;

        socket.emit('requestBaronSteal', {player_num: p});
        log.log(0, '> STEAL FROM '+pnum);
    })
    .on('chat:send', function (evt) {
        var message = evt.args.message;

        socket.emit('chat', {message: message});
    });

    $('#roll').click(function (evt) {
        $.event.trigger({
            type: 'roll',
            args: {},
        });
    });

    $('#endTurn').click(function (evt) {
        $.event.trigger({
            type: 'endTurn',
            args: {},
        });
    });

    $('#dialog').keypress(function (evt) {
        if(evt.which == 13) {
            var text = $(this).val();

            $.event.trigger({
                type: 'chat:send',
                args: {message: text},
            });
            $(this).val('');
        }
    });

    // $('#giveResource').click(function (evt) {
    //     var resType = parseInt($('#resource').val());
    //     socket.emit('giveResource', {resource: resType});
    //     log.log(0, '> GIVE RESOURCE '+resType);
    // });

    // $('#giveDev').click(function (evt) {
    //     socket.emit('giveDev', {});
    //     log.log(0, '> GRAB DEV');
    // });
        
    //************************************************************************
    //  SOCKET EVENT HANDLERS
    //************************************************************************

    var redraw = function () {
        board.draw();
        hand.draw();
        trade.draw();
        dev.draw();
    };

    socket.on('full', function () {
        alert('Sorry, this instance is full!');
    });

    socket.on('state', function (data) {
        state.initializeLocalState(data.state);
        board = new Board(state),
        hand = new handWindow(state),
        trade = new tradeWindow(state),
        dev = new devWindow(state);

        log.log(0, 'You have joined the game as Player '+(parseInt(data.state.player_num)+1));
        log.log(0, 'It is currently Player '+(parseInt(data.state.currentPlayer)+1)+'\'s turn.');
    });

    socket.on('players', function (data) {
        state.players = data.players;
        if(data.reason == 'DROP')
            log.log(2, 'Player '+(parseInt(data.player_num)+1)+' ('+data.player+') has left the game.');
        else if(data.reason == 'NEW')
            log.log(2, data.player+' has joined as Player '+(parseInt(data.player_num)+1));
        else 
            log.log(2, 'Lobby has been updated.');
    });

    socket.on('roll', function (data) {
        state.setRoll(data.roll);
        redraw();
        log.log(1, 'Player '+(state.getCurrentPlayer()+1)+' has rolled a '+data.roll+'.');
    });

    // Baron
    socket.on('promptBaronMove', function (data) {
        state.setBaronState(data.baronState);
        redraw();
        log.log(0, 'BARON PHASE: You need to move the baron to a new tile.');
    });
    socket.on('promptBaronSteal', function (data) {
        state.setBaronState(data.baronState);
        state.setRobbablePlayers(data.robbable);
        redraw();
        log.log(0, 'BARON PHASE: Select a player whose settlement(s) are on that tile to steal from.');
    });
    socket.on('baronFinish', function (data) {
        state.setBaronState(data.baronState);
        redraw();
    });

    socket.on('moveBaron', function (data) {
        state.placeBaron(data.coords);
        redraw();
        log.log(1, 'BARON PHASE: The baron has been moved!');
    });

    socket.on('overflowNotice', function (data) {
        state.setBaronState(data.baronState);
        redraw();
        log.log(1, 'BARON PHASE: You have more than '+OVERFLOW_HAND_SIZE+' resources in your hand. You must discard half of them.');
    });
    socket.on('overflowWait', function (data) {
        state.setOverflowPlayers(data.overflowPlayers);
        state.setBaronState(data.baronState);
        redraw();
        var overflows = data.overflowPlayers.map(function (pnum) {
            return parseInt(pnum)+1;
        });

        log.log(1, 'BARON PHASE: Waiting on players to discard half of their hands..('+overflows+')');
    });


    socket.on('gain', function (data) {
        state.giveResources(state.getMyNum(), data.cardsAdded);
        hand.draw();

        if(data.action == 'roll')
            log.log(1, 'ROLL PHASE: Resources have been distributed for the roll.');
        else if(data.action == 'steal')
            log.log(0, 'BARON PHASE: You have stolen resources from Player '+(parseInt(data.oppPlayer)+1));
        else if(data.action == 'admin')
            log.log(0, 'You have given yourself resources.');
        else if(data.action == 'trade')
            log.log(0, 'TRADING: You have gained resources from the current player.');
        else if(data.action == 'exchange')
            log.log(0, 'EXCHANGE: You have gained resources from exchanging.');
    });

    socket.on('deduct', function (data) {
        state.setHand(state.getMyNum(), data.hand);
        hand.draw();

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

    socket.on('tradeEnd', function (data) {
        if(data.reason == 'accept')
            log.log(1, 'TRADING: The announced trade has been accepted.');
        else if(data.reason == 'cancel')
            log.log(1, 'TRADING: The announced trade has been cancelled.');

        state.setTradeCards([]);
        state.setWantCards([]);
        redraw();
    });

    socket.on('buildAccept', function (data) {  
        if(data.type != 'dev') {
            board.add(data.type, data.coords);
            log.log(1, 'BUILD PHASE: Player ' + (state.getCurrentPlayer() + 1) + ' has built a ' + data.type + '@' + data.coords);
        }
        else {
            dev.draw();
        }
    });

    socket.on('tradeAnnounce', function (data) {
        if(state.isMyTurn())
            return;
        state.setTradeCards(data.cardsDeduct);
        state.setWantCards(data.cardsGain);
        trade.draw();
        log.log(2, 'Player '+(state.getCurrentPlayer()+1)+' has announced a trade offer.');
    });

    socket.on('devGain', function (data) {
        var currentPlayer = state.getCurrentPlayer();
        state.giveDev(currentPlayer, data.devNum);
        if(data.action == 'admin')
            state.flushDevQueue();
        dev.draw();

        if(state.isMyTurn())
            log.log(2, 'You have bought a Development Card.');
        else
            log.log(2, 'Player '+(currentPlayer+1)+' has purchased a Development Card.');
    });

    socket.on('useDev', function (data) {
        var devLabeling = ['Unknown', 'Knight', 'Road Building', 'Year of Plenty', 'Monopoly', 'Victory Point'],
            currentPlayer = state.getCurrentPlayer();

        if(state.isMyTurn()) {
            state.activateDev(currentPlayer, data.devNum);
            log.log(1, 'You have activated '+devLabeling[data.devNum]+'.');
        }
        else {
            state.activateDev(currentPlayer, 0, data.devNum);
            log.log(2, 'Player '+(currentPlayer+1)+' have activated '+devLabeling[data.devNum]+'.');
        }
            
        redraw();
    });

    socket.on('nextTurn', function (data) {
        log.log(1, 'Player ' + (state.getCurrentPlayer()+1) + ' has ended their turn.');
        state.flushDevQueue();
        state.resetActiveDev();
        state.setCurrentPlayer(parseInt(data.currentPlayer));

        state.setTradeCards([]);
        state.setWantCards([]);

        state.setRound(data.round);
        state.setOverflowPlayers([]);
        state.setBaronState(0);
        state.setRoll(0);

        redraw();

        if(data.round < 2 && state.isMyTurn()) {
            if(state.getMyNum() == NUM_PLAYERS - 1) 
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
        log.log(1, 'Player '+(parseInt(data.author)+1)+': '+data.message);
    });

    socket.on('error', function (reason){
        console.error('Unable to connect Socket.IO', reason);
    });

    socket.on('connect', function (){
        console.info('Connected!');
    });

    socket.on('lobby:ready', function () {
        self.start();
    });

};

$(document).ready(function () {
    var c = new Client();
});