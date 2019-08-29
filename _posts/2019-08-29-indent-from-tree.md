---
layout: post
title: Computing Indentation from Syntax Trees
tags:
- tooling
- codemirror
---

Most code editors have some concept of automatic indentation. For each
language, they have some logic that can compute an appropriate
indentation for a given line. They may immediately indent when you press
Enter, or require some interaction to reindent a line or selection.

Even with the cleverest tools, there isn't always a single definite
indentation for a given line. In a language like Python, whether a
line should continue the current block or dedent to some parent block
isn't obvious from the context. Inside multi-line strings or comments,
an editor can only guess what the user is trying to do. But even
there, having a guessed indentation that you may need to correct is
usually more convenient than having to manually indent every line.

In the process of maintaining [CodeMirror](https://codemirror.net),
I've written a lot of indentation logic for a lot of languages.
Initially directly on top of the source string, by applying heuristic
regexps to the ends of previous lines (which was as fragile as it
sounds). Then from data left behind by the glorified tokenizers
CodeMirror used for highlighting, which worked better, but required
those tokenizers to do extra indentation-specific work.

CodeMirror (in version 6) is moving towards building real syntax trees
for its content. A big part of the reason that many indenters are ugly
hacks is that they usually don't have access to the information they
need, at least not in a convenient format.

Syntax trees are that convenient format.

## A Theory of Indentation

Most forms of indentation fall into two categories. They either indent
relative to the indentation of some reference line, or they align to
some specific position.

The first is the most common. If you have this code, the function
arguments are indented relative to the start of the line where the
argument list starts.

```
call(
  one,
  two)
```

Because (outside of Lisp) you tend to have different indentation
styles for different constructs, it makes sense to associate them with
syntax node types. In the example above, we'd be applying the
indentation style for argument lists.

To go from a line in a parsed document to an indentation, you first
figure out the strategy that applies at this point, which you get from
the innermost node that wraps the start of the line _and_ has an
indentation style associated with it.

```
if (x) {
  A
  B
}
```

That node may span multiple lines, for example in a block like the one
above, when indenting the statements on lines 2 or 3, the wrapping
node is the block node. That node's indentation style might say
“indent one unit beyond my start line”. Because the block starts on
line 1, with indentation 0, we indent the statements a single unit.

The start of line 3 is also inside the block. But because the line
closes the block, it should not add indentation. Many node types have
some constructs that they shouldn't indent—a closing token is one, but
the `else` token in an if statement, or a hanging `{` in a K&R-style
function definition, are others.

When the content of a bracketed node starts immediately after the
opening bracket, many styles align subsequent lines with the opening
bracket.

```
call(one,
     two)
```

Here the indentation isn't relative to the construct's start line, but
to a specific token.

Some constructs, such as multi-line strings or block comments, can
indicate that they shouldn't be indented.

---

When I claimed that nodes compute indentation relative to the line on
which they start, I was oversimplifying. If you have code like this:

```
function foo(a, b,
             c, d) {
  body()
}
```

The body block probably shouldn't be indented past the `c`. Yet it
does start on line 2, which is indented 13 spaces.

When figuring out the reference line for a given node, you have to
check whether that line starts inside another node (that is not a
parent node of the target node), and if so, continue looking at the
start of that node.

So in the example, we'd notice that line 2 starts inside a parameter
list, which isn't a parent of the body block, and thus use line 1 as
reference line.

Unfortunately, not all nodes should be skipped like this. For example,
in this code the member expression `foo.bar` would match the
description of a non-parent node covering the start of the line, if
the syntax tree is structured like `call_expr(member_expr(...),
arg_list(...)`.

```
one.
  two(
    three)
```

But we _do_ probably want to indent the argument list relative to line
2. So this requires us to either use heuristics (such as only skipping
bracketed nodes) or some extra language-specific information telling
us which nodes must be skipped.

## Implementation

CodeMirror's new indenter requires language packages to attach
indentation information to syntax tree node types. That way, even if
the document contains multiple languages, it can figure out an
indentation directly from the tree.

This information takes the form of a function that computes an
indentation depth, given some contextual information like the syntax
tree, the target node, the document, and the size of an indentation
unit.

Being a function, it can be as complicated as it needs to be. There
are helpers for defining functions that support common styles, such as
bracketed nodes that align content to their opening bracket when that
isn't the last token on the line.

Because content is often in a syntactically invalid state when
indentation is requested, the indenter takes care to “enter”
unfinished nodes in front of the cursor when determining the context
for the indentation. For example, if you press enter after this
unfinished `if` statement...

```
if (x < y &&
```

The syntax tree will look something like...

```
if_statement(
  paren_expr(
   binary_expr(binary_expr(...), incomplete),
   incomplete),
  incomplete)
```

Where `incomplete` means that the node was cut off by the parser's
error-correction feature. The start of the next line is outside of all
this, but because we know that the node before it was incomplete, we
can indent as if we are in that node—so that puts us inside of
`binary_expr`, which may not have an indentation style. But
`paren_expr` probably does.

```
if (x < y &&
    // continue here, aligned to the (
```
