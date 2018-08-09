const config = require('config');
const path = require('path');

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);


app.use('/', express.static(path.join(__dirname, 'public')));

io.on('connection', function(socket){
    console.log("connected...");
    socket.emit('bootstrap', config.get('client.bootstrap'));
    socket.emit('broadcast', {message:'hello, world!'});
    socket.emit('broadcast', {user:'bobby', message:'hello, world!'});
});
const port = config.get('server').port;

http.listen(port, function(){
  console.log(`listening on port ${port}`);
});
