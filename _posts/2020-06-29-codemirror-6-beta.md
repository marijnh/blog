---
layout: post
title: CodeMirror 6 Enters Beta
tags:
- javascript
- codemirror
---

I'm happy to announce that with version 0.8.0 the [CodeMirror
6](https://codemirror.net/6/) project is entering its _beta_ phase,
and you're very much invited to start trying it out and poking at it.

Roughly, this “beta” status means:

 - I actually like the current programming interface. Apart from the
   move from a mono-package to a group of separate packages (removing
   the `next/` in the package names), no significant breaking changes
   are planned. There might still be breaking changes in peripheral
   parts of the interface, when real-world experience shows the
   current interface to be problematic, but these should be of the
   type where a quick scan of the release notes and some grepping
   through your code are enough to adapt to them.

 - The system is no longer a hopeless unfinished mess. In fact, it
   seems to work pretty well. Which isn't to say it won't break in
   your use case, of course, since it has seen little practical use
   yet and you're likely to be the first to do some specific thing
   with it.

 - I've put together enough
   [documentation](https://codemirror.net/6/docs) for people who don't
   want to read source code to be able to figure out how the system
   works. Some of those docs are still rough ([issue
   reports](https://github.com/codemirror/website/issues/) welcome),
   but they should be usable.

You can read the [change
log](https://github.com/codemirror/codemirror.next/blob/master/CHANGELOG.md)
if you want to see, in some detail, what I've been up to in the past
months.

## Project Goals

The
[retrospective](https://raphlinus.github.io/xi/2020/06/27/xi-retrospective.html)
for the [Xi editor](https://github.com/xi-editor/xi-editor) project
has inspired me to also spend some time thinking about this project's
goals, and how they developed.

In the initial announcement, we emphasized these goals:

 - Accessiblity (especially screen reader usability)

 - Mobile support

 - Native Unicode/bidirectional text support

 - Modularity

 - Performance (especially avoiding performance cliffs for huge files
   or long lines)

 - Well-designed, TypeScript-friendly programming interface

Most of these we followed through on pretty much as planned. The
exception to this is the bidirectional text and Unicode support—that
did get implemented, but not by leaning on native behavior.

The reasons for this are:

 - It is often extremely hard or awkward for scripts to interact with
   the native behavior. Though browsers compute an odering for
   bidirectional text, scripts cannot access this ordering. Though
   browsers (sort of) have advanced cursor motion logic, the only way
   to get at this is to focus an element, put the selection in there,
   use
   [`Selection.modify`](https://developer.mozilla.org/en-US/docs/Web/API/Selection/modify)
   to move it, and then see where it went.

 - Often the native behavior just isn't very good. Chrome, after we
   started this project, seems to have [given
   up](https://bugs.chromium.org/p/chromium/issues/detail?id=958831)
   on proper visual cursor motion. When there are non-text elements in
   the document, cursor motion is inconsistent between browsers and
   often just broken.

 - Even when the native behavior isn't downright buggy, it might not
   be what we want for a code editor. Selecting by word should take
   criteria specific to the programming language into account, for
   example.

Thus, the project has ended up with its own implementation of Unicode
segmentation, bidirectional text ordering, and, on top of that, cursor
motion. The original vision was that we could avoid this, but that
didn't turn out to be realistic. On the bright side, not depending on
native behavior makes the library a lot less susceptible to all the
bugs and inconsistencies in those native implementations.

Of the remaining points, _modularity_ is probably the one that I
underestimated the most. Just organizing the library core as a number
of separate modules was already a somewhat subtle exercise, but the
real difficulty lies in making sure 3rd party code
[composes](https://marijnhaverbeke.nl/blog/extensibility.html)
smoothly. The extension system went through four or five rewrites, and
drove me to desperation at times, but I'm happy with what we landed
on.

Avoiding performance cliffs has also required a lot of discipline to
make sure complexity is only linear to document or line length when it
absolutely needs to be, as well as careful API design to avoid making
the slow approach the easiest or most obvious one. But I feel the
vision has been realized well.

Having lived with a latent anxiety about whether I'd be able to
deliver this project's promises for over two years now, I think I'm
about to start actually believing I can. That's a relief.

## What is Missing

The main thing you'll probably notice, when trying to integrate the
library, is that a lot of languages don't have any support yet. This
is the next thing on my roadmap. I'll implement proper support for
some more major languages, and port most of the old CodeMirror 5 modes
so that they can run in CodeMirror 6 (though, apart from some
languages that are absolutely unparseable in a context-free way, the
vision is to move to [Lezer](https://lezer.codemirror.net) grammars
for all important languages).

Next up would be the mostly-drop-in compatibility wrapper to the
CodeMirror 5 interface that I've been talking about.

(But right now, we have summer holiday here, and the pace of work will
be slow to nonexistant during the coming weeks.)
