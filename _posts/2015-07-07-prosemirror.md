---
layout: post
title: ProseMirror
tags:
- javascript
- prosemirror
- architecture
---

Sometimes I lie awake at night, feverishly searching for new ways to
load myself down with more poorly-paying responsibilities. And then it
comes to me: I should start another open-source project!

Well, that's not really what happens. But the effect is the same. I
keep building complex, demanding pieces of code and then giving them
away. The actual mechanism is usually that I think of some technical
concept, find out that it hasn't been done yet, and through some mix
of curiosity and ego, just _have_ to see if I can do it.

Here's the newest damage: [ProseMirror][pm], a browser-based rich text
editor. Though I'm not giving it away per se, but running [a
crowd-funder][igg] to open-source it, and have
[thought](./sustainable-maintenance.html) a bit about how to make
after-release maintenance sustainable.

[pm]: http://prosemirror.net/
[igg]: https://www.indiegogo.com/projects/prosemirror/

## An Editor?

Didn't I just talk about implementing things that have “not been done
yet”? And aren't there at least a hundred browser-based rich text
editors out there?

Yes, and yes. But none of the existing projects take the approach that
I think would be ideal. Many of them are firmly rooted in the old
paradigm of relying on `contentEditable` elements and then trying to
sort of clean up the resulting mess. This gives us very little control
over what the user and the browser are doing to our document.

What do we need control for? For one thing, it makes it much easier to
keep the document in a sane state. If the document is only modified by
your code, you can define these modifications so that they preserve
the invariants you want to preserve, and you can ensure that the same
thing happens on different browsers.

But more importantly, it allows you to represent these modification in
a more abstract way than “something changed around here, and this is
the new document state”. And that is extremely helpful when
implementing collaborative editing—to effectively merge conflicting
changes from multiple users, it helps to have an accurate
representation of the _intent_ of the changes.

## General Approach

ProseMirror does create a `contentEditable` element that it displays
its document in. This gives us all the logic related to focus and
cursor motion for free, and makes it much, much easier to support
screen readers and bidirectional text.

Any actual modifications made to the document are captured by handling
the appropriate browser events, and converted to our own
representation of these modifications. Assuming relatively modern
browsers, this is easy for most types of changes. We can handle key
events to capture typed text and things like backspace and enter. We
can handle clipboard events to make copy, cut, and paste work. Drag
and drop are also exposed through events. Even IME input fires
relatively usable [composition events][comp].

[comp]: https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent

Unfortunately, there are a few cases where browsers don't fire events
that describe user intent, and all you get is an after-the-fact
`input` event. This happens when picking a correction from the spell
check menu, for example, and also when using key combinations to type
special characters (for example “Multi-e =” to type “€” on Linux).
Fortunately, all such cases that I have run across so far involve
simple, character-level input. We can inspect the DOM, compare it to
our representation of the document, and derive the intended
modification from that.

When a modification is made the editor's representation of the
document is changed, and then the display (the DOM element on the
screen) is updated to reflect the new document. By using a persistent
data structure for the document—making a change creates a new document
object, without mutating the old one—we can use a very fast
document-diffing algorithm to make only the DOM updates that are
actually necessary. This is somewhat similar to what [React][react]
and its various spin-offs do, except that ProseMirror works with its
own representation of the document, not with a general-purpose
DOM-like data structure.

[react]: https://facebook.github.io/react/

## The Document

This document representation is explicitly not HTML. It is also a
“semantic” representation of the document, and a tree-shaped data
structure that describes the structure of the text in terms of
paragraphs, headings, lists, emphasis, links, and so on. It can be
rendered as a DOM tree, but also as Markdown text, and any number of
other formats that happen to be able to express the concepts it
encodes.

The outer part of this representation, the part that deals with
paragraphs, headings, lists, and so on, is especially DOM-like in its
structure—it consists of nodes with child nodes. The content of
paragraphs nodes (and other block elements such as headings) is
represented as a flat sequence of inline elements, each of which has a
set of styles associated with it. This works better than using a tree
structure all the way, as the DOM does. It makes it easier to enforce
invariants like not allowing text to be emphasized twice, and allows
us to represent positions in paragraphs as simple character offsets,
which are easier to reason about than positions in a tree.

Outside of paragraphs, we are forced to work with a tree. So a
position in the document is represented by a path, which is a sequence
of integers denoting the child indices at each level of the tree, and
an offset into the node at the end of this path. This is how the
cursor position is represented, and how the positions at which
modifications should happen are stored.

ProseMirror's current document model mirrors that of Markdown,
supporting precisely the things that can be expressed in that format.
In the future, you will be able to extend and customize the document
model you want to use in a given editor instance.

## Interface

The editor currently comes with a two styles of user interface. One is
the classical toolbar at the top. The other shows tooltips above your
selection to do inline-level styling, and a menu button to the right
of the currently selected paragraph for block-level actions. I rather
like the latter, since it gets out of your way when you are not using
it, but I expect many people will prefer the familiar toolbar.

But these interfaces are implemented as modules outside of the editor
core, and other interface styles can be implemented on top of the same
API.

Key bindings are also configurable, closely following
[CodeMirror][cm]'s model. The functionality that keys are bound to is
available as named _commands_, and can also be run from scripts using
the `execCommand` method.

[cm]: http://codemirror.net/doc/manual.html#keymaps

Finally, there is a module called `inputrules` that can be used to
specify that something should happen when text matching a given
pattern is typed. It can be used for things like “smart quotes”, but
also to make a list appear if you type “1.” and press space.

## Collaboration

I mentioned collaboration before. A significant amount of the work
that went into this project went into making it support collaborative
real-time editing. I wrote [another blog
post](./collaborative-editing.html) about the technical details, but
the concepts is roughly this:

When a modification is applied to the document, it creates a new
document as well as a position map, which maps positions in the old
document to positions in the new document. This is needed to, for
example, move the cursor in response to modifications.

Being able to map positions makes it possible to “[rebase]”
modifications on top of other modifications by mapping the position(s)
at which they should be applied. There's more to this, and I rewrote
this aspect of the system several times before getting it right, but I
am pretty confident I ended up with something that works.

[rebase]: http://git-scm.com/docs/git-rebase

In a collaborative scenario, when a client makes modifications, they
are buffered locally and sent to the server. If another client
submitted its modifications before ours arrive, the server responds
with “nope, apply these modifications first”, and the client takes the
modifications, rebases its own ones on top of them, and tries again.
When they go through, they are broadcast to all other clients, making
sure everybody stays synchronized.

## Target Audience

Who do I expect to use this?

* On the one hand, sites that are using Markdown or some similar
  format for input might want to offer a more easily learnable
  interface for their less technical users, and then just convert the
  result to Markdown.

* On the other hand, sites which have been offering traditional rich
  text input but want control over what comes out might want to move
  to ProseMirror, since having the editing experience directly reflect
  and enforce your constraints beats cleaning up messy HTML and hoping
  for the best.

* Finally, I expect the solid support for collaborative rich-text
  editing will clear out a niche that doesn't really exist yet,
  allowing people to move some things that they'd currently do on
  Google Docs into their own products.

Sounds interesting? See how the [crowd funding campaign][igg] to
open-source this is doing.