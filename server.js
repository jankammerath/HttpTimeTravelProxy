/**
 * HTTP Time Travel Proxy
 * 
 * This application provides an HTTP proxy server
 * to travel back in time using the Wayback Machine
 * from archive.org. To use this server run the
 * node.js application and configure your client
 * to use this server on the configured port
 * as an HTTP proxy server.
 * 
 * All HTTP CONNECT requests to this server
 * will be rewritten and send back in time.
 */

/* format for destination date is yyyyMMdd */
const TIME_TRAVEL_DATETIME = "19990412";
const PROXY_SERVER_PORT = 8099;
const PROXY_SERVER_NAME = "HttpTimeTravelProxy/0.1";
const WAYBACK_URL = "https://web.archive.org/web/";

/* import the networking libs */
const net = require('net');
const https = require('https');

/* create the server to serve the proxy port */
let server = net.createServer(function (socket) {
    socket.on('data', function(chunk) {
        /* get and parse the request from the client */
        let clientRequest = chunk.toString().split('\r\n');

        /* ensure there is data from the client */
        if(clientRequest.length > 0){
            /* get the first line with the actual request */
            let proxyRequest = clientRequest[0].split(' ');
            if(proxyRequest.length == 3){
                /* check if this is a get request */
                if(proxyRequest[0].toLowerCase() == "get"){
                    /* return the rewritten response */
                    returnProxyResponse(socket,proxyRequest[1]);
                }else{
                    /* requests other than HTTP GET are not supported */
                    returnHttpBadRequest(socket);
                }                
            }else{
                /* return a bad request */
                returnHttpBadRequest(socket);
            }
        }else{
            /* return a bad request */
            returnHttpBadRequest(socket);
        }
    });
});

/* make the server listen on the port */
server.listen({port: PROXY_SERVER_PORT});

/**
 * Rewrite the request and return the response
 * 
 * @param {object} socket 
 * @param {string} url 
 */
async function returnProxyResponse(socket,url){
    try{
        /* rewrite the target url. the 'id_' attachment to
            the destination date ensures that the original
            content is returned without any additions from
            the wayback machine itself. */
        let targetUrl = WAYBACK_URL + TIME_TRAVEL_DATETIME + "id_/" + url;
        socket.write("URL: "+ url);
    }catch(ex){
        /* something crashed, return a bad gateway */
        returnHttpBadGateway(socket,ex);
    }
}

/**
 * Returns an http response to the socket
 * 
 * @param {object} socket 
 * the socket of the connection
 * 
 * @param {object} response 
 * the response object with the content
 */
function returnHttpResponse(socket,response){
    /* write the response to the supplied socket */
    socket.write(
        "HTTP/1.1 " + response.status.code + " " + response.status.text + "\r\n"
        + "Server: " + PROXY_SERVER_NAME + "\r\n"
        + "Content-Type: " + response.content.type + "\r\n"
        + "Content-Length: " + Buffer.byteLength(response.content.body, "utf8") + "\r\n"
        + "\r\n" + response.content.body
    );
}

/**
 * Returns a bad gateway http error
 * 
 * @param {object} socket 
 * @param {string} text 
 */
function returnHttpBadGateway(socket,text){
    /* create the html content */
    let html = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\r\n'
             + '<html><head>\r\n'
             + '<title>502 Bad Gateway</title>\r\n'
             + '</head><body>\r\n'
             + '<h1>Bad Request</h1>\r\n'
             + 'The proxy server encountered a problem when fetching the content:<br>\r\n'
             + '<b>' + text + '<b>\r\n'
             + '</body></html>\r\n';

    /* return the response */
    returnHttpResponse(socket,{
        status: {
            code: 502,
            text: 'Bad Gateway'
        },
        content: {
            type: 'text/html',
            body: html
        }
    });
}

/**
 * Returns a bad request
 * 
 * @param {object} socket 
 */
function returnHttpBadRequest(socket){
    /* create the html content */
    let html = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\r\n'
             + '<html><head>\r\n'
             + '<title>400 Bad Request</title>\r\n'
             + '</head><body>\r\n'
             + '<h1>Bad Request</h1>\r\n'
             + 'The proxy server cannot understand the request '
             + 'or does not support the request method.\r\n'
             + '</body></html>\r\n';

    /* return the response */
    returnHttpResponse(socket,{
        status: {
            code: 400,
            text: 'Bad Request'
        },
        content: {
            type: 'text/html',
            body: html
        }
    });
}

/**
 * Performs an http request
 * 
 * @param {object} options 
 */
function httpRequest(options) {
    return new Promise ((resolve, reject) => {
      let request = https.request(options);
      request.on('response', response => { resolve(response); });
      request.on('error', error => { reject(error); });
    }); 
  }