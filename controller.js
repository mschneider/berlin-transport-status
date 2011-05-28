var vbb = require('./vbb.js'),
    request = require('request'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    io = require('socket.io');
var crawlers = process.argv.slice(2);
var fetch_interval = 60 * 1000;

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
  var oldJourneys = stations[station.stationId] || [],
      newJourneys = JSON.parse(station).journeys;
  oldJourneys.forEach(unregisterJourney);
  newJourneys.forEach(registerJourney);
  stations[station.stationId] = newJourneys;
};

var crawlerIndex = 0;
var fetchStation = function(stationId) {
  var url = crawlers[crawlerIndex] + '/' + stationId;
  console.log('Fetching station ' + url);
  request({'url': url}, updateStation);
  crawlerIndex = crawlerIndex + 1 % crawlers.length;
};

vbb.station_list.forEach( function(stationId) {
  setInterval(function() { fetchStation(stationId); }, fetch_interval);
  fetchStation(stationId);
  // sleep shortly
});

server = http.createServer(function(req, res) { 
  var uri = url.parse(req.url).pathname
    , filename = path.join(process.cwd(), 'static', uri);
  
  path.exists(filename, function(exists) {
    if(!exists) {
      res.writeHead(404, {"Content-Type": "text/plain"});
      res.write("404 Not Found\n");
      res.end();
      return;
    }

	if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(err + "\n");
        res.end();
        return;
      }

      res.writeHead(200);
      res.write(file, "binary");
      res.end();
    });
  });
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