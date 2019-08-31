---
layout: post
title: CodeMirror 6 Status Update
tags:
- javascript
- codemirror
---

It has been almost a year since we officially announced the CodeMirror
6 project, which aims to rewrite [CodeMirror](https://codemirror.net)
(a code editor for in the browser) to align its design with the
technological realities and fashions of the late 2010s.

This post is for you if, in the course of that year, you've
occasionally wondered what the hell Marijn is doing and if he's
getting anywhere at all. I have been absolutely terrible about
communicating progress, and even monitoring the
[repository](https://github.com/codemirror/codemirror.next) would
often leave you in the dark, as I was working on local branches or
entirely different repositories. In any case, the code that's in there
is almost entirely undocumented.

## Where We Are

Last week, I landed a major set of changes, which had been in the
works for about four months. They integrate a new approach to code
parsing. This was the last piece of the system that was completely in
flux, where I didn't want to nail down anything related to it yet
because I wasn't sure how it would end up working.

Now I am sure, which means that the vision for the system as a whole
just became a lot more clear.

Apart from the parser work, a lot of design and cleanup has happened
in the past year. I'll go over the major elements at the end of this
post.

For observers, the more interesting thing is that we finished a [doc
comment extractor](https://github.com/adrianheine/gettypes/) for
TypeScript, and are starting to work on adding enough comments to
generating a passable reference manual for the new system. Hopefully,
that will finally allow outsiders to get a clear view of what we're
building.

I intend to start releasing npm packages around that time. They won't
be stable or feature-complete. They won't even reflect the package
organization of the final system. But they should provide an easy way
to start playing with the system.

## Where We Are Not

I'm a bit behind where I had hoped I would be at this point. This has
three reasons:

 - My other projects and customers kept demanding attention. How rude.
   Fortunately, this means that the CodeMirror 6 budget will stretch
   longer, since the time spent on other things generated its own
   income.

 - The parser system turned out to be Really Hard, and took a bit
   longer than hoped.

 - I'm definitely suffering from [second system
   syndrome](http://wiki.c2.com/?SecondSystemEffect), where after
   eight years with the old system, I am acutely aware of its
   limitations and want to fix them all this time around. That
   sometimes leads me into overly-ambitious design rabbit holes, and
   then it takes me a week or two to dig myself out again.

So the bad news is that a stable release is still quite a ways off
(not going to make any more specific predictions at this point). Some
parts of the system are at a point where they may roughly stay the way
they are, but other significant parts haven't even been written yet.

## What We Did

These are the major pieces of work that have happened since the
project was announced...

### Composition Support

Handling composition/IME (input method editor, as used by people whose
script has too many characters to fit on a keyboard, but also pretty
much all Android virtual keyboard input) in the browser is its own
special kind of hell.

During composition, the user interface is in a special mode where a
piece of the editable text is being _composed_. What exactly that
means differs per input method, but it usually involves step-by-step
updates through pressing additional keys and/or interacting with menus
to reach the intended input string.

In normal operation, CodeMirror will constantly sync the content in
the DOM with its model of that content—applying highlighting and
normalizing DOM elements that don't have the expected shape. However,
during composition, if you mess with the DOM around the composition,
or with the selection, you will _abort_ the composition, making your
editor pretty much unusable to IME users and, on some browsers,
causing bizarre side effects such as their composed text being
duplicated again and again on every keystroke.

Our old approach was to freeze interface updates during composition,
stepping well back and letting the user do their thing until the
composition ended, at which point the editor sprang to life again.
That led to a number of responsiveness issues, where editor plugins,
such as autocomplete, wouldn't be kept up to date on what is
happening, causing the interface to appear frozen or outdated.

In CodeMirror 6, I implemented a subtle middle road where the part of
the document that is being composed is left alone as long as its
content isn't changed by outside code, but the editor's update cycle
proceeds as normal, and the part of the document outside of the
composition can be changed (say, by collaborative editing, or by the
autocompletion plugin updating its list of completions) as normal.

### Behaviors as Extension Primitive

A design where a generic core provides a platform for all kinds of
features to be implemented in plugins has to, in a way, provide an
extendable extension mechanism, where extensions can define new ways
in which other extensions can add or configure behavior. For example,
an autocompletion plugin must be able to provide a way for other
plugins to register completion sources.

Designing this is tricky, but I think we landed on a nice
architecture. I've written [another blog
post](http://marijnhaverbeke.nl/blog/extensibility.html) outlining our
design. This is working well so far, and has allowed us to create all
kinds of features (from the undo history to syntax highlighting to
line number gutters) outside of the core library.

### CSS Modules

Since the browser platform's CSS support is still more or less
completely unhelpful when it comes to modularized system, we've
decided to use a CSS-in-JS approach where extensions can define their
own styles from within JavaScript code and make sure they are included
in the document or shadow DOM where the editor is placed.

### View Fields and Updates

The place where pure code (around the immutable editor state
abstraction) stopped and imperative code (around the DOM and the
editor view) started hadn't really been properly defined in the first
iteration.

A pain point was viewport state—information about which part of the
document is currently visible. This isn't part of the core editor
state, but many UI extensions need to access it in order to operate,
usually because, as an optimization, they only act on the visible
code.

I've added a new abstraction, view fields, for pieces of state that
live in the view and affect things like decorations (styling and
widgets in the content) and the attributes of the editor's wrapper DOM
nodes.

These can be written in bog-standard imperative style, if you want,
but still make it easy to handle editor state changes in a disciplined
way—they are notified each time something changes, and provided with a
full description of the update, including the viewport information and
the transactions that were applied.

### Block Widgets

Block widgets are a way to insert a block element into the document,
either on a line boundary, in the middle of a line, or covering some
content.

These existed before but I completely reimplemented them (and the rest
of the decoration system) at the start of the year to fix some corner
case issues in the old implementation, cleaning up a number of issues
and limitations in the display code.

Interestingly, allowing block widgets in the middle of lines, which
wasn't initially part of the plan, turned out to be easier than
forbidding them, due to the way decorations interact. Another
decoration could hide the newline next to a block widget, something
the initial implementation could not deal with gracefully.

### Generic Gutters

The first demo came with a line number gutter, but no way to create
gutters for other purposes. I generalized the gutter plugin so that is
now possible to create your own custom gutters and dynamically add or
change the content that is displayed in them.

### Doc Generation

We wrote a [system](https://github.com/adrianheine/gettypes/) that
uses the TypeScript library to extract both doc comments and types
from a TypeScript project, and output them as a JSON structure.
Feeding this into the
[builddocs](https://github.com/marijnh/builddocs/) tool allows us to
build good-looking, interlinked reference documentation directly from
the source code.

The system is already being used to generate [Lezer's reference
docs](https://lezer.codemirror.net/docs/ref/), and we're working on
applying it to CodeMirror.

### Lezer

This is the biggest one, and kept me busy for most of the spring and
summer. It was clear that we'd want to move beyond CodeMirror 5's
primitive syntax analysis system, but it wasn't clear how.

That is, until I saw [tree-sitter](http://tree-sitter.github.io/),
which is a _practical_ implementation of an incremental LR parser,
giving you a real syntax tree for your code and updating it cheaply
when you make changes. It is used in the Atom editor.

Unfortunately, tree-sitter is written in C, which is awkward to run in
the browser (we're still targeting non-WASM browsers). It also
generates very hefty grammar files because it makes the size/speed
trade-off in a different way than a browser-based system would.

Thus, I set out to clone tree-sitter in JavaScript. And because I
always feel I know everything better, I didn't exactly clone it, but
rather built a different system inspired by it. That system is
[Lezer](https://lezer.codemirror.net/), an incremental parser
generator and runtime system for JavaScript.

This was a relatively big project. And then, when I started
integrating it with CodeMirror 6, I was forced to go back to the
drawing board several times to work out issues.

But the system turned out well. If a grammar has been written for your
language (we have JS, CSS, HTML, and XML so far), CodeMirror can keep
a syntax tree of your document as you are editing it. This tree is
used for (more accurate) highlighting, indentation, folding (soon) and
has a host of other potential uses.
