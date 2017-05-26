/*
 Webserver for the static client files
 Plus websocket server to handle all data requests
 Data comes from our RethinkDB.
 Yemsoft, TF, 14-04-2017, v0.2
 */

var express = require('express'), http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var fs = require('fs');
var r = require('rethinkdb');

var dbHost = 'localhost';

var globalSocket = null;
var updates = 1;

//Init HTTP server
app.use(express.static('client'));
server.listen(3000, function () {
    console.log('Web server listening on port 3000.')
})


//Whenever a browser connects to websocket we want to provide it with the existing payload averages
function getNodeData(dbConn) {
  //Filter query to display only today's data, using a string match (similar to SQL like),
  //since our sensor data's timestamp is stored as string.
  //TODO: Here lies a challenge for improvement ;)
  var d = new Date();
  var dateString = d.getDate() + '-' + (d.getMonth()+1) + '-' + d.getFullYear();   //Month are returned 0-11!
  //only if a socket exists to send the result with
  if (globalSocket != null) {
    r.db('ttn').table('up_data').filter(r.row('metadata')('time').match(dateString)).run(dbConn, function(err, cursor) {
        if (err) throw err;

        //calculate the average of the payload data
        var temp = 0.0;
        var pressure = 0.0;
        var num = 0;
        cursor.each(function(err, row) {
          if (err) throw err;

            for(var key in row.payload_fields){
               console.log('Key = ' + key + ', value = ' + row.payload_fields[key]);
            };

          temp += parseFloat(row.payload_fields.celcius,2);
          pressure += parseFloat(row.payload_fields.mbar,2);
          num += 1;
        }, function(err) {
          temp = Math.round(temp / num);
          pressure = Math.round(pressure / num);

          console.log('Sending initial average payload: Temp = ' + temp + ', Pressure = ' + pressure);
          globalSocket.emit('nodeData', {payload: {celcius : temp, mbar: pressure}} );
      });


    });
  };
}

//RethinkDB will trigger this event whenever data in the up_data table changes, thus whenever we receive data from node.
function subscribeChanges(dbConn) {
  r.db('ttn').table('up_data').changes().run(dbConn, function(err, cursor) {
    if (err) throw err;
    var t = 0;
    cursor.each(function(err, row) {
        if (err) throw err;
        if (globalSocket != null) {
          console.log('Sending subscription payload update #'+ updates + ' row #' + t + ': ' + JSON.stringify(row.new_val.payload_fields,null,2));
          globalSocket.emit('nodeData', { payload: row.new_val.payload_fields });
        };
        t += 1;
        updates += 1;
    });
  });
}

//Browser / client can send data via websocket back to here for server processing
function processClientData(data) {
  //TODO something usefull should go here, for example send data down to node and blink it's LED
  console.log('Received from client: ' + JSON.stringify(data, null, 2));
  globalSocket.emit('messages', { message: 'Thank you for the client data.' });
}


//// Main portion of program ////

//Init Websocket when client connects
io.on('connection', function (socket) {
  //We implement two streams, one for (status)messages and a second for payload data from the node
  //Send connect success message to client
  socket.emit('messages', { message: 'Websocket connected. Getting Node data ...' });

  //Store socket in global to be able to use it anywhere in the code.
  globalSocket = socket;

  //connect to the database
  r.connect( {host: dbHost, port: 28015}, function(err, conn) {
      if (err) throw err;

      getNodeData(conn);
      subscribeChanges(conn);
  });

  //Receive messages from client
  socket.on('clientData', function (data) {
    processClientData(data);
  });
});
