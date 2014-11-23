//
// Ning Nong
//
'use strict';

var spawn 	= require('child_process').spawn;
var Ning 	= require('./ning');
var events 	= require('events');
var nong 	= new events.EventEmitter();
var util 	= require('util');

kickItAllOff();

function kickItAllOff() {
	var pauseTime = 1; //second

	var child = spawn('ping', ['-i ' + pauseTime, 'google.com']);

	child.stdout.on('data', function(data) {
		nong.emit("ping", data);
	});

	child.stderr.on('data', function(data) {
		nong.emit("pong", data);
	});

	child.on('close', function(code) {
	    console.log('closing code: ' + code);
	});

	nong.on("pong", processErrorPing);
	nong.on("ping", processPing);
	nong.on("timeout", processTimeout);

	waitForNoPing(pauseTime);
}

// some counters
var timeouts = 1;
var pings = 1;
var noRoutes = 1;

function processTimeout(ping) {
	if (timeouts == 1) { util.print("\n") }
	pings = 1;
	noRoutes = 1;
	util.print("\r>TIMEOUT [" + (timeouts++) + "]\r");
}

function processPing(ping) {
	// calc time
	// parse
	//if (/timeout/.exec(ping) || //route)

	// timeout: timeout
	// network down.
	var duration = /time=([\S]+)/.exec(ping);

	if (duration === null) { 		
		console.log("NO TIMEOUT! There always is... not sure whats going on: " + ping);
	} else {
		if (pings == 1) util.print("\n");
		util.print(">GOOD [" + (pings++) + "] " + duration[1] + "\r");
//		return new Ning(Date.now(), true, duration);
		timeouts = 1;
		noRoutes = 1;

	}
}

// Ping throws an error when there is no route to the host, ie., your connection is 
// down. 
//
// Note: The error ping has a return character on the end, so lets get rid of it.
function processErrorPing(ePing) {
	// raise an event
	if (timeouts > 1 || pings > 1) {
		util.print("\n");
	}

	// get rid of the return on the end
	ePing = ePing.slice(0, -1);

	util.print(">NO ROUTE [" + (noRoutes++) + "] " + ePing + "\r");
	timeouts = 1;
	pings = 1;
}

function waitForNoPing(time) {
	setTimeout(function() {
		// Its only a timeout if we can contact the server
		if (noRoutes < 2) processTimeout();
	}, time * 1.5 * 1000);
}