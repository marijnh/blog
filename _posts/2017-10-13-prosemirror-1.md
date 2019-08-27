---
layout: post
title: ProseMirror 1.0
tags:
- javascript
- prosemirror
- architecture
---

Two years ago, I started the [ProseMirror
project](http://prosemirror.net) because I wanted to take a stab at [a
better approach](prosemirror.html) to WYSIWYG-style editing. Today,
I'm releasing [version
1.0](https://discuss.prosemirror.net/t/release-1-0-0/998) of [the
library](https://github.com/prosemirror/). The architecture and scope
of the project have changed quite a bit during its lifetime, but I
feel that the original goal has been met.

ProseMirror is a Web interface component, and though some of the
challenges it tackles are specific to the strengths and (especially)
weaknesses of the Web platform, don't think of it as another TinyMCE
alternative. Rather, it is a more general take on rich text editing
that happens to be implemented in JavaScript for the browser.

## Schema-based editing

Most importantly, ProseMirror is agnostic to the actual document
shape, making it possible to build applications on top of this library
that in the past would have required a fully custom editor
implementation.

What I mean by being agnostic to document shape is ProseMirror's
[schema](http://prosemirror.net/docs/guide/#schema) feature. The core
editor has no built-in opinion about what a document looks like, and
instead looks at a piece of configurable data (the schema) to figure
out what kind of content is allowed and how it is structured.
ProseMirror will work with
[precisely](http://prosemirror.net/examples/schema/) the
[custom](http://prosemirror.net/examples/dino/) semantic document
format that you need, while still giving you the WYSIWYG style of
editing that users are used to.

For example, a scientific writing app could use a schema that includes
sections, footnotes, and references—two such apps,
[SciFlow](https://sciflow.net/en/home) and [Fidus
Writer](https://www.fiduswriter.org/) have been built on top of
ProseMirror. Or a news organization could build a schema that reflects
their content model, to provide an editor for journalists to write in.
For example, [The New York Times](https://www.nytimes.com/) is using
ProseMirror in its CMS. Or if your company has editors for a number of
differing content models, using ProseMirror with different schemas can
make it easier to unify your editor code.
[Atlassian](https://www.atlassian.com/) is rolling out ProseMirror
across their products, ranging from wiki to bug tracker to source
hosting.

## Collaboration

Support for [collaborative editing](collaborative-editing.html) has
been a focus in ProseMirror from the start. Several aspects of the
system, such as the way document updates are represented, or the way
the undo history module works, have been strongly influenced by the
requirements of collaborative editing. I've become convinced that this
is not a feature you can robustly bolt onto an existing rich text
editor.

Fortunately, these constraints, rather than forcing the design into an
uncomfortable corner, helped push it in a generally beneficial
direction. Several other tricky applications, such as change tracking
and the ability to roll back past changes, were made possible by
[design decisions](http://prosemirror.net/docs/guide/#transform.steps)
made for collaborative editing-related reasons.

## Transactional state updates

Trying to combine the requirements of collaborative editing with a
functional [unidirectional data
flow](http://redux.js.org/docs/basics/DataFlow.html) architecture led
us to a design where the editor, instead of unilaterally updating its
state, emits transactions. A transaction can be used to compute a new
state with which to update the editor.

This makes it possible to almost seamlessly integrate the editor in
your application's data flow cycle if you want to. In addition, having
updates as first-class values makes it much easier to keep external
state in sync with the editor, which allows new, powerful types of
extensions.

## Conclusion

After years of wild experiments and constant change, starting with the
1.0 release we are aiming for stability. The central modules will stay
on 1.x for as long as possible, which means new releases won't require
you to change your code. There's an [RFC
process](https://github.com/prosemirror/rfcs/) that we'll use to get
community feedback on new features

If you're looking for a simple drop-in rich text editor component,
ProseMirror is probably not what you need. (We do hope that such
components will be built on top of it.) The library is optimized for
demanding, highly-integrated use cases, at the cost of simplicity. But
if your app is pushing the limits of what has been possible with
WYSIWYG editors so far, [take a look](http://prosemirror.net/).
