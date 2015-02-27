---
layout: post
title: Display Updates in CodeMirror
tags:
- javascript
- cm-internals
- performance
- codemirror
---

This post is part of the [series](./#cm-internals) about the internals
of [CodeMirror](http://codemirror.net). This time, we'll discuss the
way CodeMirror schedules updates to the DOM.

The problem is this: CodeMirror has an internal model of the document
that is being edited, and is displaying a representation of this model
on the screen, using the browser's DOM. These have to be kept
synchronized, for obvious reasons. However, updating the DOM is
costly, especially if you are going to interleave those updates with
reading layout information from it.

Most changes to CodeMirror's display require re-positioning the cursor
or selection. To do this, CodeMirror reads layout information to
figure out the exact placement of the relevant characters. Thus, if
every function that touches CodeMirror's model of the document went
ahead an immediately updated the DOM display, the result would be
mind-bogglingly slow.

This is somewhat similar to the problem that is being solved by the
[React](http://facebook.github.io/react/) library. That library
implements a “shadow DOM” data structure, which is cheap to modify or
rebuild. Only after your program has finished fiddling around with
this DOM is it compared to the actual, live DOM, which is updated, in
one go, to conform to the current shadow DOM. The result is a
higher-level view of a batch of display changes, which allow for more
efficient updating.

The [Atom editor](https://atom.io/) has simply
[switched to React](http://blog.atom.io/2014/07/02/moving-atom-to-react.html)
for their rendering code. (Later edit: they [are switching back](https://github.com/atom/atom/pull/5624).) CodeMirror takes a different approach.

## Operations

The central concept in this approach is that of an
“[operation](http://codemirror.net/doc/manual.html#operation)”, which
groups a bunch of actions performed on an editor together. Operations
are implemented with a higher-order function that does something like
this:

```javascript
CodeMirror.prototype.operation = function(action) {
  if (this.alreadyInOperation()) return action();

  this.setUpOperation();
  try     { return action();        }
  finally { this.finishOperation(); }
};
```

This means that the scope of an operation corresponds to the dynamic
extent of a function call—everything done by that function and the
other functions it calls is part of the same operation. It also means
that operations can be cheaply nested, since the `operation` method
only needs to start an actual operation if we aren't already inside of
one.

All CodeMirror's public methods that change the document are
implicitly wrapped in an operation, so client code only has to worry
about doing its own wrapping when explicitly grouping multiple things
together.

For each operation, a data structure is allocated to track the things
that were done in this operation. For example, there is invalidation
information about the lines of code that are visible on the screen
([remember](a-pathological-scrolling-model.html), not the whole
document is rendered). If lines 10 to 40 are visible, and we make a
change to line 20, that is recorded. If we make a change to line 50,
that is not interesting, since that line hasn't been drawn anyway.
Similarly, there are flags that indicate that other information, such
as the width of the widest line in the document, needs to be
recomputed.

As an example, say you type a character on line 3, which changes the
content of a line, and then that character triggers an auto-indent,
which changes the line again, and then the
[`closebrackets` addon](http://codemirror.net/doc/manual.html#addon_closebrackets)'s
event handler runs, adding another character to the line. Though a
whole bunch of things happened, at the end of the operation started by
the `input` event handler, there is a single invalidated line, line 3,
which needs to be redrawn, once. The cursor similarly only needs to be
repositioned a single time.

## Redrawing text

To track which lines have been drawn, and whether those lines have
changed in the meantime, CodeMirror keeps a _view_ data structure.
This data structure describes a range of the document (which, directly
after a redraw, is the currently visible range), in terms of _visual_
lines, not logical lines. A visual is the unit of rendering. Such a
line normally corresponds to a logical line, but when there is folded
or replaced text present (see the
[`markText`](http://codemirror.net/doc/manual.html#markText) method),
pieces from multiple logical lines might visually end up on the same
line.

The display data structure contains references to the DOM nodes that
represent the given visual lines in the current DOM, as well as data
and caches related to character measurement (which has to be
invalidated at the same time as the DOM nodes themselves).

Whenever the text, or the styling of the text, inside a single line is
changed, the relevant code will call the internal `regLineChange`
function, which checks if the line is currently rendered, and marks it
as invalidated if it is. Different kinds of invalidation are
distinguished, so that many changes (such as a class change, gutter
change, or line widget addition) can be applied without a full redraw
of the line.

When a range of lines change, possibly adding or removing lines in
between, another function (`regChange`) is called, which patches up
the current view to reflect the new situation. This is somewhat
involved, due to the way our coordinate system (line numbers) is
changing under our feet when lines are added or deleted, and further
complicated by the fact that folding information might also change.

During a display update (at the end of an operation), the display is
re-synced with the editor's current scroll position, cutting off parts
outside of the viewport and adding new parts that were not previously
covered. The display is then actually redrawn, ensuring that all
visual lines in the view are actually present and up-to-date in the
DOM again.

## Update ordering: Walking on eggs

Having a single function drive all DOM updates makes it a lot easier
to order these to prevent unnecessary relayouts. But, unlike most UI
code, CodeMirror is dependent on the output of the browser's layout
algorithm in a number of cases. As mentioned before, it uses real
measurements of character position to place the cursor and selection,
rather than assuming everything is left-to-right unstyled monospace
text that allows us to compute positions ourselves. In addition, the
[faked scrollbars](a-pathological-scrolling-model.html) need to be
resized and shown or hidden depending on the actual size of the
document.

The display update code is organized in a rather convoluted way,
caching measurements and ordering actions by their place in the update
pipeline, rather than by subsystem. This way, it keeps the number of
relayouts down to one or two for most operations. Unfortunately, it is
very easy to break this when changing the code, and I have not yet set
up an automated way to detect regressions. Chrome Dev Tools’ time line
view has been an invaluable help in finding sources of unnecessary
relayouts.

The operation-managing code has recently (in version 4.4) been changed
to not just synchronize display updates within a single editor, but
across CodeMirror instances. That means that if you have a bunch of
editors on your page, for example showing different views on a bigger
document, updating all of them is a lot cheaper than it used to be.
