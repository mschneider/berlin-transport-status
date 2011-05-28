var vbb = require('./vbb.js'),
    request = require('request'),
    http = require('http'),
    io = require('socket.io');
var crawlers = process.argv.slice(1);
var fetch_interval = 5 * 60 * 1000;

var stations = {}; // List of Journeys
var depTimes = {}; // List of Journeys

var unregisterJourney = function(journey) {
  var oldIndex = depTimes[journey.depTime].indexOf(journey);
  if (oldIndex >= 0)
    delete depTimes[journey.depTime][oldIndex];
};

var registerJourney = function(journey) {
  if (!depTimes[journey.depTime])
    depTimes[journey.depTime] = [];
  depTimes[journey.depTime].push(journey);
};

var updateStation = function(error, response, station) {
  if (error || response.statusCode != 200) {
    console.error("Request to crawler failled.", error, response)
    return;
  }
  var oldJourneys = stations[station.stationId],
      newJourneys = station.journeys;
  oldJourneys.forEach(unregisterJourney);
  newJourneys.forEach(registerJourney);
  stations[station.stationId] = newJourneys;
};

var crawlerIndex = 0;
var fetchStation = function(stationId) {
  var url = crawlers[crawlerIndex] + '/' + stationId
  request({'url': url}, updateStation);
  crawlerIndex = crawlerIndex + 1 % crawlers.length;
};

vbb.station_list.forEach( function(stationId) {
  setInterval(function() { fetchStation(stationId); }, fetch_interval);
  // sleep shortly
});

server = http.createServer(function(req, res) { 
 // your normal server code 
 res.writeHead(200, {'Content-Type': 'text/html'}); 
 res.end('<h1>Hello world</h1>'); 
});
server.listen(80);
  
// socket.io 
var socket = io.listen(server); 
var clients = [];
socket.on('connection', function(client) { 
  console.log('client connected.');
  clients.push(client);
  client.on('disconnect', function() {
    var clientIndex = clients.indexOf(client);
    if (clientIndex >= 0)
      delete clients[clientIndex];
  });
}); 

var pushDepartures = function() {
  var currentTime = new Date();
  clients.forEach(function(client) {
    client.send(JSON.stringify(depTimes['' + currentTime.getHours()
      + ':' + currentTime.getMinutes()]));
  });
};
setInterval(pushDepartures, 60*1000);

console.log('Controller running at http://127.0.0.1:80/');