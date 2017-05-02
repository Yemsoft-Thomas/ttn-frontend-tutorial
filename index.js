/**
 * Created by thomas on 14-4-17.
 */
console.log('Starting TTN App TF1 ...');

//Read incoming Node data via MQTT from The Things Network and store in RethinkDB
require('./getNodeDataInDB.js');

//Provide a Web server and Websocket server, data is read from Rethink
require('./msgHandler.js');