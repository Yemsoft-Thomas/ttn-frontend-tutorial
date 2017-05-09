var ttn = require('ttn');
var fs = require('fs');
var r = require('rethinkdb');

//Connect to rethink database where we store the incoming messages from our nodes
r.connect({ host: 'localhost', port: 28015 }, function(err, conn) {
  if(err) throw err;
  //Check if DB already exists, else create it
  var dbs = r.dbList().run(conn , function(err, res) {
    if (!(res.includes('ttn'))) r.dbCreate('ttn').run(conn);
  });

  //Create tables to store up stream messages and logging.
  var tabs = r.db('ttn').tableList().run(conn, function(err, res) {
    if(err) throw err;
    if (!(res.includes('up_data'))) r.db('ttn').tableCreate('up_data').run(conn);
    if (!(res.includes('node_log'))) r.db('ttn').tableCreate('node_log').run(conn);
  });
  dbConn = conn;
  r.db('ttn').table('node_log').insert({info:'New session started.'}).run(conn);

  //Open the MQTT connection to TTN and our application
  var region = 'eu';
  var appId = 'tfnode01';
  var accessKey = 'ttn-account-v2.xE11a2iy8bbDTjv3Hc3XBs-fhE76eXfD7GTU2mnPskE';
  var options = {
    protocol: 'mqtts',
    // Assuming that the mqtt-ca certificate (https://www.thethingsnetwork.org/docs/applications/mqtt/quick-start.html) is in the same folder
    ca: [ fs.readFileSync('mqtt-ca.pem') ],
  }

  var client = new ttn.data.MQTT(region, appId, accessKey);

  client.on('connect', function(connack) {
    console.log('[DEBUG]', 'Connect:', connack);
    console.log('[DEBUG]', 'Protocol:', client.mqtt.options.protocol);
    console.log('[DEBUG]', 'Host:', client.mqtt.options.host);
    console.log('[DEBUG]', 'Port:', client.mqtt.options.port);
  });

  client.on('error', function(err) {
    console.error('[ERROR]', err.message);
  });

  client.on('activation', function(deviceId, data) {
    console.log('[INFO] ', 'Activation:', deviceId, JSON.stringify(data, null, 2));
    r.db('ttn').table('node_log').insert(data).run(conn);
  });

  client.on('device', null, 'down/scheduled', function(deviceId, data) {
    console.log('[INFO] ', 'Scheduled:', deviceId, JSON.stringify(data, null, 2));
    r.db('ttn').table('node_log').insert(data).run(conn);
  });

  client.on('message', function(deviceId, data) {
    console.info('[INFO] ', 'Message:', deviceId, JSON.stringify(data, null, 2));
    r.db('ttn').table('up_data').insert(data).run(conn);
  });

  client.on('message', null, 'celsius', function(deviceId, celsius) {
    var blinks = Math.floor(celsius - 20);
    var payload = [blinks];

    console.log('[DEBUG]', 'Sending:', JSON.stringify(payload));
    client.send(deviceId, payload);
    r.db('ttn').table('up_data').insert({payload:payload}).run(conn);
  });

});
