---
layout: post
title: Cursor motion & bi-directional text
tags:
- javascript
- codemirror
- unicode
---

*"Unicode is hard"* is a commonplace among developers. And I guess it
is hard. Witness the amount of systems that get things like string en-
and decoding wrong. And that is the easy part—the real fun starts when
you need to actually display those strings.

Fortunately, toolkits and libraries are able to hide the horrors of
combining characters, directionality, and word breaking most of the
time. Today, most software has moved beyond the ASCII-only worldview,
and makes at least an effort to handle these things properly. You
throw strings at it, it displays them correctly for you.

But there are situations where that *doesn't* suffice. [CodeMirror] is
a code editor implemented in JavaScript. It relies on the browser to
display its content, and modern browsers are very good at displaying
text. But it also displays a cursor, and controls its movement. To do
that, it needs to be aware of some non-trivial properties of Unicode
text.

[CodeMirror]: http://codemirror.net

In this article, I'll outline the solutions I came up with. I was able
to find very little useful material on the subject online. It should
be noted that I am in no way an expert in this field, and that I had
to take a number of shortcuts to prevent the size and complexity of my
editor library—which, as a JavaScript program, is downloaded by every
user—within bounds. I am also not an Arabic or Hebrew speaker, and as
such have very little experience with bi-directional editing
interfaces. Remarks and corrections are very welcome.

## The problem

Originally, CodeMirror assumed that each character in a line
represented a glyph, and that these glyphs were shown left-to-right.
This means that when, for example, the right arrow was pressed, the
editor could simply move its cursor position one character towards the
end of the string, and all was well.

But some Semitic scripts, notably Arabic and Hebrew, do not start
writing on the left of the medium, but rather write right-to-left. Now
if we had to deal only with lines that were entirely right-to-left (or
left-to-right), that would be relatively easy—just move the cursor
towards the *start* of the line when the right arrow is pressed, since
a lower index represents a more rightward position in the visual
representation of the line.

Unfortunately, things are not that easy. Firstly, there is nothing
preventing people from mixing right-to-left and left-to-right scripts
in a single line. Secondly, a group of digits ("Arabic numerals"—the
ones we use in the West), when occurring in a piece of Arabic text,
are to be rendered left-to-right, within their right-to-left context.

Let us look at an example. Assume that upper-case characters are
Latin, and lower-case ones Arabic. If a string looks like this
(logical order):

    A B C a b c 1 2 3 d e D E  (logical)

It is rendered like this (visual order):

    A B C e d 1 2 3 c b a D E  (visual)

The Arabic range (`a` to `d`) is flipped, and *within* that, the
number (`123`) is flipped once more.

## Bidi algorithm

Deriving a visual order from a string isn't magic—there's a
[well-formalized algorithm][bidi] for this published by the Unicode
Consortium. It, in brief, proceeds by categorizing the characters in
the string into categories like "Left-to-Right", "Right-to-Left
Arabic", "Whitespace", and a number of other ones. It then performs a
bunch of operations that reduce one category to another based on its
context, for example reducing the category of "Non-spacing marks" to
that of the character before it. Finally, when only a few categories
remain, it builds up a visual order by 'flipping' sequences of
characters with a right-to-left category, and within those, flipping
sequences of digits back again.

[bidi]: http://www.unicode.org/reports/tr9/

I won't go any deeper into this algorithm. It is well
[documented][bidi]. It in fact also declares a mechanism for inserting
RTL and LTR marks, which explicitly control the direction of the text.
CodeMirror's [implementation][cmbidi] does not currently implement
this part of the algorithm.

[cmbidi]: https://github.com/marijnh/CodeMirror/blob/54c8517baf789793c64ea4306168f92cf3e6cb70/lib/codemirror.js#L3498

## Quantum cursors

The fact that bi-directional text has 'jumps' in it—positions where
visually adjacent characters are not actually adjacent in the logical
representation—has some interesting ramifications for editable text.

(Note that, though I am going to describe a behavior as if it were
normative, this is just what most non-Windows software seems to be
doing, and in fact there are other ways to handle bi-directional
editing.)

When the cursor is at such a jump, for example at position 3 in the
example string, as illustrated below, it defies some of the
assumptions that underlie classical, single-direction cursor
interfaces.

     A B C a b c D E  (logical)
    0 1 2 3 4 5 6 7 8

(The numbers are the indices into the string that are used to
represent cursor positions.)

When you type a `D` (Latin letter) at position 3, all is well—a letter
is inserted to the left of the cursor, and the cursor moves to the
right to end up after the new letter. Same if you press backspace
there—the `C` is simply deleted and the cursor ends up after the `B`.

*But*, if you insert a character from a right-to-left script, say an
`x` (which you should read as being an Arabic, right-to-left
character), you end up with the string `ABCxabcDE`, and the `x` will
appear, in the visual order `ABCcbaxDE`, quite some distance from the
cursor. Similarly, when you press delete, you'll delete the `a` rather
than the `c` which is visually to the right of the cursor.

What Chrome does in such a situation, and what I've followed in
CodeMirror, is to show a secondary cursor at the other end of the
jump. So, visually, you'd see this, with the asterisks indicating the
primary cursor and the plus sign the secondary one.

    A B C c b a D E  (visual)
         *     +

Now, at least you'll get a visual hint that something is not normal,
and have a quick way to see where *else* your editing actions might
take effect.

## Cursor motion

We will assume what we want the arrows on the cursor motion keys to
match the direction that the cursor actually moves when you press them
(this is not standard on Windows, where many programs move the cursor
'logically' when you press arrow-left and arrow-right, causing it to
move in the opposite direction from the arrow when in right-to-left
text).

To do this consistently, we define an ordering of (primary) cursor
positions. This ordering must have two properties: it must correspond
to the visual order of the line—i.e. a position more to the right in
this order is more to the right on the screen, and it must include
every possible cursor position in the string—it would be bad if there
were positions that you can't reach with the cursor keys. In regular
left-to-right text, this ordering is trivial. In a three-character
string, it would be `0123` (where `0` is before the first character,
and `3` is after the last). In a fully right-to-left string, it is
simply the inverse of that, `3210`. The fun starts with bi-directional
strings.

The cursor-position-order does not follow trivially from the character
display order, because it talks about positions *between* characters.
This includes assigning an ordering to jump positions. More
concretely, here's an example. First, it shows the logical string,
with its possible cursor positions labelled, and then below it, it
shows the corresponding visual order and a possible ordering of
character positions (the numbers refer to string offsets, their
position reflects their ordering):

     A B C a b c D E  (logical)
    0 1 2 3 4 5 6 7 8
     A B C c b a D E  (visual)
    0 1 2 3 5 4 6 7 8

This'd mean that when you are at position `3`, pressing the right
arrow takes you to position `5`, and pressing it again takes you to
`4`.

This ordering is mostly uncontroversial, except for the positions of
`3` and `6`—we could also have flipped them, so that the user would
already be taken to position `6` (the leftmost end of the
right-to-left section) after pressing right from position `2`.

Whether either of these orders satisfies the 'corresponds to the
visual order' restriction depends on how we draw the primary cursor.
At position `6`, we could emphasize that it sits at the rightmost end
of the `abc` right-to-left section, and draw it to the left to the `c`,
or we could emphasize that it sits right before the `DE` left-to-right
section, and draw it to the left of the `D`.

Both work, but I've found that the least confusing behavior occurs
when biasing cursor positions towards the *dominant* direction of the
line (which CodeMirror defines to be the direction of the start of the
line, but you could also base it on the percentage of characters that
is right-to-left). So that means that in a line that starts with
left-to-right text, when the cursor is on a jump point, the primary
cursor is drawn relative to the character at the left-to-right side of
the jump, and the secondary one relative to the right-to-left side.

Thus, in this schema, we'd reflect this bias by using the order shown
above, rather than the one where `3` and `6` are swapped (which would
amount to biasing towards the right-to-left text, which is not the
dominant direction of this line).

## Data structure and algorithms

Depending on what you are doing, a display order can be represented in
various ways. For cursor placement, drawing of the selection, and
cursor motion, I found it most practical to use a format that lists
the individual single-direction sections of text, from left to right
in display order, and for each section tells me its direction, its
start point, and its end point (in logical order offsets).

For cursor drawing, this allows us to find the section that the cursor
is inside of, in which case it is simply drawn between the characters
that are adjacent to it, or the two sections that it sits between. In
that second case, we place the primary cursor relative the section
whose direction corresponds to our dominant direction, and the
secondary cursor relative to the other.

Selection drawing has to handle selections that look visually
discontinuous because of jumps. For example if, in the example string
that mixes numbers and right-to-left text, you select from position
`1` (between `A` and `B`) to position `8` (between `2` and `3`), the
selection marker should cover the part shown by asterisks:

    A B C a b c 1 2 3 d e D E  (logical)
      *************
    A B C e d 1 2 3 c b a D E  (visual)
      ***     ***   *****

Drawing this is easily done by iterating over the sections that make
up the line, and checking for each whether it overlaps the selection.
If so, draw the part of the selection that falls inside the section by
using coordinates relative to the section.

Finally, cursor movement, done in steps of one, starts by, just like
cursor drawing, finding the section that the start position sits in or
between. If it sits between sections, the section with the dominant
direction is chosen as current section.

We then move one character in the intended direction. If we are in a
right-to-left section, this is the inverse of the specified direction
(i.e. left, which is normally `-1`, towards zero, becomes `1`, towards
the end of the string).

If this motion takes us *out of* our current section, where 'out of'
is defined as beyond the section's edge for sections of the dominant
direction, and onto the section's edge for non-dominant sections, we
need to skip to the next section (in the visual order), entering that
one on the correct side (i.e. the visual right side when moving left,
left side when moving right, where the offset corresponding to that
side depends on the section's own direction). If the new section is
non-dominant, we skip its edge, since that offset belonged to the
origin section.

The above step may have to be performed multiple times, to allow
moving through single-character non-dominant sections. It stops when
we find a position that is actually inside the section that we are
currently looking at.

## The bad apple

So far, that's all more or less coherent. Unfortunately, there's a
problem. Let us try to assign an ordering to a string that starts
left-to-right and ends right-to-left:

     A B C x y z  (logical)
    0 1 2 3 4 5 6
     A B C z y x  (visual)
    0 1 2 3 5 4 ?

Because the second (`zyx`) section isn't dominant, the positions on
its boundaries aren't biased towards it. Thus, cursor position `3`
should obviously be placed after `C` in the visual order. That leaves
only `6`, the one offset not assigned to any other position, for the
position at the end, marked with a question mark. But there is very
little sense in placing it there—at least, the algorithms described
above don't automatically do it.

As a kludge, I made the algorithm that produces the sections, whenever
the last section's direction doesn't agree with the first section,
insert an empty, zero-length section with the dominant direction at
the end. This, being dominant, will, be associated with the position
at the end of the string, and cause the ordering and cursor drawing to
work out as hoped.

## Combining characters

Another feature that was needed to make working with Hebrew text
bearable is recognizing of combining characters.

If I write 'é', your browser will probably display that as an E with
an acute (forward) accent, even though the source for this page
actually contains two characters, first an 'e' and then Unicode point
769 (COMBINING\_ACUTE\_ACCENT). Such characters are rarely used in
Latin languages, because Unicode point 233
(LATIN\_SMALL\_LETTER\_E\_WITH\_ACUTE) fills the same role just fine
in a single character. But in Hebrew (as well as several other
languages), the combinations are so numerous that assigning a code
point to every one isn't practical, and thus people actually *use*
such combining characters.

When editing text with such combining characters, since only a single
glyph is displayed for a series of one non-combining and N combining
characters, the cursor will appear to stay in the same place when
inside this series. This is very annoying, and it seems preferable to
simply skip over the whole section in a single jump.

In Unicode terminology, the code points that are combining/continuing
characters are recognized by the `Grapheme_Extend` derived core
property, as listed in [this file][dcp]. The amount of ranges listed
there is huge, so, as a crummy trade-of between correctness and code
size, I only took the ranges of a number of scripts (Latin, Hebrew,
Arabic) and made those into a big regular expression that the editor
can use to recognize continuing characters, leaving out a whole range
of other languages.

[dcp]: http://www.unicode.org/Public/UNIDATA/DerivedCoreProperties.txt

(Of course, The Right Thing would have been for browsers to expose a
JavaScript API for getting Unicode character properties, since they
internally have this information anyway—they need it to properly
display text. I expect it'll probably be another five to ten years
before such an API is considered important enough to standardize.
Unicode adoption is a slow process.)

Having this regular expression, I simply make sure that cursor
movement by keyboard or mouse always puts the cursor on the boundary
of a visual glyph, never before a combining character.

## Cursor motion versus deletion

While the arrow keys have a visual arrow on them suggesting a certain
direction, backspace and delete imply the deleting of characters
respectively before and after the cursor, where before and after are
interpreted relative to the direction of the text. So in
right-left-text, backspace will delete the character to the *right* of
the cursor.

This means that determining the range to delete in response to these
characters is done by looking at *logical* rather than *visual*
positions. I also chose not to take combining characters into account
when handling these, so that pressing backspace after 'é' (E +
combining accent) will leave you with just 'e'—i.e. you delete
characters, not glyphs.

## Closing

As mentioned, being only a simple Dutch speaker exposed mostly to
Western languages, I expect to be missing half of the subtleties of
bi-directional editing. I will update this post with correction as
they come in.

Regardless of that, I hope this write-up turns out to be useful to
somebody. Figuring all this out without much guidance was a major time
sink. I'd be glad to save someone else the bother.
