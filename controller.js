var stations = require('./stations.js');
var controllers = process.argv.slice(1);
var fetch_interval = 5 * 60 * 1000;

var fetchStation = function(stationId) {
  
};

stations.forEach( function(stationId) {
  setInterval(function() { fetchStation(stationId); }, fetch_interval);
});

http.createServer(function(request, response) {
  process.addListener('uncaughtException', function(error) {
    sys.puts('Caught exception: ' + error);
    response.writeHead(500, 'text/plain');
    response.end('error!');
  });

  response.writeHead(200, {'Content-Type': 'application/json'});
}).listen(8220, "127.0.0.1");
sys.puts('Controller running at http://127.0.0.1:8220/');