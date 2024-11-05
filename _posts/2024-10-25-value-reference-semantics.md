---
layout: post
title: Reference Semantics and Value Semantics
tags:
- javascript
- data structures
---

The concept of an object, record, structure, or product type occurs in
almost every programming language. Being able to declare a type of
value that groups a number of other values together is a fundamentally
useful thing.

As similar as the various record-ish constructs are in their basic
functionality, the way such values are actually looked at and handled
can be rather sharply divided in two different styles. Some
programming languages or systems strictly prescribe one or the other,
but in many cases you can use both.

In such a system, as a user of a data type, you _will_ need to know
what style of data type you are dealing with, in order to use it
correctly and effectively.

## Reference Semantics

Records are implemented as a piece of memory where their content is
laid out at adjacent memory positions. The way to identify such a
record value is by its memory address.

Memory can be written to, so records can be changed. You can put new
values into their fields, and thus the content of a record changes
over its lifetime.

But it's still the same record, even though some of its fields may
have changed value. So the way to compare two records is by address.
You're interested in the _identity_ of a record, not so much its
current content. When implementing a hash table that uses records as
keys, you hash the memory addresses.

## Value Semantics

Mathematical product types allow us to treat a group of values as a
single value. For example, a two-dimensional coordinate is a pair of
numbers.

In implementing computer programs that manipulate such values, we may
or may not put their content in memory somewhere. But that is not
terribly relevant to our programming model.

Changing the x position of an existing coordinate pair is not a thing.
You can create a new value if you need a new pair of coordinates. It
is possible to define algebraic rules on records, defining
equivalences that hold on the result of certain operations.

Comparing two records is done by comparing their contents. Whether
they happen to occupy the same memory is immaterial. A hash table with
records as keys obviously hashes their contents.

With value semantics, a record is just the sum (product?) of its
contents, and nothing beyond that. It doesn't have its own _identity_.

## Know Your Semantics

Both of these approaches provide a coherent way of dealing with record
values, and kind of force you to use the whole package—if you're going
to mutate your record, you probably also need to compare them by
identity. If you're going to make them immutable, you _must_ implement
updates by creating new values, and will generally want to compare by
value, because object identity has little meaning then.

In Haskell, you're going to be using value semantics whether you like
it or not (you probably do like it, or you wouldn't be using Haskell).

In most imperative programming languages there are situations that
call for reference semantics and situations that call for value
semantics. A mutable container or a stateful subsystem is best
implemented with a reference-semantics type. A small composite value
or a data structure where referential transparency is valuable is much
better treated as a value.

Some languages provide different constructs for these two types of
records, making it clear what you are dealing with in any given
situation. But many don't. They may not even provide reasonable
mechanisms for indicating what can be mutated and what is immutable.
When working with such a crude language it is important to be aware of
the way a given type is intended to be used.

Once you know what to look for, it tends to be easy enough to
recognize the style in which a given data type is intended to be used.
If its operations are defined in ways that mutate the value, that
suggests reference semantics. If its fields are marked as read-only
(assuming the language makes such a thing possible), and operations
produce new values rather than updating existing objects, you're
likely expected to think in terms of value semantics.
