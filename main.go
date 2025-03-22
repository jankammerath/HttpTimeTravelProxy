package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Configuration constants
const (
	TimeTravelDateTime = "19990412"
	ProxyServerPort    = 8099
	ProxyServerName    = "HttpTimeTravelProxy/0.1"
	WaybackURL         = "https://web.archive.org/web/"
)

var (
	waybackURLRegex = regexp.MustCompile(`https://web\.archive\.org/web/([0-9a-z_]*)/(.*)`)
)

// Archive API response structure
type ArchiveResponse struct {
	ArchivedSnapshots struct {
		Closest struct {
			Available   bool   `json:"available"`
			URL         string `json:"url"`
			Timestamp   string `json:"timestamp"`
			StatusCode  string `json:"status"`
			ContentType string `json:"mimetype"`
		} `json:"closest"`
	} `json:"archived_snapshots"`
}

// HTTPResponse structure to hold response data
type HTTPResponse struct {
	Status struct {
		Code int
		Text string
	}
	Content struct {
		Type string
		Body []byte
	}
}

func main() {
	// Log server startup
	syslog(fmt.Sprintf("Starting HTTP Time Travel Proxy on port %d", ProxyServerPort))

	// Listen for incoming connections
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", ProxyServerPort))
	if err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
	defer listener.Close()

	// Accept and handle connections
	for {
		conn, err := listener.Accept()
		if err != nil {
			syslog(fmt.Sprintf("Error accepting connection: %v", err))
			continue
		}

		// Handle each connection in a goroutine
		go handleConnection(conn)
	}
}

// Handle a client connection
func handleConnection(conn net.Conn) {
	defer conn.Close()

	// Set up a reader for the connection
	reader := bufio.NewReader(conn)

	// Read the request
	requestLine, err := reader.ReadString('\n')
	if err != nil {
		if err != io.EOF {
			syslog(fmt.Sprintf("TCP_ERROR: %v", err))
		}
		return
	}

	// Parse the request
	requestParts := strings.Fields(requestLine)
	if len(requestParts) != 3 {
		returnHttpBadRequest(conn)
		return
	}

	// Check if this is a GET request
	if strings.ToLower(requestParts[0]) == "get" {
		// Drain the rest of the headers (we don't use them but need to consume them)
		for {
			line, err := reader.ReadString('\n')
			if err != nil || line == "\r\n" || line == "\n" {
				break
			}
		}

		// Process and return the response
		returnProxyResponse(conn, requestParts[1])
	} else {
		// Only support GET requests
		returnHttpBadRequest(conn)
	}
}

// Get the target URL from the Wayback Machine
func getTargetUrl(sourceUrl string) (string, error) {
	// Default result with direct redirect format
	result := WaybackURL + TimeTravelDateTime + "id_/" + sourceUrl

	// Query the WaybackMachine API for archived content
	apiUrl := "https://archive.org/wayback/available?url=" + sourceUrl + "&timestamp=" + TimeTravelDateTime
	resp, err := http.Get(apiUrl)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Parse the JSON response
	var apiResult ArchiveResponse
	if err := json.Unmarshal(body, &apiResult); err != nil {
		return "", err
	}

	// Check if we have an archived snapshot
	if closest := apiResult.ArchivedSnapshots.Closest; closest.Available {
		availableTimestamp := closest.Timestamp
		result = WaybackURL + availableTimestamp + "id_/" + sourceUrl
	} else {
		// Content is not available in the archive
		return "", nil
	}

	return result, nil
}

// Process the client request and return the response
func returnProxyResponse(conn net.Conn, url string) {
	// Log the request
	syslog(url)

	// Get the URL from the wayback machine
	targetUrl, err := getTargetUrl(url)
	if err != nil || targetUrl == "" {
		// Return 404 if content is not available
		returnHttpNotFound(conn, url)
		return
	}

	// Request the content from the archive
	resp, err := httpRequest(targetUrl)
	if err != nil {
		// Handle HTTP errors
		statusCode := 0
		if respErr, ok := err.(*HTTPError); ok {
			statusCode = respErr.StatusCode
			syslog(fmt.Sprintf("Exception in proxy request: HTTP %d - %s", statusCode, url))
		}

		if statusCode == 404 {
			returnHttpNotFound(conn, url)
		} else {
			returnHttpBadGateway(conn, fmt.Sprintf("The remote server returned HTTP %d", statusCode))
		}
		return
	}

	// Handle response based on status code
	if resp.StatusCode == 301 || resp.StatusCode == 302 {
		// Get the location header
		location := resp.Header.Get("Location")
		// Pass on the redirect with the original URL
		returnHttpRedirect(conn, resp.StatusCode, getOriginalUrl(location))
	} else {
		// Read the response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			returnHttpBadGateway(conn, "Failed to read response body")
			return
		}
		defer resp.Body.Close()

		// Return the HTTP response
		returnHttpResponse(conn, HTTPResponse{
			Status: struct {
				Code int
				Text string
			}{
				Code: 200,
				Text: "OK",
			},
			Content: struct {
				Type string
				Body []byte
			}{
				Type: resp.Header.Get("Content-Type"),
				Body: body,
			},
		})
	}
}

// Perform an HTTP redirect (301 or 302)
func returnHttpRedirect(conn net.Conn, statusCode int, locationUrl string) {
	statusText := "Found"
	if statusCode == 301 {
		statusText = "Moved Permanently"
	}

	response := fmt.Sprintf(
		"HTTP/1.1 %d %s\r\n"+
			"Location: %s\r\n"+
			"\r\n",
		statusCode, statusText, locationUrl)

	conn.Write([]byte(response))
}

// Return an HTTP response to the client
func returnHttpResponse(conn net.Conn, response HTTPResponse) {
	// Build the HTTP response
	var buffer bytes.Buffer
	buffer.WriteString(fmt.Sprintf("HTTP/1.1 %d %s\r\n", response.Status.Code, response.Status.Text))
	buffer.WriteString(fmt.Sprintf("Server: %s\r\n", ProxyServerName))
	buffer.WriteString(fmt.Sprintf("Content-Type: %s\r\n", response.Content.Type))
	buffer.WriteString(fmt.Sprintf("Content-Length: %d\r\n", len(response.Content.Body)))
	buffer.WriteString("\r\n")

	// Write headers
	_, err := conn.Write(buffer.Bytes())
	if err != nil {
		syslog(fmt.Sprintf("Failed to write headers to socket: %v", err))
		return
	}

	// Write body
	_, err = conn.Write(response.Content.Body)
	if err != nil {
		syslog(fmt.Sprintf("Failed to write body to socket: %v", err))
	}
}

// Return an HTTP 404 Not Found response
func returnHttpNotFound(conn net.Conn, url string) {
	html := `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
The remote server could not find the content:<br>
<b>` + url + `</b>
</body></html>
`

	returnHttpResponse(conn, HTTPResponse{
		Status: struct {
			Code int
			Text string
		}{
			Code: 404,
			Text: "Not Found",
		},
		Content: struct {
			Type string
			Body []byte
		}{
			Type: "text/html",
			Body: []byte(html),
		},
	})
}

// Return an HTTP 502 Bad Gateway response
func returnHttpBadGateway(conn net.Conn, text string) {
	html := `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>502 Bad Gateway</title>
</head><body>
<h1>Bad Gateway</h1>
The proxy server encountered a problem when fetching the content:<br>
<b>` + text + `</b>
</body></html>
`

	returnHttpResponse(conn, HTTPResponse{
		Status: struct {
			Code int
			Text string
		}{
			Code: 502,
			Text: "Bad Gateway",
		},
		Content: struct {
			Type string
			Body []byte
		}{
			Type: "text/html",
			Body: []byte(html),
		},
	})
}

// Return an HTTP 400 Bad Request response
func returnHttpBadRequest(conn net.Conn) {
	html := `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>400 Bad Request</title>
</head><body>
<h1>Bad Request</h1>
The proxy server cannot understand the request or does not support the request method.
</body></html>
`

	returnHttpResponse(conn, HTTPResponse{
		Status: struct {
			Code int
			Text string
		}{
			Code: 400,
			Text: "Bad Request",
		},
		Content: struct {
			Type string
			Body []byte
		}{
			Type: "text/html",
			Body: []byte(html),
		},
	})
}

// Extract the original URL from the Wayback Machine URL
func getOriginalUrl(translatedUrl string) string {
	matches := waybackURLRegex.FindStringSubmatch(translatedUrl)
	if len(matches) == 3 {
		return strings.TrimSpace(matches[2])
	}
	return translatedUrl
}

// Custom error type for HTTP errors
type HTTPError struct {
	StatusCode int
	Message    string
}

func (e *HTTPError) Error() string {
	return e.Message
}

// Perform an HTTP request
func httpRequest(url string) (*http.Response, error) {
	client := &http.Client{
		// Don't automatically follow redirects
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}

	// Check for error status codes
	if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
		return resp, nil
	} else if resp.StatusCode == 301 || resp.StatusCode == 302 {
		// Check if this is an internal wayback machine redirect
		location := resp.Header.Get("Location")
		originalSourceUrl := getOriginalUrl(url)
		originalLocationUrl := getOriginalUrl(location)

		if originalLocationUrl == originalSourceUrl ||
			originalLocationUrl == originalSourceUrl+"/" ||
			originalLocationUrl+"/" == originalSourceUrl {
			// Follow the redirect and return the result
			resp.Body.Close()
			return httpRequest(location)
		}

		// Otherwise, return the redirect for the client to handle
		return resp, nil
	}

	// Handle error responses
	defer resp.Body.Close()
	return nil, &HTTPError{
		StatusCode: resp.StatusCode,
		Message:    fmt.Sprintf("HTTP error: %d", resp.StatusCode),
	}
}

// Log messages with timestamp
func syslog(text string) {
	log.Printf("%s - %s", time.Now().Format(time.RFC3339), text)
}
