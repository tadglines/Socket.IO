/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

// abstract

(function(){
	
	var Frame = {
			//
			FRAME_CHAR: '~',
			// Control Codes
			CLOSE_CODE: 0,
			SESSION_ID_CODE: 1,
			TIMEOUT_CODE: 2,
			PING_CODE: 3,
			PONG_CODE: 4,
			DATA_CODE: 0xE,
			FRAGMENT_CODE: 0xF,

			// Core Message Types
			TEXT_MESSAGE_TYPE: 0,
			JSON_MESSAGE_TYPE: 1,
			
			// Methods
			encode: function(ftype, mtype, data) {
				if (!!mtype) {
					return FRAME_CHAR + ftype.toString(16) + mtype.toString(16)
							+ FRAME_CHAR + data.length.toString(16)
							+ FRAME_CHAR + data;
				} else {
					return FRAME_CHAR + ftype.toString(16)
							+ FRAME_CHAR + data.length.toString(16)
							+ FRAME_CHAR + data;
				}
			},
			
			decode: function(data) {
				var frames = [];
				var idx = 0;
				var start = 0;
				var end = 0;
				var ftype = 0;
				var mtype = 0;
				var size = 0;

				// Parse the data and silently ignore any part that fails to parse properly.
				while (data.length > idx && data.charAt(idx) == FRAME_CHAR) {
					ftype = 0;
					mtype = 0;
					start = idx + 1;
					end = data.indexOf(FRAME_CHAR, start);

					if (-1 == end || start == end ||
						!/[0-9A-Fa-f]+/.test(data.substring(start, end))) {
						break;
					}
					
					ftype = parseInt(data.substring(start, start+1), 16);

					if (end-start > 1) {
						if (ftype == DATA_CODE || ftype == FRAGEMENT_CODE) {
							mtype = parseInt(data.substring(start+1, end), 16);
						} else {
							break;
						}
					}

					start = end + 1;
					end = data.indexOf(FRAME_CHAR, start);

					if (-1 == end || start == end ||
						!/[0-9A-Fa-f]+/.test(data.substring(start, end))) {
						break;
					}
					
					var size = parseInt(data.substring(start, end));

					start = end + 1;
					end = start + size;

					if (data.length() < end) {
						break;
					}

					messages.push({ftype: ftype, mtype: mtype, data: data.substring(start, end)});
					idx = end;
				}
			}
	};
	
	Transport = io.Transport = function(base, options){
		this.base = base;
		this.options = {
			timeout: 15000 // based on heartbeat interval default
		};
		for (var i in options) 
			if (this.options.hasOwnProperty(i))
				this.options[i] = options[i];
	};

	Transport.prototype.send = function(mtype, data){
		this.rawsend(Frame.encode(Frame.DATA_CODE, mtype, data));
	};

	Transport.prototype.rawsend = function(){
		throw new Error('Missing send() implementation');
	};

	Transport.prototype.connect = function(){
		throw new Error('Missing connect() implementation');
	};

	Transport.prototype.disconnect = function(){
		throw new Error('Missing disconnect() implementation');
	};

	Transport.prototype.close = function(closeType){
		if (closeType == this.base.CLOSE_SIMPLE) {
			this.disconnectWhenEmpty = true;
		}
		this.rawsend(Frame.encode(Frame.CLOSE_CODE, null, 'close'));
	};
	
	Transport.prototype._onData = function(data){
		this._setTimeout();
		var msgs = Frame.decode(data);
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
		if (!!this._interval) {
			clearInterval(this._interval);
			this._interval = null;
		}
		this.disconnect();
	};
	
	Transport.prototype._onMessage = function(message){
		if (!this.sessionid){
			if (message.ftype == Frame.SESSION_ID_CODE) {
				this.sessionid = message.data;
				this._onConnect();
			} else {
				this._onDisconnect(this.base.ERROR, "First frame wasn't the sesion ID!");
			}
		} else if (message.ftype == Frame.TIMEOUT_CODE) {
			hg_interval = Number(message.data);
			if (message.data == hg_interval) {
				this.options.timeout = hg_interval*2; // Set timeout to twice the new heartbeat interval
				this._setTimeout();
			}
		} else if (message.ftype == Frame.CLOSE_CODE) {
			this._onClose(message.data);
		} else if (message.ftype == Frame.PING_CODE) {
			this._onPing(message.data);
		} else if (message.ftype == Frame.DATA_CODE) {
			this.base._onMessage(message.mtype, message.data);
		} else {
			// For now we'll ignore other frame types.
		}
	},
	
	Transport.prototype._onPing = function(data){
		this.rawsend(Frame.encode(Frame.PONG_CODE, null, data));
	};
	
	Transport.prototype._onConnect = function(){
		this.base._onConnect();
		this._setTimeout();
	};

	Transport.prototype._onClose = function(data){
		if (!!this.base.closeTypeRequested) {
			if (this.base.closeTypeRequested == this.base.CLOSE_CLEAN) {
				this.disconnectWhenEmpty = true;
				this.rawsend(Frame.encode(Frame.CLOSE_CODE, null, 'close'));
			}
		} else {
			
		}
	};
	
	Transport.prototype._onDisconnect = function(reason, error){
		this.sessionid = null;
		this.base._onDisconnect(reason, error);
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