---
layout: post
title: Addressing Editor Content
tags:
- codemirror
- data structures
---

Every text editor system, whether it works with plain or rich text,
needs some way to refer to specific positions in the document. The
very first reason one runs into this, when implementing such a system,
is for representing the cursor and selection. But in a mature editor,
you'll be doing a lot more things that refer to document
positions—representing changes, displaying user interface elements in
the text, or tracking metadata about a piece of content.

## Offset Positions

An obvious way to address such positions, especially in plain text, is
just by string offset. For rich text documents it also tends to be
quite straightforward to define a scheme that gives every document
position its own offset. Such offset increase monotonically, so even
in data structures that aren't flat arrays, it is not hard to
efficiently look them up.

Because text editors often store their content split by line in some
bigger data structure, it is tempting to use `{line, character}` pairs
for your positions. Though this is often a useful thing to present to
a user, as an addressing system is is really quite awful. Manipulating
such positions tends to get convoluted and awkward. Whereas finding
nearby positions in a flat system is just a matter of addition and
subtraction, with line-based addresses you have to always special-case
line boundaries, and know the length of lines to even know where those
boundaries are. This can be made to work, since several editors,
including old versions of CodeMirror, do it, but moving to flat system
in CodeMirror 6 was a huge relief.

In many cases, just having a position isn't enough. A cursor at a line
wrapping point or a jump between right-to-left and left-to-right text,
for example, may correspond to multiple different positions on the
screen. At least for cursors, you need both a position and a
direction—which disambiguate whether the position is attached to the
element before or after the position.

But other than that, offset positions work well. They just have one
big drawback: when the document changes, they need to change with it.
So any data that refers to a document position needs to be updated
along with the document every time that document is modified. This
requires quite a lot of discipline to get right, and can get expensive
when you're tracking a lot of positions.

## Unique IDs

So, though both of my editor projects use offset positions, I keep
asking myself whether there is a way around the need to *map* those
positions on every change. If we could have some way to represent
document position in a ‘stable’ way, where you can still use them when
you come back to a document, even if that document has changed in a
bunch of ways since you generated it, that would be so convenient.

To be able to do such a thing, you'd need to assign a stable ID to
every single element in the document. There are ways to make this less
nauseatingly expensive than it initially sounds. Stretches of text that
are loaded or inserted together can be assigned a contiguous region of
IDs, allowing the data structure, in many circumstance, to not store
every single ID separately, but instead just assign a range to a
stretch of text. If you have that, you can now describe the position
before element X or after element Y in a stable way. To find it, you
just need to look up the element.

Except, of course, if that element has been deleted. When your ID no
longer exists in the document, your position has lost its meaning.

One way to handle that is to keep ‘tombstones’ for deleted elements,
either directly in your document data structure, or in a separate data
structure that maps the IDs of deleted elements to IDs of adjacent
elements that are still in the document. This does have the downside
that, for some types of editing patterns, your tombstone data can
become bigger than your actual document data. It is possible to define
schemes where you periodically garbage collect these, but then you
reintroduce the issue that you can be invalidating position pointers
that may still exist in some other data structure, and you are back to
needing to carefully update such pointers.

Another issue of such IDs is that going from an ID to an actual
position in the document generally needs to be fast. This is not
something you get for free. Doing a full document scan every time you
need to find a position tends to be too slow.

There are some tricks that you can do with mutable doubly-linked trees
or lists, where you keep a map from IDs to objects in those data
structures, and then traverse from that object via parent or sibling
pointers to figure out where it is. But I am very partial to
persistent data structures, where such tricks don't work.

It's probably possible to do something with bloom filters in a tree
structure or similar, rather heavyweight tricks. But in the end, if
you're just moving the work that an offset system would do when
mapping positions over changes to lookup time, that may not be much of
an improvement.

## Ordered IDs

One way to avoid the tombstone and lookup issues with regular IDs is
to define your ID assignment scheme in such a way that there is an
ordering of the IDs that corresponds to their order in the document.
If deleted IDs can still be compared to IDs still in the document,
that gives you a way to locate their position even though they aren't
there anymore. Similarly, if you can compare IDs you can run a binary
or tree search through your document to quickly locate a position.

The obvious downside of this approach is that it is tricky to define
your IDs in such a way that you can keep making up new IDs that ‘fit’
between any two existing IDs, and this forces you to use a schema
where IDs can grow in size when there's no room left in the sequence
space on their current level.

It also, and this may be a worse issue, makes the position of deleted
IDs weirdly dependent on what is inserted in their old place after the
deletion. Unless some kind of tombstone data is kept, changes will
happily fill in the ID space left empty by a deletion with elements
that, more or less randomly, may be above or below (or even equal to)
an old but still referenced ID, making its position point at a
meaningless position within those inserted elements.

(Readers familiar with sequence
[CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
may notice a lot of similarity between what I'm describing and how
such systems work. That's because I stole a lot of these ideas from
CRDT literature.)

## Addendum: Transaction Log

Another approach, suggested to me by [Jamie
Brandon](https://www.scattered-thoughts.net/) after I published this,
would be to keep a record of updates with your document, containing
enough information to map a position forward if you know the document
version it refers to. Positions would then be `{version, offset}`
pairs, and you could interpret positions in old versions by running
through the changes that were made since that version.

In its straightforward form, this would make use of old positions
increasingly expensive, as they have to be mapped forward ever
further. But I guess you could get around that by keeping a cache with
every position.

In any case, this is a neat reframing of the problem. It still
requires a data structure that grows proportional to editing history
size, rather than document size, but seems less convoluted than
ID-based approaches.

## Conclusion

This problem space appears to be a tricky one where every solution has
significant drawbacks. I'm going to keep muddling along with offset
positions in my own systems. Though mapping all your document
positions is a chore, this approach is relatively easy to understand
and reason about, and doesn't require a lot of complicated data
structures to maintain and use.
