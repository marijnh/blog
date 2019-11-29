---
layout: post
title: CodeMirror MOSS project report
tags:
- codemirror
- open source
---

Development of CodeMirror 6 this year has been generously
[supported](https://codemirror.net/6/#sponsors) by Mozilla through
their [MOSS](https://www.mozilla.org/en-US/moss/) program.

The MOSS program asks for a closing retrospective blog post describing
the progress made during the grant period. I've written about the
progress in the first 9 months of the year in my [status update
post](codemirror-6-progress.html) from August. To summarize, in that
period we:

 - Implemented solid text composition support.

 - Designed a powerful [extension system](https://marijnhaverbeke.nl/blog/extensibility.html).

 - Documented the system with doc comments and set up a process to
   generate HTML documentation from that.

 - Created a [parser system](https://lezer.codemirror.net/) and
   integrated it with syntax highlighting.

 - Implemented and improved various less glamorous subsystems
   (styling, gutters, in-text widgets).

---

The past few months have been focused more on concrete user-visible
features, instead of big architectural questions. We've added these
features:

 - Code folding support.

 - A generic extension for showing UI panels above and below the
   editor.

 - A search and replace interface.

 - A generic tooltip extension.

 - Support for in-editor linting, highlighting issues in the text.

 - Support for autocompletion.

 - A theming system that can be used to customize the styling of the
   elements produced by these various extensions.

 - A way to provide translations for the strings used in the UI.

You can see many of these features in action in the
[demo](https://codemirror.net/6/) on the website.

Working on concrete extensions was a good way to find out how well our
abstractions work in practice. Though we did end up adjusting some
things, on the whole the system was a pleasure to work with.

Specifically, the way extensions can be built up out of different
behaviors and other extensions was extremely useful. "Behaviors" (the
name will probably change to "aspect" sometime soon), the named fields
that extensions can add values to, are not just useful for
configuration, but also allow, for example, extensions that want to
display a panel to simply provide a behavior that indicates this,
which is read by the panel-displaying extension. This models something
that would be a side-effect (opening and closing panels) in most
designs in a much simpler, more robust way.

---

Work is still ongoing, and will continue into 2020. The list of
missing functionality is getting shorter and shorter, but there's a
bunch of stabilizing and easy-of-use improvements still ahead. In any
case, given how easy the above extensions were to implement, I'm
slowly starting to believe that our base architecture is solid.
