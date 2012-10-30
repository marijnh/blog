---
layout: post
title: "Overloading plain text: CodeMirror marked ranges"
tags:
- javascript
- codemirror
- cm-internals
---

One common feature request that CodeMirror version 1 was fundamentally
unable to support (due to its reliance on `contentEditable`), and
which was thus built into version 2 from the start, is
programmatically styling stretches of text. In version 2, you can call
`instance.markText(from, to, className)`, and it'll style that stretch
of text with the given CSS class.

By version 2.16, it was actually possible to edit the text around and
inside such a marked range without strange corruptions occurring. That
version also added a way to query the marked range for its current
position (if any) within the document.

Then, last month in version 2.34, marked ranges were integrated with
the undo history, so that if you delete a stretch of text that
contains marked ranges, undoing the deletion will bring back the
ranges, not just the text.

And last week, prompted by use cases from two different customers, I
decided to add a number of rather radical extensions to this API. In
the current code in the `v3` (future version 3) branch of the
CodeMirror repository, it is possible to...

* Force ranges to be treated as atoms as far as cursor motion is
  concerned (the cursor is never inside of them—they are skipped over
  by one cursor motion, and deleted by a single backspace action).
* Make ranges read-only, so that they can not be deleted from the
  document at all.
* Collapse ranges, hiding their content.
* Replace a (collapsed) range with a widget, which is an arbitrary DOM
  node.
* Automatically clear (remove) a range when the cursor enters it.

The third one (collapsing) was the tricky part. If a range, which may
span multiple lines, can be collapsed, that means that line boundaries
are no longer as absolute as they used to be. If a range spanning the
end of line one and beginning of line two is collapsed, content from
line and line two ends up being rendered on what is visually the same
line.

This broke a *lot* of assumptions in the existing code, which required
me to completely rewrite a few pieces of the editor (selection
drawing, character position measurement) and required subtle changes
to many others. The fallout from these extensive changes are probably
going to delay the release of version 3 for another month.

But it's worth that!

For one thing, I could simply drop the old line-folding (hiding)
system and all its interaction with the rest of the system, since
hiding whole lines is simply a special case of hiding arbitrary
stretches of text. I've rewritten the code [folding add-on][fold] to
use the new APIs to hide precisely the folded range, and replace it
with a little widget that can be clicked to un-fold the range.

[fold]: http://codemirror.net/3/demo/folding.html

The use cases that prompted these extensions are actually quite
similar to something that some Emacs packages do: text as a user
interface. If you make some text read-only, insert widgets where
appropriate, and use styling to make it clear which text is editable,
you can provide a rather smooth interface for things like forms,
interactive prompts, or even, if you're willing to stretch it,
[games][blackbox].

[blackbox]: http://www.opensource.apple.com/source/emacs/emacs-51/emacs/lisp/play/blackbox.el

And there you have it. My secret ambition is to replace Emacs, at
least for my own use. The concept of writing shells for everything I
do in my text editor appeals to me. But the Emacs way of doing that
is, unfortunately, firmly grounded in the 1980s (or 70s), and shows
few [signs][lexical] of moving into the 21st century. The APIs are
just to obscure, the [language][elisp] too slow, and the ecosystem too
weird for me.

[lexical]: http://www.emacswiki.org/emacs/DynamicBindingVsLexicalBinding
[elisp]: http://www.gnu.org/software/emacs/emacs-lisp-intro/

(A fair number of other parts will have to be put in place for
CodeMirror to be viable as a day-to-day editor, but I'll talk about
those in some other entry.)

Obviously, this castle-in-the-sky plan is not the only use case for
the marked range enhancements. As a more concrete example, I hope to
soon write an add-on on top of them that allows you to replace
stretches of text matching a specific pattern with a widget, and then
expand them back to regular text as the user moves the cursor into
them. For example, in a LaTeX document, you could replace sequences
like `\epsilon` with an actual `ε` character, and but when you copy a
chunk of text containing that range, you'd still get the original
`\epsilon` text, and if you move the cursor into it, it expands into
that text and you can edit it at will. So the *presentation* of the
document can be enhanced, without actually harming its *consistency*
as a simple editable plain-text document.
