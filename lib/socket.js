/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var Socket = io.Socket = function(host, options){
		// Constants
		// Socket state
		this.CONNECTING = 0;
		this.CONNECTED = 1;
		this.CLOSING = 2;
		this.CLOSED = 3;

		// Disconnect Reason
		this.DR_CLEAN_CLOSE = 0;    // Only used internally
		this.DR_CONNECT_FAILED = 1;
		this.DR_DISCONNECT = 2;
		this.DR_TIMEOUT = 3;
		this.DR_CLOSE_FAILED = 4;
		this.DR_ERROR = 5;

		// Close Type
		this.CLOSE_SIMPLE = 1;
		this.CLOSE_CLEAN = 2;
		this.CLOSE_POLITE = 3;

		// Event Types
		this.CONNECTED_EVENT = 'connect';
		this.DISCONNECTED_EVENT = 'disconnect';
		this.CLOSE_EVENT = 'close';
		this.MESSAGE_EVENT = 'message';

		// Message Types
		this.TEXT_MESSAGE = 0;
		this.JSON_MESSAGE = 1;
		
		this.host = host || document.domain;
		this.options = {
			secure: false,
			document: document,
			port: document.location.port || 80,
			resource: 'socket.io',
			transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
			transportOptions: {
				'xhr-polling': {
					timeout: 25000 // based on polling duration default
				},
				'jsonp-polling': {
					timeout: 25000
				}
			},
			connectTimeout: 5000,
			tryTransportsOnConnectTimeout: true,
			rememberTransport: true
		};
		for (var i in options) 
			if (this.options.hasOwnProperty(i))
				this.options[i] = options[i];
		this.socketState = this.CLOSED;
		this.connected = false;
		this.connecting = false;
		this.disconnecting = false;
		this.wasConnected = false;
		this.wasConnecting = false;
		this._events = {};
		this._parsers = {};
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	};
	
	Socket.prototype.getTransport = function(override){
		var transports = override || this.options.transports, match;
		if (this.options.rememberTransport && !override){
			match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
			if (match){
				this._rememberedTransport = true;
				transports = [decodeURIComponent(match[1])];
			}
		} 
		for (var i = 0, transport; transport = transports[i]; i++){
			if (io.Transport[transport] 
				&& io.Transport[transport].check() 
				&& (!this._isXDomain() || io.Transport[transport].xdomainCheck())){
				return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
			}
		}
		return null;
	};
	
	Socket.prototype.connect = function(){
		if (this.socketState != this.CLOSED) throw ("Socket not closed!");
		if (this.transport && this.socketState != this.CONNECTED){
			if (this.socketState == this.CONNECTING) this.disconnect();
			this.socketState = this.CONNECTING;
			this.transport.connect();
			if (this.options.connectTimeout){
				var self = this;
				setTimeout(function(){
					if (self.socketState != self.CONNECTED){
						self.disconnect();
						if (self.options.tryTransportsOnConnectTimeout && !self._rememberedTransport){
							var remainingTransports = [], transports = self.options.transports;
							for (var i = 0, transport; transport = transports[i]; i++){
								if (transport != self.transport.type) remainingTransports.push(transport);
							}
							if (remainingTransports.length){
								self.transport = self.getTransport(remainingTransports);
								self.connect();
							}
						}
					}
				}, this.options.connectTimeout);
			}
		}
		return this;
	};
	
	Socket.prototype.send = function(){
		if (this.socketState != this.CONNECTED) throw ("Socket not connected!");
		var mtype = 0;
		var data;
		if (arguments.length == 1) {
			data = arguments[0];
		} else if (arguments.length >= 2) {
			mtype = Number(arguments[0]);
			data = arguments[1];
		} else {
			throw "Socket.send() requires at least one argument";
		}

		if (isNaN(mtype)) {
			throw "Invalid message type, must be a number!";
		}

		var parser = this._parsers[mtype];
		
		if (parser) {
			data = String(parser.encode(data));
		}

		this.transport.send(mtype, data);
		return this;
	};
	
	Socket.prototype.close = function(closeType){
		if (closeType != this.CLOSE_SIMPLE &&
			closeType != this.CLOSE_CLEAN &&
			closeType != this.CLOSE_POLITE) {
			throw "Invalid close type";
		}
		this.closeTypeRequested = Number(closeType);
		this.transport.close(closeType);
		return this;
	};

	Socket.prototype.disconnect = function(){
		this.transport.disconnect();
		return this;
	};
	
	Socket.prototype.on = function(name, fn){
		if (!(name in this._events)) this._events[name] = [];
		this._events[name].push(fn);
		return this;
	};
	
	Socket.prototype.fire = function(name, args){
		if (name in this._events){
			for (var i = 0, ii = this._events[name].length; i < ii; i++) 
				this._events[name][i].apply(this, args === undefined ? [] : args);
		}
		return this;
	};
	
	Socket.prototype.removeEvent = function(name, fn){
		if (name in this._events){
			for (var a = 0, l = this._events[name].length; a < l; a++)
				if (this._events[name][a] == fn) this._events[name].splice(a, 1);		
		}
		return this;
	};
	
	Socket.prototype._isXDomain = function(){
		return this.host !== document.domain;
	};
	
	Socket.prototype._onConnect = function(){
		this.socketState = this.CONNECTED;
		if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
		this.fire(this.CONNECT_EVENT);
	};
	
	Socket.prototype._onMessage = function(messageType, data){
		this.fire(this.MESSAGE_EVENT, [messageType, data]);
	};
	
	Socket.prototype._onDisconnect = function(disconnectReason, errorMessage){
		if (this.socketState == this.CLOSING && !!this.closeTypeAchieved) {
			this.socketState = this.CLOSED;
			this.fire(this.CLOSE_EVENT, [this.closeTypeRequested, this.closeTypeAchieved]);
		} else if (this.socketState == this.CONNECTING) {
			this.socketState = this.CLOSED;
			this.fire(this.DISCONNECT_EVENT, [this.DR_CONNECT_FAILED, errorMessage]);
		} else {
			this.socketState = this.CLOSED;
			this.fire(this.DISCONNECT_EVENT, [disconnectReason, errorMessage]);
		}
	};
	
	Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
	
})();