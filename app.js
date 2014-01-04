var jade = require('jade'),
	express = require('express'), app = express(),
	http = require('http'), server = http.createServer(app),

	connect = require('connect'),
	cookie = require('cookie'),
	MemoryStore = express.session.MemoryStore, sessionStore = new MemoryStore(),

	io = require('socket.io'),
	sio_wildcard = require('socket.io-wildcard');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.configure(function() {
	app.use(express.cookieParser());
	app.use(express.session({
		store: sessionStore,
		secret: 'secret',
		key: 'express.sid',
		cookie: {										// cookies expire after 10 minutes
			expires: new Date(Date.now() + 60 * 10000), 
			maxAge: 60*10000,
		},
	}));

	app.use('/lib', express.static(__dirname + '/lib'));
	app.use(express.static(__dirname + '/public'));
});

//************************************************************************
//  APPLICATION ROUTES
//************************************************************************

app.get('/', function(req, res){
	res.render('home.jade', {section: 'Main'});
});

app.get('/game', function (req, res) {
	res.render('game.jade', {section: 'Game'});
});

server.listen(process.env.PORT || 3000);	// heroku dynamically assigns port
console.log('Express server started on port %s', server.address().port);

//************************************************************************
//  SOCKET.IO SERVER
//************************************************************************

var Session = connect.middleware.session.Session;

io = sio_wildcard(io).listen(server);

io.configure(function () {
// Disabling web-sockets
//   io.set("transports", ["xhr-polling"]); 
//   io.set("polling duration", 10); 
	io.set('log level', 1);
	io.set('authorization', function (handshake, accept) {
		if(handshake.headers.cookie) {
			// try unsigning cookie, if it fails value should be unchanged
			// N.B. MUST BE CALLED 'sessionID' for the Session constructor
			handshake.cookie = cookie.parse(handshake.headers.cookie);
			handshake.sessionID = connect.utils.parseSignedCookie(handshake.cookie['express.sid'], 'secret');

			if(handshake.cookie['express.sid'] == handshake.sessionID)
				return accept('Cookie is invalid.', false);

			// put session store and data into handshake as required by Session constructor
			handshake.sessionStore = sessionStore;
			sessionStore.get(handshake.sessionID, function (err, session) {
				if(err || !session)
					accept('Could not grab session.', false);
				else {
					handshake.session = new Session(handshake, session);
					accept(null, true);
				}
			});
		}
		else
			return accept('No cookie given.', false);
	});
});

//************************************************************************
//  SOCKET EVENT HANDLERS
//************************************************************************
var rooms = {},
	Room = require('./lib/server/room.js').Room;

io.on('connection', function (socket) {
	var sessid = socket.handshake.sessionID,
		session = socket.handshake.session;

	var refreshCookie = setInterval(function () {
		session.reload(function () {
			session.touch().save();	// resetting maxAge and expires
		});
		console.log(JSON.stringify({
			type: 'refresh',
			data: {
				sessid: sessid,
				socket: socket.id,
			},
		}));
	}, 60 * 1000);	// reset every minute

	console.log(JSON.stringify({
		type: 'connection',
		data: {
			sessid: sessid,
			sessdata: session,
			socket: socket.id
		},
	}));

	// assign user to a room
	if(!session.room || typeof rooms[session.room] == 'undefined') {
		var room, seat;
		for(rid in rooms) {
			if(rooms[rid].count < 4) room = rid;
		}

		if(typeof room == 'undefined') {		// make a new room if there's no space
			room = sessid;
			rooms[sessid] = new Room(sessid, io);
			console.log(JSON.stringify({
				type: 'lobby:create',
				data: {
					hostid: sessid,
				},
			}));
		}

		socket.join(room);
		seat = rooms[room].add(sessid, socket.id);
		if(seat == -1)	// problem
			return;

		session.room = room;
		session.seat = seat;
		session.save();
	}
	else {
		socket.join(session.room);
		rooms[session.room].add(sessid, socket.id, session.seat);

	}

	console.log(JSON.stringify({
		type: 'lobby:join',
		data: {
			sessid: sessid,
			socket: socket.id,
			room: session.room,
			seat: session.seat,			
		}
	}));

	socket.on('*', function (evt) {
		evt.args[0].invoker = {
			sessid: sessid,
			socket: socket.id,
			seat: parseInt(session.seat),
		};

		var room = rooms[session.room];
		console.log(JSON.stringify({
			type: 'invoke',
			data: evt,
		}));

		room.raiseEvent(evt.name, evt.args[0]);
	});


	socket.on('disconnect', function () {
		rooms[session.room].remove(sessid, socket.id, session.seat);
	});
});