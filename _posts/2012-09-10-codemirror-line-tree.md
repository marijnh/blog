---
layout: post
title: CodeMirror's document representation
tags:
- javascript
- codemirror
- cm-internals
---

This post is part of an ongoing series of articles that aim to
document the internals of the [CodeMirror][cm] code editor. I will use
the `cm-internals` tag to distinguish these posts—if you intend to
hack on CodeMirror, it might be worthwhile to see what else is there.

[cm]: http://codemirror.net

## The problem

The initial implementation of CodeMirror 2 represented the document as
a flat array of line objects. This worked quite well—splicing arrays
will require the part of the array after the splice to be moved, but
this is basically just a simple `memmove` of a bunch of pointers, so
it is cheap even for huge documents.

However, in version 2.17 (November 2011), I added support for line
wrapping and code folding. Once lines start taking up a non-constant
amount of vertical space, looking up a line by vertical position
(which is needed when someone clicks the document, and to determine
the visible part of the document during scrolling) can only be done
with a linear scan through the whole array, summing up line heights as
you go. One of the design goals of CodeMirror is to make editing
responsive even in huge document. So this is not an acceptable
solution.

## Considerations

Operations that an effective document representation must be supported
are looking up lines by line number, looking up lines by vertical
position (for example, when figuring out where in a document a mouse
click happened, or which lines are visible given a vertical scroll
position), the reverse of those two operations (going to a line number
or vertical offset given a line object). Furthermore, inserting and
deleting lines, as well as updating the height of a line, should be
cheap operations.

Anyone with a single computer science course under their belt will
recognize this as a problem that calls for some sort of tree
representation.

A regular binary tree would work. But the kind of update operations
that we should be worried about are big ones—pasting a huge chunk of
text, or selecting a few thousand lines and and then pressing delete.
All balanced binary trees that I'm familiar with define only
single-element insertion and deletion operations, which would have to
be repeated a huge amount of times in the case of such mass updates.

We'd also prefer to keep tree depth to a minimum, because we'll be
traversing this tree to find a line node or to update a line's parent
nodes a *lot*—conversion between line numbers and line objects are
rampant, because both describe essential properties of a line. (The
number can not be stored in the line object, because that would
require every single line object to be updated whenever someone
presses enter near the top of the document.)

## Representation

The new representation is based on a [B-tree][btree]. These have the
wide branching factor (and thus shallow depth) that we need, and lend
themselves very well to bulk updates (more on that later).

[btree]: http://en.wikipedia.org/wiki/B-Tree

The leaves of the tree contain arrays of line objects, with a fixed
minimum and maximum size, and the non-leaf nodes simply hold arrays of
child nodes. Each node stores both the amount of lines that live
inside of them and the vertical space taken up by these lines. This
allows the tree to be indexed both by line number and by vertical
position, and all access has logarithmic complexity in relation to the
document size.

Because both of these index keys (line number and vertical position)
increase monotonically, a single tree can be indexed by both of them.
This is great, it gives us the height index almost 'for free', with no
additional data structure and only a very small amount of extra logic
(maintaining the heights on updates).

Below is an illustration of what a tree might look like. This is a
document of 50 lines, where the root node contains two children—one is
branching chunk containing a number of leaf chunks, and the other is
itself a leaf chunk. The first leaf has been written out, it contains
seven lines, of which two are folded (taking up no height), and one is
wrapped (taking up more height than a regular, unwrapped line).

```
root (the document) (size: 50, height: 470)
 ├─ chunk1 (size: 35, height: 300)
 │  ├─ leaf1 (size: 7, height: 70)
 │  │  ├─ line1 (height: 10)
 │  │  ├─ line2 (height: 10)
 │  │  ├─ line3 (wrapped, height: 30)
 │  │  ├─ line4 (height: 10)
 │  │  ├─ line5 (folded, height: 0)
 │  │  ├─ line6 (folded, height: 0)
 │  │  └─ line7 (height: 10)
 │  ├─ leaf2 (size: 10, height: 110) 
 │  │  └─ ...
 │  └─ ...
 └─ leaf3 (size: 15, height: 170)
    └─ ...
```

The size of the root node indicates the amount of lines that the
document contains (and its height indicates the height of the whole
document).

If we wanted to find line 12, we'd descend the root node, looking at
its child chunk. The first child has size 35, so that's the one that
contains line 12. Inside of this chunk, the first child is only of
size 7, so we skip that, keeping in mind that we've seen seven lines,
and the offset that remains is 12-7=5. The second chunk has size 10,
which is more than 5, so we look inside that chunk. It is a leaf
chunk, which means that its content is flat, and we can simply grab
the line number five from inside of it.

## Updates

The interface for deleting and inserting line objects in a tree is
defined in terms of ranges of lines, rather than individual lines. To
insert a range of size N at position P, we walk down the tree to find
the leaf that contains position P. We then insert the whole range into
the leaf. If this makes the leaf too big (there's a fixed maximum size
defined for leaves), one or more new leaves will be split off from it,
and inserted into its parent. If this, subsequently, makes the parent
(non-leaf) chunk too big, that one is also split, and so on. If the
root node needs to be split, a new root is created to hold the
resulting chunks.

The beauty of B-trees is that this simple and cheap algorithm
automatically balances the tree—when a branch grows, instead of
growing downwards, its surplus population percolates upwards, towards
the root, and causes the tree to grow from the root when it needs to.
This is a not a perfectly optimal balance, as in some other kinds of
trees, but it is definitely good enough for an editor implementation.

To delete a range of lines, the deletion simply recursively enters the
branches that contains parts of the deleted range, and, in the leaf
chunks, remove the relevant lines (updating size and height in the
process). When a chunk becomes empty, it is simply removed completely,
and when a branch chunk's size drops below a certain threshold, it is
replaced by a flat leaf chunk. Again, this doesn't result in a perfect
balance, but is wonderfully simply. In fact it doesn't even completely
protect against pathological cases—there are editing patterns that can
result in a seriously unbalanced tree. But those, since the
unbalancing happens during deletion, can still only be as deep as the
original tree (created by insertion, which has better balancing
characteristics) was, and thus can't reach dangerous depths.

## Intensive linking

All line objects and tree nodes (except the root) have parent pointers
to the node above them. This allows for very fast height updating—when
a line changes, find the height delta, and simply walk its parent
pointers adding this delta to their height—and finding the line
numbers of a given line object.

Maintaining these links, and breaking them when lines are dropped from
the document, is somewhat awkward, but having such logic in place
turned out to be useful for other purposes as well. It allows
CodeMirror to fire an event when a line is dropped from the document,
gives an easy way to check whether a line is still *live* (it is when
it has a parent pointer), and makes it more immediately obvious when a
data structure is not being maintained consistently (the code will
quickly try to follow a null pointer).
