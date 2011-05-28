var sys = require('sys'),
  http = require('http'),
  url = require('url'),
  chainGang = require('chain-gang'),
  request = require('request');

var currentTime = function() { return new Date(); };

var crawlerChain = chainGang.create({workers: 1});
crawlerChain.on('add', function(url) {
  console.log('[CRAWLER]', currentTime(), 'added:', url)
});
crawlerChain.on('finished', function(url, error) {
  if (error) {
    console.error('[CRAWLER]', currentTime(), url, error)
  } else {
    console.log('[CRAWLER]', currentTime(), url ,'finished.') 
  }
});

var parse = function(body) {
  console.log("Parser called! ", body)
};

var crawl = function(worker, stationId) {
  var error;
  try {
    var requestUrl = 'http://www.vbb-fahrinfo.de/hafas/stboard.exe/dox?ld=&input='
      + stationId + '&boardType=dep&productsFilter=1100000&start=yes&maxJourneys=15';
    request({url: requestUrl}, function (error, response, body) {
        if (!error && response.statusCode == 200)
          parse(body);
      }
    );
  } catch(e) { error = e; }
  worker.finish(error);
};

http.createServer(function(request, response) {
  process.addListener('uncaughtException', function(error) {
    sys.puts('Caught exception: ' + error);
    response.writeHead(500, 'text/plain');
    response.end('error!');
  });
  
  crawlerChain.add(
    function(worker) { crawl(worker, 9120004); },
    request.url
  );
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end('Added to queue!');
}).listen(8221, "127.0.0.1");
sys.puts('Crawler running at http://127.0.0.1:8221/');