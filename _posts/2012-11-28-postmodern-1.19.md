---
layout: post
title: Postmodern 1.19 released
tags:
- common lisp
---

[Postmodern][pomo] is a Common Lisp library for communicating with a
[PostgreSQL][pg] database. Sabra Crolleton recently published a nice
[collection of examples][sabra] for the library. That reminded me that
it's been over a year since the last release.

[pomo]: http://marijnhaverbeke.nl/postmodern
[pg]: http://www.postgresql.org/
[sabra]: https://sites.google.com/site/sabraonthehill/postmodern-examples

There have been several major improvements, including support for
[notifications][not] and [bulk copying][bulk], so a release was in
order, if only to prevent the impression that the library was not
being maintained.

[not]: http://www.postgresql.org/docs/current/static/libpq-notify.html
[bulk]: http://marijnhaverbeke.nl/postmodern/cl-postgres.html#bulk-copying

So there it is, Postmodern version 1.19. Get it from the
[project page][pomo].
