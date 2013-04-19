---
layout: post
title: Parsing line noise as JavaScript
tags:
- javascript
- parsing
- tern
---

I am writing a tool that tries to enhance a JavaScript code editor by
doing some halfway serious static analysis on code, as it is being
written. To analyze code, you'll want to parse it, because—believe
me—running casual regexps over programs in order to determine their
structure is not a healthy direction to go in. But *unfortunately*,
code that's in the process of being written will, most of the time,
not be in a syntactically valid form.

Thus, the kind of software that usually passes for a parser is not
much help. A typical parser understands it as its responsibility to
diligently check its input for validity, and complain, rather than
return a useful result, when a problem is found.

That's not what we want. We need access to an abstract syntax tree,
not an error message.

One solution that comes to mind is a technique often used by some
compilers: when they come across a syntax error, they'll report it,
skip forward to a heuristically determined 'safe point' (often the
start of the next statement, function, or block) and continue parsing.

However, skipping forward will drop the current context on the floor.
And since the invalid part of the code is very likely to be the part
that the cursor is currently at, the constructs used near this
position are of great interest. Throwing them out more or less defeats
our purpose.

## The red marker and eraser approach

At first, I believed I could cleverly reuse my existing parser by
using the following approach:

* Run a regular parse.
* When the parser reports an error, first use a pass that tries to
  balance braces, brackets, and parenthesis in the file using a simple
  tokenizer and some heuristics to determine whether to remove or add
  braces at a given point.
* After that, when the parser still reports errors, try to blank out
  (replace by spaces) the tokens near the errors.

That didn't work out. To make any kind of informed judgement on where
to move braces or how big a range to blank out, you need a lot of
context information. Thus, my 'light-weight error fixer' was quickly
growing into a heavy-weight monster, and still pretty ineffective at,
you know, actually getting a file to parse.

In retrospect, I'm not sure why I ever thought this was a good idea.
I'm just documenting it here to dissuade other people from going down
a similar route.

## A full, but very open-minded parser

What worked a lot better, and was actually not that much work in my
case (where the target language is JavaScript, which isn't a very
complicated language), was to just write a new parser.

I reused the tokenizer from [Acorn][ac], my JavaScript parser. I also
reused the general structure of the parser, by working from a copy and
then editing that, which saved a lot of work, and, by allowing me to
work from a well-tested algorithm, helped avoid a lot of mistakes.

[ac]: acorn.html

The new parser is guided by two principles:

* It never raises an error.
* When it encounters weird syntax, it tries to sanely interpret as
  much of the surrounding (non-weird) syntax as possible (i.e. throw
  away as little information as possible).

Some of the changes made to the parser were mechanical—simply kill all
code that verifies non-essential properties of the code, for example
whether a labeled `break` corresponds to a known label. Others added
local heuristics, for example when no `while` keyword is found after a
`do` body, simply invent a bogus expression to take the role of the
condition.

The original parser uses an operator called `expect` to enforce that
it wants to see a certain kind of token, and raise an error otherwise.
The loose parser uses a similar operator, which, if the token isn't
there, looks at the next two tokens, and skips forward if one of them
matches. If none match, it'll just return, not consuming any token—and
the parse continues as if the token was there.

Using such a careless style of parsing gets you surprisingly far. But
it still leaves open the problem of a missing or superfluous brace
leading to a wildly incorrect interpretation of everything after it.
To get around that, the loose parser relies heavily on indentation to
guide the way it parses blocks. Basically, when a new statement (or
new object property, or new array element) is indented less than the
first one in the block, it assumes that the block (or object literal,
or array) ends there.

That works very well for properly indented code. But it will go wrong
when indentation is sloppy, or people do cute things like not
indenting their debug statements. This is why the loose parser should
be used as a backup for when the regular parser fails, in order to get
at least *some* kind of syntax tree, but never as a primary parser.

Finally, a subtle problem of this parsing strategy—when in doubt,
don't advance the token stream—is that is very easy to get into
infinite loops. For example, say you're trying to parse an argument
list, and there's a bunch of nonsense in the middle such as `foo(a, ],
c)`. The argument list parser obviously has a loop in it, calling
`parseExpression` for each argument. When it runs into the `]`,
`parseExpression` returns a dummy node, because it couldn't find any
expression there. The argument list parser then *optionally* skips a
comma (it parses `foo(a c)` as `foo(a, c)`—tolerant as it is), and
continues. If that was all there was to it, the above expression would
land us in an infinite loop.

To work around that, a few select parts of the parser have special
cased code to ensure that the token stream does, somehow, advance on
every iteration of their loops. For the argument list parser, it will
check that the expression it parsed isn't a dummy placeholder, and if
it is, discard a token and ignore the dummy expression. This, combined
with the fact that it'll bail out when it finds a token indented less
than or equal to the line that started the list, makes it return more
or less sane results for most inputs.

## Get the code

This new parser is a submodule of my [Acorn][ac] parser, and lives in
the [`acorn_loose.js`][pl] file. If you've come up with a use for such
a parser, or just want to see if you can break it, check out the git
repository, and have fun. It runs both in Node and in the browser.
It's not terribly mature or stable, but it does what it claims to do.

[pl]: https://github.com/marijnh/acorn/blob/master/acorn_loose.js
