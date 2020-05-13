# Http Time Travel Proxy

This proxy server allows you to travel back in time. It is an HTTP proxy implementation using archive.org's Wayback Machine. The application is written in JavaScript for Node.js on any operating system supported by Node.js. It also has no dependencies other than the built-in libraries from Node.js. The proxy queries the plain archive material through the Wayback Machine without any amendments of the archived material by archive.org (e.g. no Waybach Machine banner) which gives you the total immersion into the world-wide-web of yesteryear.

## How to configure and use

All you need is the [HttpTimeTravelProxy.js](/HttpTimeTravelProxy.js) JavaScript file. You can simply run the proxy server with the following command.

```
node HttpTimeTravelProxy.js
```

The server does not have a dedicated configuration file. You can however configure the desired time to travel to, the port the server listens on as well as the server identifier in the top of the JavaScript code file itself.

```JavaScript
/* the time to travel to in yyyymmdd */
const TIME_TRAVEL_DATETIME = "19990412";

/* the port number as integer */
const PROXY_SERVER_PORT = 8099;

/* the server header sent to the client */
const PROXY_SERVER_NAME = "HttpTimeTravelProxy/0.1";
```

## Client support and configuration

You can use any HTTP-browser with the proxy. However the proxy currently only supports the HTTP GET method. POST, PUT, DELETE etc. are not supported as also archive.org's WaybackMachine has no support for these methods and obviously did not archive any dynamic content. The proxy was tested with Internet Explorer 5 and Netscape Navigation 4.8 on both MacOS 9.2.2 as well as Windows 98. It was also tested with the latest Firefox on the latest OSX.

![Proxy configuration in Internet Explorer 5 on MacOS 9.2.2](/screenshot/macos9-ie5-proxy-settings.png)

The proxy server only supports standard HTTP proxy where the client request the URI with the GET-method. Tunnelling through the HTTP CONNECT-method or Socks is not supported. The basic HTTP proxy configuration for any browser should work. All connections from the browser to the proxy server are in plain HTTP with no encryption. The connection from the proxy to archive.org however uses HTTPS/ HTTP with SSL.

![1999's Altavista on MacOS 9.2.2 with Netscape Navigator 4.8](/screenshot/altavista-1999.png)

![1999's Google on MacOS 9.2.2 with Netscape Navigator 4.8](/screenshot/google-1999.png)

![1999's Amazon on MacOS 9.2.2 with Netscape Navigator 4.8](/screenshot/amazon-1999.png)

![1999's Netscape.com on Windows 98 with Netscape Navigator 4.7](/screenshot/windows98-netscape-1999.png)

![1999's Yahoo on MacOS 9.2.2 with Netscape Navigator 4.8](/screenshot/yahoo-1999.png)

![1999's eBay on Windows 98 with Internet Explorer 5](/screenshot/windows98-ie5-ebay-1999.png)

![1999's Microsoft.com on MacOS 9.2.2 with Internet Explorer 5 for Mac](/screenshot/windows98-ie5-ebay-1999.png)

![1999's Apple-branded Excite.com on MacOS 9.2.2 with Netscape Navigator 4.8](/screenshot/cobranded-apple-excite-page-1999.png)

## Known issues

There seems to be a bug in Node.js that might cause TCP-errors, especially with Internet Explorer, to appear in the logs. This does not harm the operation of the proxy server and has no influence on the behaviour. However it is reported to the log and marked with the information *Might be only a Node.js bug* in the output.