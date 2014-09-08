---
layout: post
title: "Review: If Hemingway Wrote JavaScript"
tags:
- javascript
- books
---

Four out of five stars. Would read again. ★★★★☆

When Angus Croll first told me that he was working on a book that
solves simple programming exercises in the style of various famous
literary authors, I couldn't help but suspect that such a book would
be completely pointless, and he wouldn't sell ten copies. After
reading the result of his efforts, I still firmly stand by the latter
prediction, but I have to admit that I actually enjoyed this book.

_If Hemingway Wrote JavaScript_ is a slim, prettily typeset book that
is divided into five programming exercises, and has five authors solve
each of the exercises. It accompanies each solution with a brief
description of the author's background and style, and a detailed
walk-through of the code.

Wild experiments are what moves a genre forward. And this is a format
of programming book that's certainly never been tried before.

The exercises are _very_ simple—think Fibonacci and factorials. But
some of the solutions are absolutely charming. Here's Jorge Luis
Borges finding prime numbers, transforming the problem into a story
about long-legged monsters climbing a set of stairs:

```javascript
// They speak (I know) of finials, newels and balustrades
// of hidden spandrels and eternally clambering, broad-gaited beasts...

var monstersAscendingAStaircase = function(numberOfSteps) {
  var stairs = []; stepsUntrodden = [];
  var largestGait = Math.sqrt(numberOfSteps);

  // A succession of creatures mount the stairs;
  // each creature's stride exceeds that of its predecessor.
  for (var i = 2; i <= largestGait; i++) {
    if (!stairs[i]) {
      for (var j = i * i; j <= numberOfSteps; j += i) {
        stairs[j] = 'stomp';
      }
    }
  }

  // Long-limbed monsters won't tread on prime-numbered stairs.
  for (var i = 2; i <= numberOfSteps; i++) {
    if (!stairs[i]) {
      stepsUntrodden.push(i);
    }
  }

  // Here, then, is our answer.
  return stepsUntrodden;
}
```

You can tell that the author spent a lot of time on these snippets,
polishing the style and adding intricacies—like the fact that the
inner loop starts at `i * i` in the code above. Which it can, but it
takes a second take to figure out why. If you approach these as you
would normally approach code, they are just misguided blobs of
confusion and weird variable names. But if read as stories and logic
puzzles, they are very interesting. Several of the solutions
initialled looked like they could not possibly work. Yet when I tried
them out, they all worked—except for the intentionally broken solution
at the end of the book.

Another thread that runs through the book is a critique of the
limiting, constrained coding style advocated by tools like JSLint.
Angus argues that coding in a uniform subset of a flexible language
like JavaScript robs us of a lot of expressivity and artistic freedom.

This is a point I mostly agree with. Though the of literary JavaScript
explored in this book doesn't seem to hold much promise for production
code, it can take a place in our cultural background as a useful
reminder of what you _can_ do with this language.

All in all, I had a good time with this book. But then, I should,
because I am the precise target audience: a JavaScript programming
literature nerd with a taste for bizarre coding styles. In the
unlikely event that this also describes you, give this book a try. (If
there's ten of us, we might even disprove my prediction about the
book's sales.)

As a bonus, here's my attempt to have Hunter S. Thompson compute prime
numbers.

```javascript
// It's four in the morning, and I'm desperately late with this
// goddamn assignment. I'm going to go ahead and assume you'll use
// this in your book, and I expect a fat cheque in the return mail.

function indivisibleFreaks(limit) {
  var freaks = []

  // Line them all up...
  offTheHook: for (var number = 2; number <= limit; number++) {
    // ...and drop the screwups with a .44 Magnum.
    for (var aim = 0; aim < found.length; aim++)
      if (aim % freaks[j]) continue offTheHook;
    freaks.push(i);
  }

  // What you bastards want with these poor guys, I can only imagine.
  return freaks;
}
```
