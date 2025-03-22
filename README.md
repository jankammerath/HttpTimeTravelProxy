# Http Time Travel Proxy

This proxy server allows you to travel back in time. It is an HTTP proxy implementation using archive.org's Wayback Machine. The application is written in Go and can be compiled for various operating systems. The proxy queries the plain archive material through the Wayback Machine without any amendments of the archived material by archive.org (e.g. no Wayback Machine banner) which gives you the total immersion into the world-wide-web of yesteryear.

## How to configure and use

You need the compiled binary for your operating system. You can find pre-built binaries in the [bin](/bin) directory after building the project. Alternatively, you can build the project yourself using the provided `build.sh` script.

To run the proxy server, execute the binary:

```
./httptimetravelproxy
```

The server can be configured via the constants in the code before compiling. You can configure the desired time to travel to, the port the server listens on, and the server identifier.

```JavaScript
const (
	TimeTravelDateTime = "19990412"
	ProxyServerPort    = 8099
	ProxyServerName    = "HttpTimeTravelProxy/0.1"
	WaybackURL         = "https://web.archive.org/web/"
)
```

### Running the proxy as a daemon on Linux

You can find the service file for the application in [httptimetravelproxy.service](/httptimetravelproxy.service) which allows you to operate the proxy as a daemon with systemd. In order to install the Http Time Travel Proxy as a daemon on your Linux-system (tested with Ubuntu Server 20.04), you need to do the following.

1. Copy `./bin/httptimetravelproxy` to `/opt/httptimetravelproxy`
2. Copy [httptimetravelproxy.service](/httptimetravelproxy.service) to */etc/systemd/system/httptimetravelproxy.service*
3. Run **sudo systemctl daemon-reload** to have systemd reload the service files
4. Start the service with **sudo service httptimetravelproxy start**
5. Check the status with **sudo service httptimetravelproxy status**

Now you have a running time machine daemon on your Linux server and whatever device from your network is connecting to that proxy can travel back in time. If you change the time period in the `main.go` file, remember that you also need recompile, copy the binary and restart the daemon with **sudo service httptimetravelproxy restart** in order for the changes to take effect.

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