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
//
//  UPDATE.
//
//  I have determined that all these shenanigans is a actually a bug in the OS X
// 	implementation of ping. Hence, I've now included a patched version of ping.c
// 	that does flush the timeout message. This greatly simplifies the code now, however
//  I've left it to support both models.

'use strict';

var spawn 	= require('child_process').spawn;
var events 	= require('events');
var util 	= require('util');

var USE_GOOD_PING	= false;		// change to false if you are using the broken OS X ping
var PING_COMMAND 	= "./ping"; // "/sbin/ping"
var PING_URL		= "google.com";

var PAUSE_TIME		= 1;		// parameter for ping. Should be read from config.

// For the broken ping
var TIMEOUT_GRACE_PERIOD 	= 2; // seconds to wait over and above before we assume ther is a timeout
var waiter;				 // the thread that waits for things

// some counters
var timeouts 		= 1;
var pings 			= 1;
var noRoutes 		= 1;

kickItAllOff();

function kickItAllOff() {
	var child = spawn('./ping', ['-i ' + PAUSE_TIME, PING_URL]);

	child.stdout.on('data', processPing);
	child.stderr.on('data', processErrorPing);
	child.on('close', function(code) {
	    console.log('Ping stopped: ' + code);
	});

	// set up initial wait for timeouts
	waitForNoPing();
}

function processTimeout(ping) {
	if (timeouts == 1) { util.print("\n") }
	pings = 1;
	noRoutes = 1;
	util.print("\r>TIMEOUT [" + (timeouts++) + "]\r");
}

function processPing(ping) {
	if (/bytes/.test(ping)) {		
		processGoodPing(ping);
	} else if (/timeout/.test(ping)) { 		
		processTimeout(ping);
	} else {
		console.log("No idea what message this is: " + ping);
	}
}

function processGoodPing(ping) {
	var duration = /time=([\S]+)/.exec(ping);
	if (!duration) {
		console.log("No time in the ping??? " + ping);
		return;
	}

	if (pings == 1) util.print("\n");
	util.print(">GOOD [" + (pings++) + "] " + duration[1] + "\r");
	timeouts = 1;
	noRoutes = 1;

	// stop any existing and start a new ping wait timer
	waitForNoPing();
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

	// stop any existing and start a new ping wait timer
	waitForNoPing();
}

// The fake timeout function that starts a thread after another message and acts
// like the timeout for the bad ping program.
function waitForNoPing() {
	// Don't wait for the timeout if our ping reports it fine
	if (USE_GOOD_PING) return;

	//console.log("setting up a new waiter")
	clearTimeout(waiter);
	waiter = setTimeout(function() {
		// If we get there, then we didn't hear back from the pinger. So lets now launch a
		// a new interval timer for
		waiter = setInterval(function() {
			processTimeout();
		}, PAUSE_TIME * 1000)
	}, (PAUSE_TIME + TIMEOUT_GRACE_PERIOD) * 1000);
}