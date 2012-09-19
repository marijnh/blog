---
layout: post
title: CodeMirror 2.34 and 3.0beta1 released
tags:
- codemirror
---

I've just marked the current state of the master branch as version
2.34. The main changes are:

 * New mode: [Common Lisp][cl]
 * Fix right-click select-all on most browsers.
 * Change the way highlighting happens:
   * Saves memory and CPU cycles.
   * `compareStates` is no longer needed.
   * `onHighlightComplete` no longer works.
 * Integrate mode (Markdown, XQuery, CSS, sTex) tests in the central testsuite.
 * Add a [`CodeMirror.version`][ver] property.
 * More robust handling of nested modes in [formatting][fmt] and [closetag][ct] plug-ins.
 * Un/redo now preserves [marked text][mt] and bookmarks.
 
[cl]: http://codemirror.net/mode/commonlisp/
[ver]: http://codemirror.net/doc/manual.html#version
[fmt]: http://codemirror.net/demo/formatting.html
[ct]: http://codemirror.net/demo/closetag.html
[mt]: http://codemirror.net/doc/manual.html#markText

See [github][cmp] for a full list of patches. Get the zip file from
[the website][zip].

[cmp]: https://github.com/marijnh/CodeMirror/compare/v2.33...v2.34
[zip]: http://codemirror.net/codemirror-2.34.zip

2.34 will be the last 'full' release on the 2.x branch. I will
continue to bring out bugfix releases on that branch for at least two
more months, but new work will, from now on, happen on version 3.

The first beta version of CodeMirror 3 also came out today. The jump
to version 3 is mostly a result of some of the major work I did last
month, that the community [generously sponsored][pledgie]. Some of
that work required incompatible API changes, and those changes landed
in version 3 rather than the 2.x branch. The current beta has no known
major problems ([issue list for v3 milestone][issues]), but contains a
lot of new code, and a serious overhaul of the old code, so I would
not recommend using it in production yet.

[pledgie]: http://pledgie.com/campaigns/17784
[issues]: https://github.com/marijnh/CodeMirror/issues?milestone=2&state=open

I *would* be very thankful for any testing, of the editor in general
and especially of the new features. I've written an
[upgrade guide][upgrade] that describes what changed, what's new, and
how to adjust your code to it.

[upgrade]: http://codemirror.net/3/doc/upgrade_v3.html

The zip file for version 3 is on [the website][zip3], and its
development takes place on the [v3 branch][v3] in the git repository.

[zip3]: http://codemirror.net/codemirror-3.0beta1.zip
[v3]: https://github.com/marijnh/CodeMirror/tree/v3
