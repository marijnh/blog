---
layout: post
title: CodeMirror's mode system
tags:
- javascript
- codemirror5
- parsing
- cm-internals
---

A CodeMirror *mode* is a module that helps [CodeMirror][cm], a code
editor, highlight and optionally smart-indent text in a specific
programming language or other kind of structured text format.

[cm]: http://codemirror.net

Code editors take widely different approaches to the way syntax
highlighting styles are defined. An elegantly simple approach is
outlined in Patrick Walton's
[Common JavaScript Syntax Highlighting Specification][common],
basically defining a state machine with regular expressions as its
edges. Unfortunately, this proposal was never widely adopted.
[ACE][ace] uses a similar, though incompatible system. Other, more
heavyweight, and often downright obscure, systems are found in
[Emacs][emacs], [Vim][vim], or [Kate][kate].

[common]: https://github.com/mozilla/skywriter/wiki/Common-JavaScript-Syntax-Highlighting-Specification
[ace]: http://ace.ajax.org
[emacs]: http://www.emacswiki.org/emacs/ModeTutorial
[vim]: http://vimdoc.sourceforge.net/htmldoc/syntax.html#:syn-define
[kate]: http://kate-editor.org/2005/03/24/writing-a-syntax-highlighting-file/

## The interruptable, resumable parser

CodeMirror takes its own unconventional approach to mode definition.
It grew more or less organically out of my fondness for crazy hacks at
the time I was [writing the first version of CodeMirror][odyssey].

[odyssey]: http://codemirror.net/1/story.html

The original approach modeled a mode as a transforming iterator
(iterator in the Python sense)—an iterator that lazily got its input
from another iterator, and outputted some transformed form of this
input. It took the characters in the document as input, and produced a
stream of tokens. Inside this iterator, any amount of state and
complexity could be hidden (the JavaScript mode was, and still is,
almost a full parser).

To avoid having to re-parse the whole document every time a character
was typed, such iterators had to support a *copy* operation, which
basically extracted their state so that they could later be restarted
on a new input iterator.

This was, all in all, a very neat abstraction, and also, from the
outside, easy to work with. Unfortunately such iterators were quite
hard to write, and the [iterator abstraction][iter] that was used,
which relies on exceptions to signal end-of-stream, had quite a high
overhead—especially if you stack it several levels deep.

[iter]: http://bob.ippoli.to/archives/2005/07/06/iteration-in-javascript/

## Take two: first class state

CodeMirror 2 addresses those two problems by separating the state from
the iterator. Instead of, in order to maintain, copy, and restore
state, having to perform weird tricks with closures, a mode author now
simply defines a function that initializes the start-of-document
state, and a function that takes such a state, along with a character
stream, and advances the stream past one token, updating its state if
necessary, and returning the style of that token.

This, while not quite as cute as the 'everything is an iterator'
model, makes it much easier to write modes. Not just for people who
aren't familiar with closures, but also for me. It also makes it much
easier to write performant modes, because the abstractions don't call
for quite as much indirection.

## Example

An example might make this set-up clearer. Here is a very simple mode
that highlights only double-quoted strings (which may span multiple
lines):

```javascript
CodeMirror.defineMode("strings", function() {
  return {
    startState: function() {return {inString: false};},
    token: function(stream, state) {
      // If a string starts here
      if (!state.inString && stream.peek() == '"') {
        stream.next();            // Skip quote
        state.inString = true;    // Update state
      }

      if (state.inString) {
        if (stream.skipTo('"')) { // Quote found on this line
          stream.next();          // Skip quote
          state.inString = false; // Clear flag
        } else {
           stream.skipToEnd();    // Rest of line is string
        }
        return "string";          // Token style
      } else {
        stream.skipTo('"') || stream.skipToEnd();
        return null;              // Unstyled token
      }
    }
  };
});
```

Let's quickly walk through it. `CodeMirror.defineMode` registers a
mode under a given name. It registers a constructor function to allow
configuring the mode when loading it (which this trivial mode doesn't
use).

The mode constructor returns an object containing the functions that
make up this mode. This one defines only `startState` and `token`,
others often define more, for example `indentation` to derive the
correct indentation from a given state.

Our state only holds a single property, `inString`. This is needed
because strings may span multiple lines, and CodeMirror tokens can't,
so when finding a string that continues to the next line we have to
communicate the fact that we're still in a string to the next call to
`token`.

The `token` function first handles the case where we are at the start
of a string (not currently in one, but right before a double quote
character). If so, it consumes the quote and sets the `inString` flag.

Next, if we're in a string, we look for a closing quote on this line.
If one is found, we unset the `inString` flag. Then we return
`"string"` to indicate that the current token is a string.

If we're not in a string, we just skip to either the next double quote
or the end of the line, and return `null`, to mark the token (the text
skipped over) as unstyled.

## State management

To be able to quickly and efficiently re-highlight a piece of text as
it is being edited, CodeMirror stores copies of state objects in its
[representation][rep] of the document. Whenever a line needs to be
rendered, it looks for a state object in the lines before it, going
backwards until it finds one or hits the start of the document (at
which point it can call `startState` to produce a state). If it has to
go too far back (current limit is 100 lines), it will, to save time,
simply take the line (within that limit) with the smallest
indentation, and assign a blank (starting) state to it.

Once it has a state, it runs the tokenizer over the lines that were
skipped, feeding them that state object, which they will update. And
finally, it runs the tokenizer over the line itself, and uses its
output to assign CSS classes to the individual tokens.

[rep]: codemirror-line-tree.html

Apart from the process described above, which is synchronous because
it is needed to render a line (*right now*), there's another,
asynchronous (background) parsing process that ensures the
highlighting stays consistent. For example, a change at the start of a
document could open a comment block or string, which would cause the
whole document to be styled differently.

The background parser uses `setTimeout` along with a check that bails
it out when it has been running for a given number milliseconds, to
act as a kind of background thread. It keeps a 'frontier', a point up
to which it knows the highlighting is consistent, which is adjusted
whenever the document is modified (or a new mode is chosen). As it
runs, parsing lines and assigning them a state, it adjusts this
frontier forwards.

To preserve memory, the background parser doesn't go beyond the end
of the currently visible (scrolled into view) part of the document.
That means that, if you open a huge document and never scroll down, no
state is accumulated for the whole document. It also means that most
background parsing runs are short, since there'll be no more than a
few hundred lines between the part of the document that you're
currently editing and the bottom of the visible view port.

## Power

The string highlighting example above could have been (slightly) more
succinctly written with a regular expression state machine. In fact,
it's would probably be a good thing for CodeMirror to come with a
wrapper that adapts such a state machine to CodeMirror's `token`
function interface. I've been waiting for a [common standard][collab]
for such specifications to emerge, but not much progress seems to be
made there.

[collab]: https://plus.google.com/106343137603240143566/posts/LG2aB5zZ3b8

Still, lots of syntaxes have features that are difficult, painful, or
even impossible to express in regular expressions. Take, for example,
recognizing the difference between regular expressions and division
operators in JavaScript code.

And, even better, when the syntax highlighter is a real program that
runs over the code in a well-defined, complete way, you can do all
kinds of neat clever things with it. For example, the JavaScript mode
recognizes local variables, and colors them differently. The
[auto-completion][auto] demo fetches this information from the mode
state and uses it to complete local variable names. The XML mode will
highlight mismatched tags for you.

[auto]: http://codemirror.net/demo/complete.html

## Modularity

Because modes are simply tokenizers, with a very straightforward
interface, they can be run in different contexts. One example is the
[`runMode`][rm] add-on, which simply runs a tokenizer over a piece of
text and, through a callback, gives you back the tokens.

[rm]: http://codemirror.net/demo/runmode.html

In fact, the syntax highlighting on this blog is powered by CodeMirror
modes, driven by a browserless node.js version of `runMode`.

Another useful consequence of modular modes is that they are easy to
*compose*. For example the [mixed HTML mode][htmlmixed] composes the
JavaScript, CSS, and XML modes (the latter has a configuration option
that makes it handle HTML). Internally, it initializes all three
modes, and when tokenizing, it multiplexes between them—feeding the
current input to the sub-mode that is active, and switching to a
different sub-mode when it encounters something that looks like a
`script` or `style` tag.

[htmlmixed]: http://codemirror.net/mode/htmlmixed/

In fact, there's a utility shim, the [mode multiplexer][multiplex],
that makes it easy to combine modes in such a way, when they are
separated by fixed, context-independent strings.

[multiplex]: http://codemirror.net/doc/manual.html#util_multiplex

Another, similar shim, the [overlay mode][overlay], combines modes in
a different way. It takes a base mode and an overlay mode, and runs
both over the whole document, combining their styling information in
the actual tokens it outputs. This can be used, for example, to
highlight specific characters (say, tabs) in the editor, by overlaying
a mode that simply finds such characters and assigns them a style.
Or you could write a spell-checking overlay, which looks up each word
it finds in a dictionary, and styles the ones it doesn't recognize.

[overlay]: http://codemirror.net/doc/manual.html#util_overlay

## Detailed context information

Defining useful code-editor functionality often requires understanding
the the context at a given position. For example, when matching
brackets, you want to match brackets that fulfill the same role in the
document. A brace in a string or comment should not match a 'real'
brace that actually delimits a block of code.

For that, we simply take the token style of each brace we find as we
are looking for a match, and compare it to the style of the brace we
started from. Sometimes, it is useful to not only look at the token
style, but also the parser state. I mentioned the example of
auto-completing local variables earlier.

One area where this is used pervasively is smart indentation. All
'serious' CodeMirror modes keep context information—such as which
blocks and parentheses are currently open—in their state objects. From
that information, an indentation can easily (and reliably) be derived.
Contrast the the terrifying regular expression hacks that some Emacs
modes use to guess indentation levels—which often still get it wrong.

Another example is that, just last week, I was writing a system that
needed to display a list of arguments below the editor whenever the
user was typing an argument list for a known function. Figuring out
that the cursor is in an argument list, and at which argument it is,
would be a rather complex task, involving knowledge of brackets and
quotes, if I had to do it myself. But I could simply rig the mode,
which was already tracking contexts, to store that information in its
state, and get easy (and fast) access to it whenever the cursor was
placed in a new position.
