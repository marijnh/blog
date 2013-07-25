---
layout: post
title: On null and undefined in JavaScript
tags:
- javascript
---

This is a brief post to explain why my JavaScript code is full of `==
null` comparison expressions, even though linter software tends to
disapprove.

JavaScript defines both `undefined` and `null` as separate values. The
first comes up in many constructs in the core language—an
uninitialized variable, a parameter that wasn't passed, a missing
field in an object, or a call to a function that doesn't return
anything all have the value `undefined`. The `null` value has the ring
of a C null-pointer, and tends to be common in library interfaces—a
child-less DOM node has a `firstChild` property of `null`,
`getElementById` with a non-existent ID gives you `null`, and so on.

I have found the distinction between `null` and `undefined` to be
mostly useless—a cognitive burden without merit.

The interesting distinction is usually between 'non-values' and actual
values.

The `== null` (or `!= null`, as it may fit) pattern is...

 * Shorter than `== undefined`.
 * Much shorter than `typeof X == "undefined"`.
 * True for both `undefined` and `null` values, saving external code
   the bother of worrying what they are passing in.
 * Only slightly slower than `=== null`.
 * Faster and clearer than `_.isNull` and similar helper functions,
   which I unexplicably see pop up in many projects.

So I've made it policy in my code, whenever possible (which is pretty
much always) to treat `null` and `undefined` interchangeably when
accepting them as input. This saves both myself and the users of my
libraries one more thing to worry about.

(For output, I tend to stick to `null`, so as to not force my sins on
the poor souls who have to code under the tyrannical eye of JSLint.)
