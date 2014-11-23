//
// Ning Nong
//
// A wrapper around Ping (on OS X) which makes it easier to see how things have gone
// in a long running session.
//
// Architecture:
// 
// NingNong spawn a ping process and then listens for I/O from the process. Here are
// the idiosyncracies.
//
// 	stdin: When all is good stdin gets the std ping "64 bytes... ip... ttl ... time" 
//		string. Unfortunately when there is no response from the target machine
//		(ie., you'd normally see a "timeout..." message) these are not available to 
//		the underying stream on the 'data' event. They infact only arrive tacked onto
//		the begining of the next success message - which is too late. I've tried to 
//		get them out of the stream in various ways to no avail. So the code sets up
//		its own timeout detection thread. This is sub optimal (and by no means 
// 		accurate) but sufficient for the moment. Would love to get some pull requests
//		that fix this.
//
//	stderr: When no connection is present ping emits a "Send to" or "No route" type
//		strings to stderr. In this case there is also a return character (\n) on the 
//		end which needs to be removed.
//
'use strict';

var spawn 	= require('child_process').spawn;
var events 	= require('events');
var util 	= require('util');

var GRACE_PERIOD = 1.5; 	// seconds to wait over and above before we assume ther is a timeout

kickItAllOff();

function kickItAllOff() {
	var pauseTime = 1; //second

	var child = spawn('ping', ['-i ' + pauseTime, 'google.com']);

	child.stdout.on('data', processPing);
	child.stderr.on('data', processErrorPing);
	child.on('close', function(code) {
	    console.log('Ping stopped: ' + code);
	});

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
	var duration = /time=([\S]+)/.exec(ping);

	if (duration === null) { 		
		console.log("NO TIMEOUT! There always is... not sure whats going on: " + ping);
	} else {
		if (pings == 1) util.print("\n");
		util.print(">GOOD [" + (pings++) + "] " + duration[1] + "\r");
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
	setInterval(function() {
		// Its only a timeout if we can contact the server
		if (noRoutes < 2) processTimeout();
	}, (time + GRACE_PERIOD) * 1000);
}