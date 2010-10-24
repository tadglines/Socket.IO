/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

// abstract

(function(){
	
	Transport = io.Transport = function(base, options){
		this.base = base;
		this.options = {
			timeout: 15000 // based on heartbeat interval default
		};
		for (var i in options) 
			if (this.options.hasOwnProperty(i))
				this.options[i] = options[i];
	};

	Transport.prototype.send = function(data){
		this.rawsend(this._encode(data));
	};

	Transport.prototype.rawsend = function(){
		throw new Error('Missing send() implementation');
	};

	Transport.prototype.connect = function(){
		throw new Error('Missing connect() implementation');
	};

	Transport.prototype._disconnect = function(){
		throw new Error('Missing disconnect() implementation');
	};

	Transport.prototype.disconnect = function(){
		this.disconnecting = true;
		this.rawsend('~3~5~close');
		this._disconnect();
	};

	encodeMessage = function(message){
		var str = String(message);
		return '~6~' + str.length + '~' + str;
	};
	
	Transport.prototype._encode = function(messages){
		var ret = '', message,
				messages = io.util.isArray(messages) ? messages : [messages];
		for (var i = 0, l = messages.length; i < l; i++){
			message = messages[i] === null || messages[i] === undefined ? '' : messages[i];
			ret += encodeMessage(message);
		}
		return ret;
	};

	Transport.prototype._decode = function(data){
		var messages = [], number, n, opcode;
		do {
			if (data.substr(0, 1) !== '~') return messages;
			data = data.substr(1);
			number = '', n = '';
			for (var i = 0, l = data.length; i < l; i++){
				n = Number(data.substr(i, 1));
				if (data.substr(i, 1) == n){
					number += n;
				} else {	
					data = data.substr(number.length)
					number = Number(number);
					break;
				} 
			}
			opcode = number;

			if (data.substr(0, 1) !== '~') return messages;
			data = data.substr(1);
			number = '', n = '';
			for (var i = 0, l = data.length; i < l; i++){
				n = Number(data.substr(i, 1));
				if (data.substr(i, 1) == n){
					number += n;
				} else {	
					data = data.substr(number.length)
					number = Number(number);
					break;
				} 
			}
			if (data.substr(0, 1) !== '~') return messages;
			data = data.substr(1);
			messages.push({ opcode: opcode, data: data.substr(0, number)}); // here
			data = data.substr(number);
		} while(data !== '');
		return messages;
	};
	
	Transport.prototype._onData = function(data){
		this._setTimeout();
		var msgs = this._decode(data);
		if (msgs && msgs.length){
			for (var i = 0, l = msgs.length; i < l; i++){
				this._onMessage(msgs[i]);
			}
		}
	};
	
	Transport.prototype._setTimeout = function(){
		var self = this;
		if (this._timeout) clearTimeout(this._timeout);
		this._timeout = setTimeout(function(){
			self._onTimeout();
		}, this.options.timeout);
	};
	
	Transport.prototype._onTimeout = function(){
		this._disconnect();
	};
	
	Transport.prototype._onMessage = function(message){
		if (!this.sessionid){
			if (message.opcode == 1) {
				this.sessionid = message.data;
				this._onConnect();
			} else {
				this._onDisconnect();
			}
		} else if (message.opcode == 2){
			hg_interval = Number(message.data);
			if (message.data == hg_interval) {
				this.options.timeout = hg_interval*2; // Set timeout to twice the new heartbeat interval
				this._setTimeout();
			}
		} else if (message.opcode == 3){
			this._onDisconnect();
		} else if (message.opcode == 4){
			this._onPing(message.data);
		} else if (message.opcode == 6){
//			if (message.data.substr(0,3) == '~j~') {
//				this.base._onMessage(JSON.parse(message.data.substr(3)));
//			} else {
				this.base._onMessage(message.data);
//			}
		} else {
			// For now we'll ignore other opcodes.
		}
	},
	
	Transport.prototype._onPing = function(data){
		this.rawsend('~5~' + data.length + '~' + data); // echo
	};
	
	Transport.prototype._onConnect = function(){
		this.connected = true;
		this.connecting = false;
		this.disconnecting = false;
		this.base._onConnect();
		this._setTimeout();
	};

	Transport.prototype._onDisconnect = function(){
		this.connecting = false;
		this.connected = false;
		this.disconnecting = false;
		this.sessionid = null;
		this.base._onDisconnect();
	};

	Transport.prototype._prepareUrl = function(){
		return (this.base.options.secure ? 'https' : 'http') 
			+ '://' + this.base.host 
			+ ':' + this.base.options.port
			+ '/' + this.base.options.resource
			+ '/' + this.type
			+ (this.sessionid ? ('/' + this.sessionid) : '/');
	};

})();