// require
var LogicalBoard = require('./lib/server/logic.js').LogicalBoard;

var jade = require('jade');
var express = require('express'), app = express();
var http = require('http'), 
	server = http.createServer(app);

// Disabling web-sockets
// io.configure(function () { 
//   io.set("transports", ["xhr-polling"]); 
//   io.set("polling duration", 10); 
// }); 

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
	app.use('/lib', express.static(__dirname + '/lib'));
	app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res){
	res.render('home.jade');
});

server.listen(process.env.PORT || 3000);	// heroku dynamically assigns port
console.log('Express server started on port %s', server.address().port);

var gridWidth = 6;
var gridHeight = 7;
var lb = new LogicalBoard(gridWidth, gridHeight, server);