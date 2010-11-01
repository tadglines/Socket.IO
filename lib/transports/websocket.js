/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var WS = io.Transport.websocket = function(){
		io.Transport.apply(this, arguments);
	};
	
	io.util.inherit(WS, io.Transport);
	
	WS.prototype.type = 'websocket';
	
	WS.prototype.connect = function(){
		var self = this;
		this.socket = new WebSocket(this._prepareUrl());
		this.socket.onmessage = function(ev){ self._onData(ev.data); };
		this.socket.onopen = function(ev){ self._onOpen(); };
		this.socket.onclose = function(ev){ self._onClose(); };
		return this;
	};

	WS.prototype.rawsend = function(data){
		this.socket.send(data);
		
		/*
		 * This rigmarole is required because the WebSockets specification doesn't say what happens
		 * to buffered data when close() is called. It cannot be assumed that buffered data is
		 * transmitted before the connection is close.
		 */
		if (!!this.disconnectWhenEmpty && !this._interval) {
			var self = this;
			self._interval = setInterval(function() {
				if (self.socket.bufferedAmount == 0) {
					self.disconnect();
					clearInterval(self._interval);
				} else if (!self.disconnectWhenEmpty ||
						   self.socket.readyState == self.socket.CLOSED) {
					clearInterval(self._interval);
				}
			}, 50);
		}
		return this;
	};
	
	WS.prototype.disconnect = function(){
		this.disconnectCalled = true;
		this.socket.close();
		return this;
	};

	WS.prototype._destroy = function(){
		if (this.socket) {
			this.socket.onclose = null;
			this.socket.onopen = null;
			this.socket.onmessage = null;
			this.socket.close();
			this.socket = null;
		}
		return this;
	};

	WS.prototype._onOpen = function(){
		// This is needed because the 7.1.6 version of jetty's WebSocket fails if messages are
		// sent from inside WebSocket.onConnect() method. 
		this.socket.send('OPEN');
		return this;
	};
	
	WS.prototype._onClose = function(){
		if (!!this.disconnectCalled || this.base.socketState == this.base.CLOSED) {
			this.disconnectCalled = false;
			this._onDisconnect();
		} else {
			this._onDisconnect(this.base.DR_ERROR, "WebSocket closed unexpectedly");
		}
		return this;
	};
	
	WS.prototype._prepareUrl = function(){
		return (this.base.options.secure ? 'wss' : 'ws') 
		+ '://' + this.base.host 
		+ ':' + this.base.options.port
		+ '/' + this.base.options.resource
		+ '/' + this.type
		+ (this.sessionid ? ('/' + this.sessionid) : '');
	};
	
	WS.check = function(){
		// we make sure WebSocket is not confounded with a previously loaded flash WebSocket
		return 'WebSocket' in window && WebSocket.prototype && ( WebSocket.prototype.send && !!WebSocket.prototype.send.toString().match(/native/i)) && typeof WebSocket !== "undefined";
	};

	WS.xdomainCheck = function(){
		return true;
	};
	
})();