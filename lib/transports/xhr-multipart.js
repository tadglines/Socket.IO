/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var XHRMultipart = io.Transport['xhr-multipart'] = function(){
		io.Transport.XHR.apply(this, arguments);
	};
	
	io.util.inherit(XHRMultipart, io.Transport.XHR);
	
	XHRMultipart.prototype.type = 'xhr-multipart';
	
	XHRMultipart.prototype._get = function(){
		var self = this;
		var lastReadyState = 4;
		this._xhr = this._request('', 'GET', true);
		this._xhr.onreadystatechange = function(){
			// Normally the readyState will progress from 1-4 (e.g. 1,2,3,4) for a normal part.
			// But on disconnect, the readyState will go from 1 to 4 skipping 2 and 3.
			// Thanks to Wilfred Nilsen (http://www.mail-archive.com/mozilla-xpcom@mozilla.org/msg04845.html) for discovering this.
			// So, if the readyState skips a step and equals 4, then the connection has dropped.
			if (self._xhr.readyState - lastReadyState > 1 && self._xhr.readyState == 4) {
				self._onDisconnect(self.base.DR_ERROR, "XHR Connection dropped unexpectedly");
			} else {
				lastReadyState = self._xhr.readyState;
				if (self._xhr.readyState == 3) {
					self._onData(self._xhr.responseText);
				}
			}
		};
		this._xhr.send();
	};
	
	XHRMultipart.check = function(){
		return 'XMLHttpRequest' in window && 'prototype' in XMLHttpRequest && 'multipart' in XMLHttpRequest.prototype;
	};

	XHRMultipart.xdomainCheck = function(){
		return true;
	};
	
})();