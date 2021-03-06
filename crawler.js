var sys = require('sys'),
  http = require('http'),
  url = require('url'),
  chainGang = require('chain-gang'),
  request = require('request'),
  $ = require('jquery');

var currentTime = function() { return new Date(); };

var crawlerChain = chainGang.create({workers: 1});
crawlerChain.on('add', function(url) {
  console.log('[CRAWLER]', currentTime(), 'added:', url, 'chain length:', 
    crawlerChain.queue.length);
});
crawlerChain.on('finished', function(url, error) {
  if (error) {
    console.error('[CRAWLER]', currentTime(), 'error at:', url, error)
  } else {
    console.log('[CRAWLER]', currentTime(), 'finished:', url ) 
  }
});

var parse = function(body, cb) {
  var journeys = [];
  $(body).find('.sq').each(function(index, journey) {
    var data = $(journey).text().split('\n');
    var route = data[2],
        dest = data[5],
        depTime = data[7];
        journeys.push({
          'route': route,
          'dest': dest,
          'depTime': depTime
        });
  });
  if (cb) cb(journeys);
};

var crawl = function(worker, stationId, cb, errCb) {
  var error;
  try {
    var time = (new Date()).getTime();
    time -= 1000 * 60 * 5; // 5 minutes ago;
    time = new Date(time);
    var hours = addLeadingZeroAndConvertToString(time.getHours());
    var minutes = addLeadingZeroAndConvertToString(time.getMinutes());
    time = hours + ":" + minutes;
    var requestUrl = 'http://www.vbb-fahrinfo.de/hafas/stboard.exe/dox?ld=&input='
      + stationId + '&boardType=dep&productsFilter=1100000&start=yes&maxJourneys=15&time='
      + time;
    request({url: requestUrl}, function (error, response, body) {
        if (!error && response.statusCode == 200)
          parse(body, function(parsedJourneys) {
            if (cb) cb(parsedJourneys);
            worker.finish();
          });
        else {
          worker.finish('Status: ' + response.statusCode + 'Error: ' + error);
          if (errCb) errCb(error);
        }
      }
    );
  } catch(e) { 
    error = e;
    worker.finish(error);
    if (errCb) errCb(error);
  }
  
  function addLeadingZeroAndConvertToString(num) {
    return (num < 10 ? '0' : '') + num;
  }
};

http.createServer(function(request, response) {
  process.addListener('uncaughtException', function(error) {
    sys.puts('Caught exception: ' + error);
    response.writeHead(500, 'text/plain');
    response.end('error!');
  });

  var stationId = parseInt(url.parse(request.url).pathname.slice(1), 10);
  var workerFunction = function(worker) { 
    crawl(worker, stationId, function(journeys) {
      journeys.forEach(function(journey) {
        journey.stationId = stationId;
      });
      var jsonResp = {
        'stationId': stationId,
        'journeys': journeys
      };
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.end(JSON.stringify(jsonResp));
    }, function onError(error) {
      response.writeHead(500, {'Content-Type': 'application/json'});
      response.end(error);
    });
  };
  
  crawlerChain.add(workerFunction, stationId);
}).listen(8221, "127.0.0.1");
sys.puts('Crawler running at http://127.0.0.1:8221/');