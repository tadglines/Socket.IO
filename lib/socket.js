/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var Socket = io.Socket = function(host, options){
		this.host = host || document.domain;
		for (var i in options) 
			if (this.options.hasOwnProperty(i))
				this.options[i] = options[i];
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	};

	// Constants
	// Socket state
	Socket.prototype.CONNECTING = 0;
	Socket.prototype.CONNECTED = 1;
	Socket.prototype.CLOSING = 2;
	Socket.prototype.CLOSED = 3;

	// Disconnect Reason
	Socket.prototype.DR_CONNECT_FAILED = 1;
	Socket.prototype.DR_DISCONNECT = 2;
	Socket.prototype.DR_TIMEOUT = 3;
	Socket.prototype.DR_CLOSE_FAILED = 4;
	Socket.prototype.DR_ERROR = 5;
	Socket.prototype.DR_CLOSED_REMOTELY = 6;
	Socket.prototype.DR_CLOSED = 7;

	// Event Types
	Socket.prototype.CONNECT_EVENT = 'connect';
	Socket.prototype.DISCONNECT_EVENT = 'disconnect';
	Socket.prototype.MESSAGE_EVENT = 'message';

	// Message Types
	Socket.prototype.TEXT_MESSAGE = 0;
	Socket.prototype.JSON_MESSAGE = 1;

	Socket.prototype.options = {
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

	Socket.prototype.socketState = Socket.prototype.CLOSED;
	Socket.prototype._events = {};
	Socket.prototype._parsers = {};

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
		if (!this.transport) throw ("No available transports!");
		
		var self = this;
		var _connect = function() {
			if (self.transport) {
				if (self.socketState == self.CONNECTING) self.transport._destroy();
				self.socketState = self.CONNECTING;
				self.transport.connect();
				if (self.options.connectTimeout){
					setTimeout(function(){
						if (self.socketState == self.CONNECTING){
							self.transport._destroy();
							if (self.options.tryTransportsOnConnectTimeout && !self._rememberedTransport){
								var remainingTransports = [], transports = self.options.transports;
								for (var i = 0, transport; transport = transports[i]; i++){
									if (transport != self.transport.type) remainingTransports.push(transport);
								}
								if (remainingTransports.length){
									self.transport = self.getTransport(remainingTransports);
									_connect();
								} else {
									self.onDisconnect(self.DR_CONNECT_FAILED, "All transports failed");
								}
							} else {
								self.onDisconnect(self.DR_CONNECT_FAILED, "Connection attempt timed out");
							}
						}
					}, self.options.connectTimeout);
				}
			} else {
				self.onDisconnect(self.DR_CONNECT_FAILED, "All transports failed");
			}
		};
		_connect();
		return this;
	};
	
	Socket.prototype.send = function(){
		if (this.socketState == this.CLOSING) throw ("Socket is closing!");
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

		if (mtype < 0 || mtype > 2147483648) {
			throw "Invalid message type, must be greater than 0 and less than 2^31!";
		}
		
		var parser = this._parsers[mtype];
		
		if (parser) {
			data = String(parser.encode(data));
		}

		this.transport.send(mtype, data);
		return this;
	};
	
	Socket.prototype.close = function() {
		this.socketState = this.CLOSING;
		this.transport.close();
		return this;
	};

	Socket.prototype.disconnect = function(){
		this.transport.disconnect();
		return this;
	};
	
	Socket.prototype.setMessageParser = function(messageType, parser) {
		var mtype = Number(messageType);
		if (mtype != messageType) {
			throw "Invalid message type, it must be a number!";
		}
		if (!parser) {
			delete this._parsers[mtype];
		} else {
			if (typeof parser.encode != 'function' || typeof parser.decode != 'function') {
				throw "Invalid parser!";
			}
			this._parsers[mtype] = parser;
		}
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
	
	Socket.prototype._onMessage = function(mtype, data){
		var parser = this._parsers[mtype];
		var obj = data;
		var error = null;
		
		if (parser) {
			try {
				obj = parser.decode(data);
			} catch (e) {
				error = e;
			}
		}

		this.fire(this.MESSAGE_EVENT, [mtype, obj, error]);
	};
	
	Socket.prototype._onDisconnect = function(disconnectReason, errorMessage){
		var state = this.socketState;
		this.socketState = this.CLOSED;
		if (state == this.CLOSED) {
			this.fire(this.DISCONNECT_EVENT, [this.DR_CLOSED, errorMessage]);
		} else if (state == this.CLOSING) {
			if (!!this.closeId) {
				this.fire(this.DISCONNECT_EVENT, [this.DR_CLOSE_FAILED, errorMessage]);
			} else {
				this.fire(this.DISCONNECT_EVENT, [this.DR_CLOSED_REMOTELY, errorMessage]);
			}
		} else if (state == this.CONNECTING) {
			this.fire(this.DISCONNECT_EVENT, [this.DR_CONNECT_FAILED, errorMessage]);
		} else if (!disconnectReason) {
			this.fire(this.DISCONNECT_EVENT, [this.DR_DISCONNECT, errorMessage]);
		} else {
			this.fire(this.DISCONNECT_EVENT, [disconnectReason, errorMessage]);
		}
	};
	
	Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
	
})();