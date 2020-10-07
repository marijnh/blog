---
layout: post
title: Extensible Extension Mechanisms
tags:
- architecture
---

It has become fashionable to structure big systems as a number of
separate packages. The driving idea is that it is better to, instead
of locking people into your implementation of a feature, provide the
feature as a separate package that they can load alongside the core
system.

This gets you, roughly...

 - The ability to not even load features you don't need, which is
   especially helpful in client-side systems.

 - The possiblity of replacing functionality that doesn't serve your
   purpose with another implementation. This also reduces the pressure
   on the core modules to cover every possible use case.

 - A reality check for the core interfaces—by implementing basic
   features on top of the client-facing interface, you are forced to
   make that interface at least powerful enough to support those
   features, making sure that things just like them can be built with
   3rd-party code.

 - Isolation between parts of the system. Contributors just have to
   look at the package they are interested in. Packages can be
   versioned, deprecated, or replaced without impacting the core.

The cost of this approach is mostly one of complexity. You can provide
a batteries-included wrapper package to get users started, but at one
point they will probably have to remove the cover and start installing
and configuring specific helper packages, which tends to be harder
than flipping on a feature in a monolithic library.

This post will try to explore designs for extension mechanisms that
support “extension at scale” and unanticipated new extension points.

## Extensibility

What do we want from an extensible system? Firstly, of course, it has
to allow external code to extend its behavior.

But that is hardly enough. Let me illustrate with an anecdote about a
stupid thing I did at some point. I work on editor software. An early
version of a [code editor](https://codemirror.net) allowed client code
to _set_ the style of a given line. This was great—now you can
selectively style a line.

Except that, as soon as two independent pieces of code try to style a
line, they will step on each other's toes. The second extension to
touch the line will override the first extension's style. Or, when the
first one tries to remove its styling at some later point, it will
instead clear the second one's style.

The solution was to make it possible to _add_ (and remove) styling,
instead of setting it, so that two extensions can interact with the
same line without sabotaging each other.

More generally, you have to make sure that extensions can be
_combined_, even if they are entirely unaware of each other's
existence, without causing problematic interactions.

To do this, each extension point must support being acted on by any
number of actors. How multiple effects are handled differs by use
case. Some strategies that may make sense are:

 - They all take effect. For example when adding a CSS class to
   element or show a widget at a given position in the text, you can
   just do all of them. Some kind of ordering is still often needed,
   though: The widgets need to be shown in a predictable, well-defined
   order.

 - They form a pipeline. An example of this would be a handler that
   can filter changes to the document before they are applied. Each
   handler gets fed the change the handler before it produces, and can
   further modify it. Ordering is not essential here, but can be
   relevant.

 - A first come, first served approach can be applied to, for example,
   event handlers. Each handler gets a chance to handle the event,
   until one of them declares that they have handled it, at which
   point the ones behind it in line don't get asked anymore.

 - Sometimes you really need to pick a single value, such as to
   determine the value of a specific configuration parameter. Here it
   may make sense to use some operator (say, logical _or_, logical
   _and_, minimum, or maximum) to reduce the inputs to a single value.
   For example an editor might enter uneditable mode if _any_
   extension tells it to, or the maximum document length might be the
   minimum of the values provided for that option.

With many of these, ordering is significant. That means that the
precedence with effects are applied should be controllable and
predictable.

This is one of the places where imperative, side-effect based
extension systems tend to fall short. For example, the browser DOM's
[`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
operation will cause event handlers to be called in the order in which
they were registered. This is fine if a single system controls all the
calls, or if the ordering happens to be irrelevant, but when you have
multiple pieces of software independently adding handlers, it can
become very hard to predict which ones will be called first.

## A Simple Approach

As a concrete example, I applied the modular strategy for the first
time in [ProseMirror](https://prosemirror.net), a rich text editor
system. Its core is pretty much completely useless on its own—it
relies on additional packages to describe the structure of documents,
to bind keys, to provide the undo history. Though the system _is_ a
bit challenging to use, it has seen adoption in systems that need to
customize things that classical editors don't allow you to customize.

ProseMirror's extension mechanism is relatively straightforward. When
creating the editor, the client code specifies a single array of
plugin objects. Each of these plugins can influence various aspects of
how the editor works, doing things like adding bits of state data or
handling interface events.

All these aspects have been designed to work with an ordered array of
configuration values, using one of the strategies outlined in the
previous section. For example, when you specify multiple key maps, the
ordering in which you specify the instances of the keymap plugin
determines their precedence. The first keymap that knows how to handle
a given key gets it.

This is usually powerful enough, and people have been making good use
of it. But at a certain level of extension complexity it becomes
awkward.

 - If a plugin has multiple effects, you have to either hope that they
   all need the same precedence relative to other plugins, or you have
   to split it into smaller plugins to be able to arrange the
   precedences correctly.

 - Ordering plugins becomes very finnicky in general, because it's not
   always clear to end users which plugins interfere with which other
   plugins when given a higher precedence. Mistakes tend to only
   manifest themselves at run-time, when using specific functionality,
   making them easy to miss.

 - Plugins that build on other plugins have to document that fact, and
   hope that users will remember to include their dependencies (in the
   right place in the ordering).

CodeMirror [version 6](https://github.com/codemirror/codemirror.next)
is a rewrite of the [code editor](https://codemirror.net) by that
name, in which I'm trying to take the modular approach further. This
requires a more expressive extension system. Let us go over some of
the challenges involved in the design of such a system.

## Ordering

It's not hard to design a system that provides full control over the
ordering of extensions. It _is_ pretty hard to design such a system
which is pleasant to use and allows you to combine independent
extension code without a lot of finnicky manual intervention.

One tempting solution, when it comes ordering, it so work with
precedence values. An example of this is
[`z-index`](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
property in CSS, where you specify a number that determines where an
element is placed in the depth stack.

As the [comically large](https://psuter.net/2019/07/07/z-index)
`z-index` values that one often finds in style sheets illustrate, this
way of specifying precedence is problematic. A given module, in
isolation, doesn't know which precedences other modules are
specifying. The options are just points on an undifferentiated numeric
range. It can provide a huge (or deeply negative) value in the hope of
hitting one of the far ends of the scale, but everything else requires
guesswork.

This can be made somewhat better by defining a limited set of
well-labeled precedence categories, so that extensions can classify
the general “level” of their precedence. You still need some way to
break ties within categories.

## Grouping and Deduplication

As I mentioned before, once you start heavily relying on extensions
you might have some extensions making use of other extensions. Manual
dependency management doesn't scale very well, so it would be nice if
you could pull in a group of extensions at once.

But, besides making the ordering problem even more pressing, this
introduces another issue: Multiple extensions might depend on a given
extension, and if extensions are represented as values, you can easily
end up loading the same extension multiple times. For some types of
extensions, such as keymaps or event handlers, this is okay. For
others, like an undo history or a tooltip library, this would be
wasteful or even break things.

Thus, it seems that allowing extensions to be composed forces some of
the complexity of dependency management onto your extension system.
You'll need to be able to recognize extensions that shouldn't be
duplicated, and load only one instance of them.

But since, in most cases, extensions can be configured, and thus not
all instances of a given extension are the same, we can't just pick
one instance and use that—we have to somehow merge those instances in
a meaningful way (or report an error when this isn't possible).

## A Design

Here I'll outline what we're doing in CodeMirror 6. I'm presenting
this as a sketch of a solution, not The Definitive Solution. It is
entirely possible that this system will further evolve as the library
is stabilized.

The core primitive in this approach is called a _behavior_. Behaviors
are the things that extensions can extend by providing values. An
example would be the state field behavior, where extensions can add
new fields by providing a field description. Or the browser event
handler behavior, where extensions can add their own handlers.

From the point of view of a behavior consumer, behaviors, as
configured in a specific instance of the editor, provide an ordered
sequence of values, with the higher-precedence ones coming first. Each
behavior has a type, and the values provided for it should match that
type.

A behavior is represented as a value, which is used both to declare an
instance of the behavior and to access the values the behavior has.
The library comes with a number of built-in behaviors, but external
code can define its own. For example, the extension that defines a
line number gutter could define a behavior that allows other code to
add additional markers to that gutter.

An _extension_ is a value that can be used to configure the editor. An
array of them is passed on initialization. Each extension resolves to
zero or more behaviors.

The simplest type of extension is simply an instance of a behavior.
When you specify a value for a behavior, it returns an extension value
that produces that behavior.

A sequence of extensions can also be grouped into a single extension.
For example, an editor configuration for a given programming language
might pull in several other extensions, such as a grammar to parse and
highlight the language, information about how to indent it, and an
autocompletion source that intelligently provides suggestions for that
language. So you'd have a language extension that just collects these
relevant extensions and groups them together into a single extension
value.

A simple version of this system could stop here, and just flatten out
the nested extensions into a single array of behavior extensions.
These could then be grouped by behavior type, and there you have your
ordered sequences of behavior values.

But we still need to address deduplication and provide more control
over ordering.

A third type of extension value, _unique_ extensions, are the
mechanism for deduplication. Extensions that don't want to be
instantiated twice in a single editor provide an extension of this
kind. To define one, you must provide a _spec_ type, which is the type
of configuration value that the extension constructor expects, and an
_instantiation function_, which takes an array of such spec values,
and returns an extension.

Unique extensions somewhat complicate the process of resolving a
collection of extensions into a set of behaviors. As long as there are
unique extensions in the flattened set of extensions, the resolver
must pick one type of unique extension, collect all instances of it,
call its instantiation function with their specs, and replace them
with (a single instance of) the result.

(There's another catch, in that these must be resolved in the right
order—if you first resolve unique extension X, but then later
resolving Y yields another X, that would be wrong, since all instances
of X should be combined together. Since extension instantiation is
pure, the system handles this by trial-and-error, restarting the
process—and recording information about what it learned—when it runs
into this situation.)

Finally, we must address precedence. The basic approach is still to
preserve the ordering in which the extensions were provided. Compound
extensions are flattened into that same ordering at the position where
they occur. The result of resolving a unique extension is inserted at
its first occurrence.

But extensions can assign some of their sub-extensions to a different
precedence category. The system defines four such categories:
_fallback_ (take effect after the other things), _default_, _extend_
(higher precedence than the bulk), and _override_ (should probably be
on top). Actual ordering happens first by category, then by original
position.

So an extension that has a low-priority keymap and a regular-priority
event handler could give you a composite extension built out of the
result of the keymap extension (without needing to know what behaviors
that is made up of) with its priority set to fallback, plus an
instance of the event handler behavior.

The way extensions can be combined without worrying about what they
are doing internally seems a major win. In the extensions that we've
modeled so far, which include a two parsing systems that expose the
same syntax behavior, a syntax highlighter, a smart indentation
service, the undo history, a line number gutter, bracket matching,
keymaps, and multiple selections, it seems to work well. It also
anticipates some of the problem that I ran into in ProseMirror, though
no one has actually built complex enough setups with this system yet
to run into them.

There _are_ a few new concepts that users need to grasp to be able to
use this system, and it is decidedly harder to use than the imperative
systems that are traditional in the JavaScript community (call method
to add/remove effect). Having extensions properly compose seems to
provide enough value to offset that cost.
