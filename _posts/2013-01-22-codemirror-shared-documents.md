---
layout: post
title: Shared documents in CodeMirror
tags:
- javascript
- codemirror
- cm-internals
---

From the very start, CodeMirror was set up as a system with zero
unused abstractions.

This is a doctrine that I've come to esteem highly: write code that
solves the current problem you have, and *not* a bunch of other,
similar problems that you can imagine someone may have in the future.

And such a system *will* have to grow, almost without exception, as
new use cases come up. But I argue that a non-minimal system, no
matter how much time was spent on a genius architecture up front, will
*also* have to change to deal with new realities. I haven't yet met an
engineer who was able to accurately predict future uses of her
systems. I certainly can't. Such a more abstract system would have
more code, and thus more inertia—it takes more work to pull it into a
different direction.

All code is, in principle, throw-away code. I might not actually throw
it away, but I am prepared to, and fully expecting to, change it in
radical, major ways after I write it. Thus, rather than writing code
in a way that makes it flexible enough to adjust to future
circumstances, I focus on keeping code small and simple enough to
extend it to future circumstances without much effort.

Of course, as use cases accumulate, systems do get bigger, and
abstractions are built up. But these, all being responses to actual
real-world situations, are adding obvious value to the software. And,
if the use case they address is found to be misguided, or they turn
out to not address it very well, they are pitilessly scrapped and
replaced by improved approaches.

## The document / editor unit

So, CodeMirror was set up as a system with zero unused abstractions. A
potentially surprising design decision in the CodeMirror API,
motivated by this principle, is that documents were not separate from
editor instances. For the initial textarea-like use case, this was not
needed. An editor had a single document associated with it, and though
it internally had a specific representation for this document, the
only way the outside world could access it was as simple string data.

On the bright side, this means, there wasn't any nonsense like
`editor.​getView().​getDocument().​getValue()`. You'd simply say
`editor.getValue()` instead. And that way will remain
supported—interfaces conceived as the simplest thing that solves the
problem tend to be wonderfully straightforward and direct. Adding
features to a system by non-invasively working them into an existing,
simple interface tends to produce better interfaces than directly
exposing an internal model that is more complicated than the typical
use case, forcing users to deal with the indirection even when they
don't need it.

## Splitting the document from the editor

Recently, CodeMirror is coming to the point where it is quite
obviously no longer just a replacement for a textarea. Most users do
use it as such, and it is a design goal to remain frictionlessly
useable in that way. But projects like [Light Table][lt] and
[Brackets][brak] are full featured code editors, pushing into the same
space as traditional desktop editors.

[lt]: http://www.lighttable.com/
[brak]: http://brackets.io/

And such editors can do things like display multiple views on the same
document. As in, *really* the same document, not a copy of the
document that's being kept in sync with some event listeners and some
duct tape. For example, the views should be able to share a single
undo history.

Another use case that both Light Table and Brackets pushed was being
able to create a subview on a document—show a piece of a bigger
document (say twenty lines out of a thousand line document) in an
editor, keeping them strictly synchronized with the corresponding
range in the parent document.

## Picking a cutting point

I mentioned before that, internally, there was already the concept of
a pretty well-separated document data structure. But, in order to make
an interface public, simply making it accessible is rarely the whole
story. You are also, if the interface is any good at all, saying that
the concepts exposed can be recombined in every useful way that the
user can come up with.

So whereas CodeMirror *internally* had the invariant that a document
and an editor were married together till death do them part, a public
document / editor interface would have to cater to a much bigger range
of use cases—putting a new document into an editor, sharing documents
between editors (the motivating use case), and all the
consistency-maintenance issues that come with those.

But, on the flip side, doing the most general thing possible is also
not optimal. Specifically, if the interface is so general that it also
allows nonsensical situations to come up, it'll force us to write code
to handle these situations. As a concrete example, if editors and
documents are separate, should we allow editors without documents to
be created? My answer is *no*, we most certainly should not. Such an
editor would be in a thoroughly exceptional, yet more or less useless
state. A whole bunch of assumptions about CodeMirror instances (that
you can call `getValue()` on them, for example) would not hold for
such editors. Or, we'd have to write special-cased code to somehow
make them hold (`if (nodoc) return ""`). That would bloat the library,
introduce lots of interesting new potential bugs, and generally waste
everybody's time.

Thus, the trick is to move the interface towards something that's
flexible enough, but not too flexible. And also to stay backwards
compatible with the existing, straightforward API.

I went back and forth a few times, started on a few implementations
that I had to back-track from, but feel I did find something
satisfactory in the end.

One initial idea that I gave up is that documents and views should be
different concepts. That sounds obvious, doesn't it? A view would have
a scrolling position, a cursor position, and a document. A document
would just be text. Separating responsibilities, and all that.

But merging the two allows us to establish some invariants, such that
a document always has a cursor position associated with it, and
invariants, when they don't get in the way, are *good* for software.
It also cuts down a whole layer of cruft in the interface that users
have to deal with. And the only cost is that, for the rare case where
you don't need a selection or scroll position to be tracked for a
specific document, there'll be a few unused object allocated. Objects
that make up less than a percent of the memory footprint of even a
small-sized document.

But, you may protest, if the cursor position is associated with the
document, how are you going to have multiple view on a single
document? Good question. The answer involves another non-intuitive
design decision. There are no multiple views on a single document.
Instead, there are 'linked' documents—when documents are linked, they
propagate changes made to them to each other, in a way that (barring
bugs in the code or data corruption) ensures they stay 100%
synchronized.

Having two document representations for what is essentially a single
document sounds sort of wasteful. But if you refer back to the
[entry on CodeMirror's document representation][docrep], you'll see
that this is a representation designed around the need to index lines
by vertical offset. And those vertical offsets depend on a line's
visual height. And there is no guarantee that multiple views will
render lines in exactly the same way. Thus, this data structure will
have to be duplicated for each view anyway.

[docrep]: codemirror-line-tree.html

Having a canonical central data structure, when each view needs its
own height index, is mostly an extra waste of memory. Since these
height indices can *share* the actual string values that represent the
document's content, their memory overhead is reasonable.

## The undo history dilemma

Earlier, I mentioned shared undo histories in the context of
split-view / shared-document situations. In a classical split view,
you see two copies of the same document, side by side, and as you make
a change on one side, it appears on the other side. And when you then
move your focus to the other view and toggle undo, the common
expectation is that that will undo the last change you made, in any
view, rather than the last change you made in the view where you
issued the undo command.

Thus, if the two views are showing documents that are linked together,
those documents should share a single undo history.

Now consider the situation where we create a subview of a large
document, for example, a user issues a command 'show-definition-of',
and we pop up a mini editor at the bottom of the screen that shows the
definition of the thing the cursor was over. This mini editor is a
subview into another open document, which we may have edited before,
or which we may still edit as the mini editor is being shown.

Now, if you trigger an undo in this mini view, after a change has been
made in another view on that document, at a point that's not visible
in the mini view, what should happen?

Most people agreed that silently undoing something in far-away text
that isn't part of the focused view is usually not a good thing.
Several heuristics were proposed for kinda sorta doing doing the right
thing, but I judged them all too unpredictable and random. Instead,
when you create a linked document by calling the `linkedDoc` method
on a document, you can specify whether the histories of the existing
document and the newly created one should be shared or not.

Linked documents without a shared history are slightly tricky. Changes
will propagate from A to B, but without being added to B's undo
history. An undo history represents change sets that can be applied to
the *current* document to go back in history (and, potentially, redo
change sets to go forward). But when the current state of the document
isn't in sync with the top change set in the history, such a change set
can not be cleanly applied. An analogy with git, or other revision
control systems, applies well here. We have a set of patches, and we
want to be absolutely sure that they can actually be applied to our
document without conflicts.

Thus, to borrow more terminology from git, when a change comes in from
a document that doesn't share a history with us, we *'rebase'* our
existing history. This rebasing, in CodeMirror, is a rather simple and
destructive process that simply updates these patches, when they don't
conflict, to account for changes in line numbers, and when they do
conflict, discards them. Thus, if document A and B are linked without
a shared history, and I edit line 10 in A, and then edit line 10 in B,
my undo event in A will be lost, since it conflicted with a more
recent edit in B.

## The linkage tree

Because document links are (exclusively) created by 'deriving' a new
document from an existing one, the relations between a set of linked
documents form a tree (and are stored as such). This means that there
are no cyclic links possible, and traversing such a tree, for example
to propagate a change, is easy—just walk the graph, recursing into all
neighbors except for the one we came from.

It also means that sets of documents with a shared history form
'islands' in the tree. Documents that share history with no one can be
seen as single-document islands. By storing the shared-history flag in
the edges of the graph, it is very easy, when traversing it, to notice
when we are entering another island. This is used by the code to, for
example, know when it should rebase histories when propagating a
change.

## Subviews

The linked-document model allows subviews to be modeled in a
straightforward way. When creating a linked document, you can pass a
range of lines in order have the new document only contain a slice of
the original document.

I opted to make line numbers 'cross-document'—meaning that if you
create a subview that contains lines 100 to 120 of some larger
document, the first line of the sub-document will have number 100, not
zero. This removes the invariant that the first line in an editor is
zero, which required some adjustments, but also means that, as a
change propagates between editors, it stays inside the same
'coordinate system'.

Of course, changes still have to be clipped when they propagate from a
document to a subview of that document. And unfortunately, how to clip
them, when the change overlaps with the boundaries of the subview, is
an underconstrained problem. There are multiple credible solutions.
Underconstrained problems are the worst kind of problems, because
usually, none of the possible solutions are perfect.

Say, in the example subview that holds lines 100 to 120 of its parent
document, that someone selects lines 0 to 110 in this parent document,
and then pastes a twenty-line replacement. Obviously, the first ten
lines of the subview must be removed, but as for the question whether
the replacement text should end up in full, in part, or not at all in
the subview, there is no correct answer. One outcome could be that the
subview is left only ten lines big (20 to 30, containing the range
that used to be 110 to 120, pre-change), another could be that it
includes the pasted text (spanning line 0 to 30).

I ended up going with the first solution (not including the inserted
text in the subview), on the intuition that a change that starts or
ends outside of a narrowed subview probably has no business in that
subview. Fortunately, changes like this, that both delete and add
multiple lines, are relatively rare, so people won't run into my
arbitrary decision very often.

## Large-scale method delegation

A lot of methods that used to exist on editor instances, basically
everything that involves document inspection, document modification,
or selection, are now defined on document instances instead. For
backwards-compatibility, and in order to keep the interface easy to
use, I'd like to continue supporting calls of these methods directly
on the editor instance.

So now there's a loop in the CodeMirror source that goes over a long
list of method names, and for each of them, adds a method to the
CodeMirror prototype that forwards the call to the editor's current
document.

## The goods

The changes outlined above landed on CodeMirror's master branch right
after yesterday's 3.01 release. The updated manual describes them,
specifically in the [section on document management][manual].

[manual]: http://codemirror.net/doc/manual.html#api_doc
