var vbb = require('./vbb.js'),
    request = require('request'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    io = require('socket.io');
var crawlers = process.argv.slice(2);
var MINUTE = 60*1000
var refetch_interval = 2 * MINUTE;
var fetch_interval = refetch_interval / vbb.station_list.length;

// 2 Lists of Journeys
var stations = {}; 
var depTimes = {};

var unregisterJourney = function(journey) {
  depTimes[journey.depTime] = 
    depTimes[journey.depTime].filter(function(otherJourney) {
      return journey != otherJourney;
    });
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
  try {
    station = JSON.parse(station);
  } catch(e) {
    console.error("Crawler returned invalid JSON", station);
    return;
  }
  var oldJourneys = stations[station.stationId] || [],
      newJourneys = station.journeys;
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
  setTimeout(function() { fetchStation(stationId) }, refetch_interval);
};

var setupFetching = function(index) {
  if (index == vbb.station_list.length) return;
  fetchStation(vbb.station_list[index]);
  setTimeout(function() { setupFetching(index+1); }, fetch_interval);
};
setupFetching(0);

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
    if (fs.statSync(filename).isDirectory())
      filename += '/index.html';
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
  console.log(new Date(), 'Client connected.');
  clients.push(client);
  client.on('disconnect', function() {
    var clientIndex = clients.indexOf(client);
    if (clientIndex >= 0)
      clients = clients.splice(clientIndex, 1);
  });
}); 

var pushDepartures = function() {
  var currentTime = new Date();
  var hours = addLeadingZeroAndConvertToString(currentTime.getHours());
  var minutes = addLeadingZeroAndConvertToString(currentTime.getMinutes());
  var timeStr = hours + ':' + minutes;
  console.log(timeStr, 'sending:', JSON.stringify(depTimes));
  clients.forEach(function(client) {
    client.send(JSON.stringify(depTimes[timeStr]));
  });
  function addLeadingZeroAndConvertToString(num) {
    return (num < 10 ? '0' : '') + num;
  }
};
setInterval(pushDepartures, MINUTE);

console.log('Controller running at http://127.0.0.1:80/');