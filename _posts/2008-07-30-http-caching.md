---
layout: post
title: HTTP Caching
tags:
- http
---

(This is something I wrote for a now-defunct web publication in 2008. I've inlined the text here.)

## Giving caches a chance

Though it tends to get treated as one, HTTP is not just a dumb file-transfer protocol. It allows you, to a certain degree, to specify an intention with your requests (GET/POST, with PUT and DELETE thrown in if you really want to), it has a somewhat structured method for parameter passing, supports content negotiation, does authentication. But what I want to talk about here is caching.

Until recently, my experiences with caching had been mostly in the form of fighting against it. Any web developer will have experienced browsers (one of them in particular) inappropriately caching pages and scripts — causing users to see old content, or load broken scripts even after we fixed them. Typically, you then added some magical headers that you found through a random web-search and behold, the browser stops caching and all is well.

The reason browsers behave like this is, of course, that it is a lot of work to constantly fetch all these files. Not doing it saves bandwidth, and makes pages load quicker. When it works, this is decidedly a positive thing. The orginal vision for HTTP was for a more static world than today's web, where clients and proxies could happily cache content, dramatically reducing the load on the infrastructure. It did not work out that way, generally, since somewhere near the turn of the century the use of Perl and PHP to generate pages exploded, and every web-developer who was with it started to insist on making everything completely dyntamic. Some of the fads that were born then (visitor counters!) have since died out, but the idea of web pages I visit being tailored just for me (showing whether I'm logged in, what I'm allowed to do), and being derived from databases rather than static files, has become 'the way things are done'.

This dynamic approach is relatively easy to set up, and for systems that are not seeing heavy use it works perfectly well. Only when a site is being accessed heavily does the wastefullness of such an approach becomes apparent: You are building up a page from scratch — probably involving a bunch of calls to a database, some file accesses, potentially some expensive computation — for every single hit, even though the page returned is likely to be very similar to the one you generated 37 milliseconds ago for another request.

One solution is to use a system like [memcached](http://en.wikipedia.org/wiki/Memcached) to cache chunks of data and fragments of pages on the server side. For a lot of situations, though, HTTP itself provides a well-specified and elegant model for caching content.

There are two forms of caching in HTTP: The expiration model and the validation model. In the first, the server includes a header in its response that tells the client how long the content stays 'fresh'. The client is allowed to use this content as long as it is fresh without checking back with the server. Using this with a long expiration period is very rarely what you want, since you more or less lose control over what the user is seeing, but does have the advantage that repeated accesses can be done without causing any server load. Sometimes useful for stuff that you know won't change, such as archived content.

The second model, validation, is more interesting. Here the server sends a piece of information identifying the version of the current content, either in the form of a last-modified date, or an 'entity tag' — an opaque identifying string, for example an MD5 hash of the content. On subsequent requests, the client may send a header indicating the version it currently has cached, and the server has the choice of sending back a response with status code 304 (not modified) if that version is still up to date. If it is not, you can proceed as normal and generate the proper content. Web servers typically do this automatically when serving static files, using the file-system's modification times.

To use expiration caching, you simply send along a header like this:

Expires: Tue, 21 Jul 2009 10:11:33 GMT

Note the convoluted date format. Your web library hopefully has functions for reading and writing timestamps in that format.

Validation caching requires you to add either a Last-Modified or an ETag to their responses, or both...

Last-Modified: Mon, 21 Jul 2008 08:32:35 GMT
ETag: "xyzzy"
Cache-Control: max-age=0, must-revalidate

(The Cache-Control headers tells the browser that is _not_ okay to re-use its cached version of the content without asking the server whether it is up-to-date.)

Before responding, you determine the resource's current last-modified date or entity tag, and check for If-Modified-Since or If-None-Match headers. When an If-Modified-Since header with a date no older than the resource's modification date is given, you immediately respond with a 304 response, and do not have to generate your page. The same happens when an If-None-Match header is given that includes the current entity tag — though in this case, you have to make sure to re-send the ETag header along with the 304 response.

(For the fine print on any of this, consult the the [HTTP 1.1](http://www.w3.org/Protocols/rfc2616/rfc2616.html) specification — which is relatively concise and readable, and more authoritative than a lot of the stuff that gets written about the subject online.)

The tricky aspect of this is, of course, reliably determining when a page should be considered modified. How this works depends entirely on the application. For a blog it can be relatively simple, for a complicated site full of dynamic widgets it might be impossible. If you take cacheability into account while designing your site, and avoid obvious things like showing the current time on the page, this doesn't have to be difficult. One useful trick is to have JavaScript take care of some dynamic aspects, such as showing the name of a logged-in user, and hiding controls that he or she does not have access to (though this does have some accessibility ramifications).

Just getting people's browser to cache stuff, while it can help, is hardly a life-saver. The beauty of the HTTP protocol is that if you do caching right, it is very simple to add your own proxy server in front of your server, and have it cache requests for multiple clients. The proxy will behave in almost the same way as a client, understanding cache-related headers and asking for modified content at the appropriate time, and is relatively easy to 'drop in' when load becomes an issue.

One likely way to screw up when using a proxy is being too liberal with your caching. If you _do_ render the name of the logged in user in your HTML, you do not want your proxy to serve the page with Bob's name in it to Alice. And if you render a page showing a user's private info, such as credit card number (well, you should probably never do that, certainly not over non-secure HTTP), you clearly do not want that page to be cached and sent to someone else. There are a few more directives that can be given to the Cache-Control header for cases like this, and will be respected by any half-decent proxy program. 'private' indicates that the response is meant only for the current recipient, and that only that recipient should cache it. 'no-store' can be used to tell any and all caches to _never_ store this response on disk. It is a good idea to add that whenever you are returning sensitive information that you do not want to accidentally end up on someone's hard disk.

Finally, for services that provide some kind of remote procedure call interface — XML-RPC, JSON, whatever, as long as it is HTTP — determining last-modified dates or entity tags right is often quite simple, since such requests tend to be more focused than web page requests. You could even use a proxied HTTP service internally in your server to access data that benefits from local caching, as an alternative to memcached.
