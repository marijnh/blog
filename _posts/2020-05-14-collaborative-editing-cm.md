---
layout: post
title: Collaborative Editing in CodeMirror
tags:
- javascript
- codemirror
- concurrency
- architecture
---

This post describes the considerations considered in designing the
document-change data structure and built-in collaborative editing
feature in the [upcoming version](https://codemirror.net/6/) of
CodeMirror (a code editor system). It is something of a followup to
the [Collaborative Editing in
ProseMirror](./collaborative-editing.html) post.

I won't introduce anything new or exciting here—the design I ended up
with is a very boring non-distributed [operational
transformation](https://en.wikipedia.org/wiki/Operational_transformation).
In a way, this post is publishing a negative result: I looked into a
bunch of interesting alternative approaches, but found they didn't
meet the requirements for this system.

Since collaborative editing is a tricky field with a lot of different
solutions, all of which have their awkward trade-offs, I think the
path towards this boring end result might still provide a useful
resource for people working on similar systems.

## Distributed versus coordinated collaborative editing

There's quite a disconnect between the scientific literature on
collaborative editing and what most collaborative editors are doing.
The literature is largely concerned with truly distributed
collaboration, where a number of peers, taking equivalent roles,
directly exchange updates among themselves and still somehow converge
on the same document. A typical web system, on the other hand, has
clients talking to a server, which orchestrates the exchange of
updates.

These problems are very different, and if you're aiming to implement
the latter, about 95% of collaborative editing literature is
discussing a problem you do not have. Working in a truly distributed
fashion _is_ very attractive in principle, of course. It is strictly
more general, and has connotations of escaping the over-centralized
modern web. But it does drag in a lot of problems, even outside of the
document convergence—peers have to store the document along with,
depending on the technique used, its entire history. They have to
somehow discover each other, maintain connections, and so on.

So for the core of a JavaScript-based library, I decided that support
for a distributed model wasn't important enough to justify the
additional complexity. I'll get back to what that complexity looks
like later.

## Operational Transformation

(I'm sorry, I'm going to explain operational transformation again,
just like a hundred other blog posts. Hang tight.)

[Operational
transformation](https://en.wikipedia.org/wiki/Operational_transformation)
involves, in its simplest form, a _transformation function_ that takes
two changes A and B, which both apply to the same document, and
produces a new pair Aᴮ (a version of A that applies to the document
produced by B) and Bᴬ (B but applies to the document created by A),
such that A + Bᴬ and B + Aᴮ (where + indicates change composition)
produce the same document.

This can be visualized as a diagram like this:

        Docˢ
     A ↙   ↘ B
    Docᴬ    Docᴮ
    Bᴬ ↘   ↙ Aᴮ
        Docᴬᴮ

You can roughly think of the transformation as _moving_ a change
through another change. Sometimes this just involves adjusting the
positions it refers to (moving “insert _A_ at 5” through “delete 0-1”
yields “insert _A_ at 4”), sometimes it it is more involved (two
changes can't delete the same content, so in that case some of the
deletions have to be dropped in the transformed change).

For a plain-text document model, such a transformation function is not
very hard to define.

The other part of an operational transformation system is its
_control_ part, which determines how changes are shared and when they
are transformed. A simple centralized setup can do something like
this:

 - Keep a list of unsent local changes.

 - Periodically try to send those to the server, which will either
   accept them or, if another client sent a change first, reject them
   because your changes start in a base document that doesn't match
   the current central document.

 - When the server sends you changes, transform your unsent changes
   and the remote change over each other. Apply the transformed remote
   change locally, and replace your stored local changes with the
   transformed version, so that the next time you try to send changes
   you send those.

Because this makes everything proceed in lockstep, it is easy to see
that this converges—the only difference in order in the way clients
apply changes is when remote changes come while there are local
changes pending. This is exactly the scenario that the transform
function's convergence handles.

When there is more than one remote or local change involved, the
situation is slightly more tricky. If the change representation that
your transform function operates on allows series of changes to be
composed into a single change, you can first do that and then perform
a single transform.

If not, you basically need to build up a bigger rectangle. If A and B
are remote changes, and X and Y local changes, you can do something
like this:

             Docˢ
          A↙     ↘X
        Docᴬ      Docˣ
      B↙  ↘Xᴬ  Aˣ↙  ↘Y
    Docᴬᴮ   Docᴬˣ    Docˣʸ
    Xᴬᴮ↘  ↙Bˣ  Yᴬ↘  ↙Aˣʸ
       Docᴬᴮˣ     Docᴬˣʸ
        Yᴬᴮ↘     ↙Bˣʸ
             Docᴬᴮˣʸ

In each individual diamond in this monstrosity, the lower arrows are
made up by transforming the upper arrows against each other. So the
whole thing can be built up with O(N×M) transformations, where N and M
are the number of changes on both sides. The guarantee that a single
set of changes can be transformed over each other and still converge
can thus be used to compute transformed versions of bigger groups of
changes—the bottom sides of the big diamond provide the final
transformed versions of the change sets.

### Then why is OT considered hard?

So that's pretty easy. Still, the general consensus seems to be that
OT is hard. There's an amusingly long list of papers in this space
that have later been proven to be incorrect.

If you've been programming for a while you've probably run into this
kind of thing before: there's a hack that works simply and
efficiently, but completely falls apart when you add more
requirements. OT is such a hack.

When the document structure is more complicated than plain text, and
change structure is more complicated than just insertions and deletes,
it becomes very hard to define a converging transformation function.
And when you don't have a centralized party to determine the order in
which changes get applied, you need, as far as I understand [the
literature](http://pagesperso.lina.univ-nantes.fr/~molli-p/pmwiki/uploads/Main/oster06collcom.pdf),
to keep data beyond the current document (“tombstones” that describe
where deletions happened), to guarantee convergence.

The main problem is that this technique is hard to reason about. It
has many practical advantages but, being a hack, doesn't provide the
kind of mental framework that would allow you to confidently apply it
in different situations.

## Conflict-free Replicated Data Types

That is where
[CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
come in. They are another approach to convergence that, contrary to
operational transformation, does provide a way for us mortals to
reason about convergence.

Basically, CRDTs complicate the way they represent data and changes to
the point where you can apply changes in any order, and as long as you
applied the same changes, you get the same result.

For text-style data, CRDT approaches roughly work by assigning every
character a unique ID. There's two general approaches to representing
changes.

The first keeps deleted characters in the document forever, just
marking them as deleted. Character insertions provide reference IDs
for the character before and/or after them, and those references,
along with data (often a [logical
clock](https://en.wikipedia.org/wiki/Logical_clock)) embedded in the
IDs allow each client to compute the same ordering for the
characters.

The second approach generates IDs in such a way that they are already
ordered. When inserting something at a given position, you generate a
new ID that sits between the existing IDs around that position. This
means character IDs must be able to grow in size, so that you can
always create a new ID between any given pair. You'll also need to
include some client-specific data to make sure IDs are unique. But on
the bright side, this approach doesn't require you to keep deleted
content around.

Given such a data type, collaborative editing becomes a matter of
making sure everybody ends up receiving everybody else's changes,
eventually.

But I guess you can see why this isn't a no-brainer either. Compared
to OT, where your document representation can just be a minimal
representation of the text inside it, these techniques requires an
extra data structure to be stored _for every character in the
document_. And with some of them, you don't get to delete those
characters either.

There are approaches that exploit the way text is often inserted in a
linear way (or loaded in bulk at the start of the editing session) to
compress this data somewhat by generating sequential IDs for such
spans of text, and storing them as a single element. But these
introduce further complexity and don't really help provide an upper
bound on the data needed—in a heavily edited document the
representation may well degenerate to something close to the
ID-per-character structure.

For CodeMirror's core, data structures and complications like this
conflict with the goal of supporting huge documents and having a
pleasant programming interface. So I've decided not to introduce a
CRDT in its internal data structures.

It may be entirely reasonable to wire an instance of the library up to
an external CRDT implementation, though, as has been done for
ProseMirror with
[Yjs](https://discuss.prosemirror.net/t/offline-peer-to-peer-collaborative-editing-using-yjs/2488).

In general, I agree with [this
article](https://medium.com/@raphlinus/towards-a-unified-theory-of-operational-transformation-and-crdt-70485876f72f)
that the strict separation between OT and CRDT is not really
justified. OT algorithms that support decentralized editing rather
resemble CRDT algorithms. But the distinction between dumb-as-rocks
classical OT and decentralization-capable approaches _is_ useful.

## CodeMirror's approach

So the plan is to support centralized collaborative editing out of the
box, and punt on the complexities of decentralized collaboration.

I started the project with the idea that I'd just do [what ProseMirror
does](./collaborative-editing.html), since that worked well before.

To recap, ProseMirror uses something similar to OT, but without a
converging transformation function. It _can_ transform changes
relative to each other, but not in a way that guarantees convergence.
ProseMirror's document structure is a tree, and it supports various
types of changes, including user-defined changes, that manipulate this
tree. I didn't have the courage to try and define a converging
transformation function there. When a client receives conflicting
remote changes, it first undoes all its local pending changes, applies
the remote changes, and then the transformed form of its local
changes. This means that everybody ends up applying the changes in the
same order, so convergence is trivial.

In CodeMirror, the document model is a lot simpler, so though I got
pretty far with the ProseMirror approach, it seemed needlessly
awkward. A sequence of individual changes, each of which applies to
the document created by the previous one, isn't really how the user
thinks about updating the document.

If you, for example, want to surround a the range from position 10 to
20 with parentheses, you'd have to create a change “insert `(` at 10”,
and then, because the first change inserted a new character, the
second change would be “insert `)` at 21”. You could sometimes get
around this by creating the changes in inverse order, but that doesn't
always work either.

Also, when doing things like updating updating the document data
structure, its representation on the screen, or some auxiliary data
structure that tracks the document, you need the precise extent of a
set of changes. This can be _derived_ from a sequence of individual
changes, but it seems like it'd be more pleasant if changes were
directly kept in that shape.

So I moved to a system where you don't deal with individual changes,
but rather with change _sets_, which represent any number of changes
in a flat format, as a sequence of untouched and replaced spans. The
parentheses example above would be represented as “keep 10, insert
`(`, keep 10, insert `)`”.

(In fact, it'd get another kept span at the end covering the rest of
the document. This representation knows the length of the document it
applies to, and will refuse to perform operations where these lengths
do not match. This dynamically catches a whole class of programmer
errors that would be silently ignored before.)

To create a change, you specify your changes with offsets into the
current document, and the library will sort and combine them into a
single change set.

Given this representation, it seemed an obvious optimization to use
real OT, rather than ProseMirror's faux OT, since for this domain it's
not hard to define.

### Undo history

Transforming does not just come up with collaborative editing. If you
want an undo history that can undo some changes but not others (which
is useful for collaborative editing, where you don't want to undo
other people's changes, but also comes up in other scenarios), you'll
need something similar.

In the simple case, the undo history stores the inverse of the changes
you made, and when you undo, it applies those inverted changes. But if
you have, say, change A stored in the history, and make a change B,
which should not be undoable, you can't just do nothing. Change A
applies to the current document, not the document created by B.

So you must create transformed versions of the changes again. The
transformed change Aᴮ gets stored in the history instead of A, and, if
there are more levels of history below that, the next level must be
transformed with Bᴬ, and so on.

## Position mapping

Something that comes up quite a lot in an editor is the need to
transform a document position in an original document into a
corresponding position in the changed document. If text is inserted
somewhere before the selection, the selection should move forward with
the surrounding text. Some OT systems call this “cursor
transformation”, but it also applies to things like ranges of
collapsed code, lint warnings, breakpoint markers, and so on.

It's not hard to write a function that takes a position and a change
and returns a reasonable new position in the new document. But there
are a few complications.

Firstly, when an insertion happens directly at your position, it is
ambiguous which side the mapped position should be on. So you'll
probably want to have two forms of position mapping—one that stays
before insertions, and one that stays after them.

Secondly, though most OT systems just represent changes as a series of
insertions and deletions, mapping seems to require us to distinguish
_replacements_ from the corresponding delete/insert pair. When a
replacement happens next to a given position, the position should
never move across the replacement, regardless of whether you're
mapping forward or backward. In order to be able to support this,
CodeMirror's change representation is encoded as a series of
replacements. (Insertions become replacements that don't delete
anything, and deletions replacements that don't insert anything.)

And thirdly, worst of all, though it wasn't that hard to use OT to
make _documents_ converge, it does not seem to be possible, in an
OT-style system, to make mapped _positions_ converge. This is usually
not much of a problem, since most of the things that need to be mapped
are local to a single client, but there are situations, like
collaboratively editing annotations that refer to a given range in the
document, where it would be extremely useful to know that everyone's
representation of these ranges will stay the same as the document
changes.

Let's look at an example. Two users make concurrent edits—A deletes
characters 2 to 4, and B inserts an _X_ at position 4. After the
clients have synced up, they've made these changes:

    A: delete 2 to 4, insert X at 2
    B: insert X at 4, delete 2 to 4

If we are mapping position 2, with a forward bias, user A will, for
the first change, leave the position at 2, and then, because of the
forward bias, map it to the end of the insertion made by the second
change, ending with position 3.

User B, on the other hand, finds that the initial insertion didn't
affect position 2 at all, since it's two positions ahead of it. The
deletion also doesn't affect it, so they end with position 2.

This doesn't seem to be an incident of my implementation or anything
like that. Mapping through deletions loses information (in this case,
the fact that our original position isn't adjacent to the insertion),
and thus I'm confident that, in an OT-style system that doesn't track
tombstones for deletions, or _any_ system that defines this kind of
mapping in terms of plain document offsets, doing this in a converging
way is impossible.

This is kind of weird. It took me a while to accept that we can make
_documents_ converge, but not _positions_, which are so much simpler.
The explanation for that is, I guess, that for document maintenance,
what is inside deleted ranges becomes irrelevant as soon as those
ranges are deleted, whereas position mapping, to be robust, would
still need to be able to compare positions inside such ranges.

(Depressingly enough, a similar problem exists when we are just
composing changes—mapping through changes X and Y separately may
produce a different result from mapping through X+Y composed into a
single change.)

---

This is a large part of the reason why I spent weeks researching CRDTs
even though my document convergence needs are well covered by OT. If
you have a more fine-grained way to address positions (specifically,
one that can refer to deleted positions), and you define position
mapping in terms of that, you do not have this problem.

Since CRDTs tend to assign unique IDs to every character, and some
techniques keep those around even when deleting the character, you
could use such IDs instead of document offsets to track positions.
They never change, so you wouldn't even need to _do_ anything to map
positions across changes.

(Though, since all CRDT approaches seem to separate insertions from
deletions, this would degrade mapping around replacements again.)

Still, that did sound promising. But, again, the cost of such a
representation is significant, and in the end, I judged the
requirement for converging positions to be too obscure to justify that
level of extra complexity and memory use.
