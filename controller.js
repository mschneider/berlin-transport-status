var vbb = require('./vbb.js'),
    request = require('request'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
    io = require('socket.io');
var crawlers = process.argv.slice(2);
var MINUTE = 60*1000
var refetch_interval = 5 * MINUTE;
var fetch_interval = refetch_interval / vbb.station_list.length;

var lastPush = new Date();

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
      if (filename.indexOf('.mp3') != -1)
        res.writeHead(200, {"Content-Type": "audio/mp3"});
      else
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
  var currentTime = new Date();
  var nextPush = ((60*1000) - (currentTime.getTime() - lastPush.getTime()))/1000;
  console.log(currentTime, 'Client connected.');
  console.log("Next push in", nextPush, "seconds.");
  clients.push(client);
  setTimeout(function(){
    console.log('playing einsteigen')
    client.send('audioInit:');
  }, nextPush - 30);
  client.on('disconnect', function() {
    var clientIndex = clients.indexOf(client);
    if (clientIndex >= 0)
      clients = clients.splice(clientIndex, 1);
  });
}); 

var handleDepartures = function() {
  var currentTime = new Date();
  var hours = addLeadingZeroAndConvertToString(currentTime.getHours());
  var minutes = addLeadingZeroAndConvertToString(currentTime.getMinutes());
  var timeStr = hours + ':' + minutes;
  pushDepartures(timeStr);
  scheduleSoundtrack(timeStr);
  lastPush = currentTime;
  
  function addLeadingZeroAndConvertToString(num) {
    return (num < 10 ? '0' : '') + num;
  }
};

var pushDepartures = function(timeStr) {
  clients.forEach(function(client) {
    client.send('data:' + JSON.stringify(depTimes[timeStr]));
  });
};


var pushAudio = function(tracks) {
  clients.forEach(function(client) {
    client.send('audio:' + JSON.stringify(tracks));
  });
};

function Track(voice) {
    this.voice = voice
    this.parts = [null, null, null, null, null];
    
    var choose = function(callback, options) {
        var decission = parseInt(options.length * Math.random());
        callback(options[decission]);
    };
    
    this.add = function(partToAdd) {
        var that = this;
        freeParts = [];
        for (var i = 0; i < this.parts.length; i++) {
            if (this.parts[i] == null)
                freeParts.push(i);
        }
        if (freeParts.length > 0) {
            choose(function(freeIndex) {
                that.parts[freeIndex] = partToAdd;
            }, freeParts);
            return true;
        } else {
            return false;
        }
    };
};

function Soundtrack(routesDeparted) {
    this.melodys = {low: new Track('low'), high: new Track('high')};
    this.rhythms = {low: new Track('low'), mid: new Track('mid'), high: new Track('high')};
    
    var chooseOfTwo = function(callback, firstChoice, secondChoice) {
        if (Math.random() < 0.5)
            callback(firstChoice, secondChoice);
        else
            callback(secondChoice, firstChoice)
    };

    var chooseOfThree = function(callback, firstChoice, secondChoice, thirdChoice) {
        switch (parseInt(3 * Math.random())) {
            case 0:
                return callback(firstChoice,secondChoice,thirdChoice);
            case 1:
                return callback(secondChoice,thirdChoice,firstChoice);
            case 2:
                return callback(thirdChoice,firstChoice,secondChoice);
        }
    };
    
    this.addMelody = function(route) {
        chooseOfTwo(function(firstChoice, secondChoice) {
            if (!firstChoice.add(route)) {
                secondChoice.add(route);
            }}, this.melodys.low, this.melodys.high);
    };
    
    this.addRhythm = function(route) {
        chooseOfThree( function(firstChoice, secondChoice, thirdChoice) {
            if (!firstChoice.add(route)) {
                if (!secondChoice.add(route)) {
                    thirdChoice.add(route);
                }
            }
        }, this.rhythms.low, this.rhythms.mid, this.rhythms.high);
    };
    
    this.addRoute = function(route) {
        switch(route.slice(0,1)) {
            case 'S':
                return this.addRhythm(route);
            case 'U':
                return this.addMelody(route);
        }
    };
    
    this.getTrackNames = function(index) {
      var names = [];
      if (this.melodys.low.parts[index])
        names.push('m_low_'  + this.melodys.low.parts[index]);
      if (this.melodys.high.parts[index])
        names.push('m_high_' + this.melodys.high.parts[index]);
      if (this.rhythms.low.parts[index])
        names.push('r_low_'  +  this.rhythms.low.parts[index]);
      if (this.rhythms.mid.parts[index])
        names.push('r_mid_'  + this.rhythms.mid.parts[index]);
      if (this.rhythms.high.parts[index])
        names.push('r_high_' + this.rhythms.high.parts[index]);
      return names;
    };
    
    this.play = function(index) {
      var trackNames = this.getTrackNames(index);
      console.log('playing:', JSON.stringify(trackNames));
      pushAudio(trackNames);
    };
};

var scheduleSoundtrack = function(timeStr) {
    // TODO make it work
    var departures = depTimes[timeStr] || [];
    var st = new Soundtrack();
    departures.forEach(function(departure) {
      st.addRoute(departure.route);
    });
    var numParts = new Track().parts.length;
    for (var i = 0; i < numParts; i++) {
        (function(time) {
            setTimeout(function() {
                st.play(time)
            }, (time * 1000 * 60 / numParts))
        })(i);
    }
};

setInterval(handleDepartures, MINUTE);

console.log('Controller running at http://127.0.0.1:80/');