---
layout: post
title: Being a Resident at the Recurse Center
tags:
- community
- education
---

I spent one week being a resident at the Recurse Center in New York
this November. The Recurse Center is a somewhat unusual institution.
They call themselves a “programmers retreat”. That more or less means
they are a space where people who want to improve their programming
skills (whether beginners or experienced programmers) hang around for
a few months, doing self-directed learning, collaborating with each
other, and getting inspired by the work, talks, and discussion of the
people around them.

If that still doesn't make a lot of sense, see their
[website](https://www.recurse.com/) or read Martin Kleppmann's
[excellent description](https://martin.kleppmann.com/2015/10/11/recurse-center-joy-of-learning.html).

Being a _resident_ there meant that I was simply present in the space
for a week, gave a talk, and worked with people on their projects.
Working with experienced programmers is a way to diffuse some of the
knowledge of those programmers, as well as a good way to make people
realize that those who are considered good programmers still have to
constantly google for stuff and make stupid mistakes.

## People

The environment you'll find in the Recurse Center office is an
atypical one, for the tech world.

 * People are working on whatever interests them, not necessarily on
   useful stuff. Which means mostly fun projects that are easy to
   relate to.

 * The group is amazingly diverse, in a number of ways (more on this
   below).

 * There are
   [social rules](https://www.recurse.com/manual#sub-sec-social-rules)
   in place to actively combat alpha-techy behavior and competitive
   bullshit. Not having to worry about proving how great you are makes
   it a lot easier to learn.

 * Events like “check-ins” (a group of people telling each other what
   they are working on) and lightning talks make it easy to find out
   what other people are working on, and facilitate the flow of
   information between people.

The result I can only describe as _magic_. People are getting things
done, profiting from each other's expertise, doing stuff they never
did before, and being immersed in (mostly the good parts of) tech
culture.

## Projects

In my week, I pair-programmed with about ten different people. Some of
these sessions didn't really go anywhere, but a lot of them did. These
are some of the things we did:

 * Tweaked the structure of a functional-style space invaders game to
   be cleaner and more actually functional. Major insight: moving
   triggers for sound effects from deep inside the game logic to a
   separate piece of code that compared the state before and after the
   frame, and played the appropriate sounds based on that.

 * Worked on a small Lisp interpreter in Python. Moved it from a
   [Norvig-style](http://norvig.com/lispy.html) `split`-on-spaces
   parser to a more classical tokenizer and parser.

 * Laid the groundworks for a tower defense game in JavaScript,
   experimenting with [Electron](http://electron.atom.io/) and
   explaining the basics of [npm](http://npmjs.org) in the process.

 * Worked on another small Lisp interpreter in C++. Implemented a
   pointer-tagging data representation, a parser, pretty-printer, and
   rudimentary evaluator. (I hadn't touched C++ in years, and it took
   us a bunch of segfaults to get a reverse iterator right.)

 * Wrote a simple virtual machine (the
   [“little man computer”](https://en.wikipedia.org/wiki/Little_man_computer))
   first in Haskell and then in Python. Both ran example programs by
   the time we were done with them. The Haskell version included an
   assembler that went from textual programs to machine instructions.
   Reminded me how amazing Haskell programming can be.

 * Had a study/discussion group on the
   [Raft consensus algorithm](https://raft.github.io/). Which was a
   good reason to actually read the paper. I came away with a better
   understanding of distributed consensus, and I hope others also
   picked something up.

 * Wasted an afternoon attacking a particularly horrid bug in the
   interaction between a particular [node](https://nodejs.org/)
   version and the [Nock](https://github.com/pgte/nock) library. It
   was caused by irresponsible
   [monkeypatching](https://en.wikipedia.org/wiki/Monkey_patch) on the
   part of Nock. This was probably the session that most resembled
   normal programming—lots of debugging, not much progress.

 * Looked at an [implementation](https://github.com/leahsteinberg/co)
   of the [WOOT](https://www.youtube.com/watch?v=NSTZ4mIv_wk)
   algorithm for collaborative text editing on top of CodeMirror. Most
   of the session was spent getting me to understand how WOOT works,
   but we did make some progress.

So that's definitely more cool programming stuff than I get to do in
an average week.

## Diversity

I mentioned that the crowd at Recurse Center is amazingly diverse.
This is part of the center's
[focus](https://www.recurse.com/diversity), and they are doing a great
job on it. The participants there, as well as the organizers, are more
representative of society as a whole than any other tech group I've
been around.

And that diversity works. It, along with the healthy social framing
provided by the organization, creates a social atmosphere very
different from your typical young-white-guy tech environment. There
was no emotional vacuum. I didn't have to cringe at terrible or
insensitive jokes. People weren't one-upping each other. There was no
assumption of cultural homogeneity.

I do understand that diversity alone doesn't necessarily produce such
an effect. I've worked in offices that were diverse by the numbers,
but where the culture was still poison. You also need a healthy dose
of political awareness. And you need to make sure power isn't
concentrated in a specific group. And so on. Healthy culture is hard
work. Thank you, Recurse Center organizers, for doing this work.
