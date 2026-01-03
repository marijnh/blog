---
layout: post
title: TypeScript's unknown type and type variance
tags:
- types
- typescript
- data structures
---

Type systems have a tendency of sneaking up on you. You start just
trying to enforce some obvious invariants like “I shouldn't be able
to assign a string value to a Boolean-typed variable”, and before you
know what's happened you're reasoning about subtyping relations and
type parameters.

One thing that I keep running into, but for a long time refused to
properly get to the bottom of, is that using `unknown` in TypeScript
would so often lead to complicated type errors.

TypeScript has three funky special types:

 - `any` is your basic way to make the type system shut up. It is a
   supertype _and_ a subtype of every other type. It can be useful,
   but if you use it widely you might as well not check your types at
   all, because it generates type system soundness holes big enough to
   drive a truck through.

 - `unknown` indicates a type that we know nothing about. It is a
   supertype of everything, and a subtype only of itself and `any`.
   This means you can pass anything to a function that takes an
   `unknown` parameter, but you can't use an `unknown` value in a
   place where a properly typed value is required. It is a less
   dangerous way to indicate that we don't know the type of something.
   Unlike with `any`, you'll actually have to perform some kind of
   explicit downcast in order to use the untyped value.

 - Finally `never` is a subtype of everything, but a supertype only of
   itself and `any`. This is most often used to indicate unreachable
   code (a function that always throws, for example, returns `never`)
   or forbidden data structure shapes.

The situation I want to talk about here is type-parameterized data
structures that are used in a heterogeneous way. As a concrete
example, say you have a `Widget<T>` type, where each widget has a
parameter of type `T` and a type of type `WidgetType<T>` which defines
what it looks like and how it and behaves.

The type parameter is useful, because if you have text widget
`Widget<string>` you want to be able to treat `widget.param` as a
string. But if you have a collection of widgets, which may have
different parameter types, how do you type that?

`Widget<any>[]` is wonderful, of course. This is the old way of doing
this in pre-version-3.0 TypeScript. Never produces any type system
complaints... because it completely turns off type checking on these
parameters.

Since that moots a lot of the advantages of doing type checking in the
first place, the general recommendation is to use the `unknown` type.
So our array is now a `Widget<unknown>[]`. Great.

Except that `widgetArray.push(textWidget)` now produces a puzzling
type error (“`Widget<string>` is not assignable to
`Widget<unknown>`”). If our generic widget type is not a supertype of
specific widget types, that makes this pattern very difficult to work
with. Wasn't `unknown` a supertype of everything? What is going on?

[_Variance_](https://en.wikipedia.org/wiki/Type_variance) is what's
going on. Variance is one of those unwelcome complications that come
up when you start defining a halfway powerful type system. I'll
refrain from explaining it in depth here—you can find plenty of good
explanations on the internet—but it roughly boils down to this:

 - If `B` is a subtype of `A`
 - then `(b: B) => number` is a _supertype_ of `(a: A) => number`

Some ways to use types, such as taking them as function parameters,
invert the subtyping relationship. If the parameter to function `F` is
a subtype of the parameter to function `G`, then `G`'s type, because
you can pass it a subset of the types that `F` takes, is a _supertype_
of `F`'s type.

For parameterized data structures, this means that `T<B>` is no longer
a subtype of `T<A>` when it contains functions that take values of the
type of the type parameter as arguments.

So if the widget looks something like this...

```
type Widget<T> = {
  parameter: T,
  type: {render: (parameter: T) => Pixels}
}
```

... then `Widget<boolean>` is no longer a subtype of
`Widget<unknown>`. And _that_ is why using `unknown` often just
doesn't work as well as you'd hope.

One way around this is to painstakingly make sure that your data
structures stay “covariant”. If I remove the `type` field from my
widgets, the problem goes away.

But there are a lot of situations where that is really inconvenient,
or even impossible. For those, the only workable situation I've found
is to create a “projected” type, a subtype of `Widget<unknown>` with
the contravariant pieces removed. TypeScript's type-manipulating
operators fortunately make this relatively easy.

```
type AnyWidget = Omit<Widget<unknown>, "type">
```

You can think of this as the thing we were trying to express with
`Widget<unknown>` in the first place—a generic subtype of widget where
we don't know what's in it. A list of widgets would now use
`AnyWidget[]`, to which the type system will allow us to add more
specific widget types.

Of course, when it is time to actually render such a widget, you'll
need to cast it back to `Widget<unknown>` or do other type-casting
acrobatics. But in my experience the code that needs to do this is
usually relatively well-isolated.
