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
const WAYBACK_URL_FORMAT = "https:\/\/web\.archive\.org\/web\/([0-9a-z_]*)\/(.*)";

/* import the networking libs */
const net = require('net');

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
                if(proxyRequest[0].trim().toLowerCase() == "get"){
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
        /* log the request to the console */
        syslog(url);

        /* rewrite the target url. the 'id_' attachment to
            the destination date ensures that the original
            content is returned without any additions from
            the wayback machine itself. */
        let targetUrl = WAYBACK_URL + TIME_TRAVEL_DATETIME + "id_/" + url;

        /* request the url from the wayback machine */
        let response = await httpRequest(targetUrl);

        /* send redirect or final result */
        if(response.statusCode == 301 || response.statusCode == 302){
            /* pass on the 301 redirect */
            returnHttpRedirect(socket,response.statusCode,
                /* revert the wayback url to the original one */
                getOriginalUrl(response.headers.location));
        }else{
            /* flush the result to the socket */
            returnHttpResponse(socket,{
                status: { code: 200, text: 'OK' },
                content: {
                    type: response.headers['content-type'],
                    body: response.body
                }
            });
        }
    }catch(ex){
        /* something crashed, return a bad gateway */
        returnHttpBadGateway(socket,ex);
    }
}

/**
 * Performs an http redirect (either 302 or 301)
 * 
 * @param {object} socket 
 * @param {int} statusCode 
 * @param {string} locationUrl 
 */
function returnHttpRedirect(socket,statusCode,locationUrl){
    let statusText = {
        301: "Moved Permanently", 302: "Found"
    }

    socket.write(
        "HTTP/1.1 " + statusCode + " " + statusText[statusCode] + "\r\n"
        + "Location: " + locationUrl + "\r\n"
        + "\r\n"
    );
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
    /* define the http output to return */
    let httpOutput = [
        Buffer.from("HTTP/1.1 " + response.status.code + " " + response.status.text + "\r\n"),
        Buffer.from("Server: " + PROXY_SERVER_NAME + "\r\n"),
        Buffer.from("Content-Type: " + response.content.type + "\r\n"),
        Buffer.from("Content-Length: " + Buffer.byteLength(response.content.body) + "\r\n"),
        Buffer.from("\r\n"),
        response.content.body
    ]

    try{
        /* write the response to the supplied socket */
        socket.write(Buffer.concat(httpOutput));
    }catch(ex){
        /* output the error to the logging */
        syslog('Failed to write output buffer to socket: ' + ex);
    }
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
            body: Buffer.from(html)
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
            body: Buffer.from(html)
        }
    });
}

/**
 * Extracts the original url from the full wayback machine url
 * 
 * @param {string} translatedUrl 
 * the url from the wayback machine
 */
function getOriginalUrl(translatedUrl){
    let result = translatedUrl;

    let part = (new RegExp(WAYBACK_URL_FORMAT)).exec(translatedUrl);
    if(part !== null){
        if(part.length == 3){ 
            result = part[2].trim();
        }
    }

    return result;
}

/**
 * Performs an http request
 * 
 * @param {string} url
 * the url to fetch as a proxy 
 */
function httpRequest(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? require('https') : require('http');
        const request = lib.get(url, (response) => {
            /* indicates whether to proceed response handling or not */
            let proceed = true;

            /**
             * There are two different redirect scenarios here. Either the wayback
             * machine redirects to a different time and/ or a different site. When 
             * the wayback machine just redirects to a different URL, we return the
             * redirect for the client to process in order to maintain the original 
             * behaviour of the server. 
             * 
             * If the wayback machine just processes an internal redirect to send 
             * the user to a different time, we follow that redirect.
             * 
             * The user will not realise travelling through the different timelines.
             */
            if(response.statusCode == 302 || response.statusCode == 301){
                /* check if the existing and redirect url match and
                    if they do, follow this request */
                if(getOriginalUrl(response.headers.location) == getOriginalUrl(url)
                    || getOriginalUrl(response.headers.location) == (getOriginalUrl(url)+"/")
                    || (getOriginalUrl(response.headers.location) + "/") == getOriginalUrl(url)){
                    /* follow the redirect and return the result behind that */
                    httpRequest(response.headers.location)
                    .then((redirectContent) => resolve(redirectContent))
                    .catch((redirectError) => reject(redirectError));

                    /* tell it to stop processing */
                    proceed = false;
                }
            }
            
            if(proceed == true){
                if ((response.statusCode < 200 || response.statusCode > 299)
                    && (response.statusCode !== 302 && response.statusCode !== 301)) {
                    reject(new Error('Proxy request failed with status code ' + response.statusCode));
                }
    
                const body = [];
                response.on('data', (chunk) => body.push(chunk));
                response.on('end', () => resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: Buffer.concat(body)
                }));
            }
        });
        
        request.on('error', (err) => reject(err));
    });
}

/**
 * This function handles all logging
 * 
 * @param {string} text
 * text to write to log 
 */
function syslog(text){
    /* log the request to the console */
    console.log((new Date()).toISOString() + " - " + text);    
}