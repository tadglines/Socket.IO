@echo off
SETLOCAL

cd %~dp0..\lib

echo /** Socket.IO - Built with build.bat */ > ..\socket.io.js

copy ..\socket.io.js + io.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + util.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transport.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\xhr.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\websocket.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\flashsocket.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\htmlfile.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\xhr-multipart.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\xhr-polling.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + transports\jsonp-polling.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + socket.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + vendor\web-socket-js\swfobject.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + vendor\web-socket-js\FABridge.js ..\socket.io.js
echo. >> ..\socket.io.js
copy ..\socket.io.js + vendor\web-socket-js\web_socket.js ..\socket.io.js
echo. >> ..\socket.io.js

echo Done.

pause
ENDLOCAL
