---
layout: post
title: CodeMirror 6.0
tags:
- javascript
- codemirror
---

[CodeMirror 6](https://codemirror.net/6/) is a new code editor library
for the web, a from-scratch implementation based on the experience of
building and maintaining versions 1 to 5 for the past 13 years. It
aims to be more extensible and accessible than previous versions.

As of today, version 6.0 is stable. Going forward, probably at least
several years, all new releases will be under the 6 major version, and
be backwards compatible.

The library has been usable and largely stable for over a year, with
only minor breaking changes. I generally prefer to release late, to
avoid having too many regrettable mistakes slip into the stable
release, which would then have to be kept there indefinitely. Without
a doubt there will be things that, a year from now, I wish I had
released differently, but by having users work with the code in
production for a significant amount of time, a lot of small issues and
sources of friction have been found and resolved before being set down
in stone.

Work on this system started four years ago, with [Prototype
Fund](https://prototypefund.de/en/) funding the initial work. It was
announced publicly and crowd-funded a year after that, built out into
a useable system in the two years after that, and refined and
stabilized in the past year. During the first two years, I
collaborated with Adrian Heine on the design and implementation of the
initial system.

For some more background on the new library, see the blog posts on
[Lezer](lezer.html) (the parser system), [facets](facets.html) (the
extension system), and [collaborative
editing](collaborative-editing-cm.html). For an overview of the entire
system, take a look at the [system
guide](https://codemirror.net/6/docs/guide/). For a rough summary of
what changed in the interface since 5.x, see the [migration
guide](https://codemirror.net/6/docs/migration/).