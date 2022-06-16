---
layout: post
title: JavaScript closure vs. object look-up performance
tags:
- javascript
- performance
- codemirror5
---

**Note:** the question asked in this post, "why aren't closures
super-fast?", was thorougly answered by Vyacheslav Egorov in
[his followup][aleph]. Reading that is probably more informative than
reading the text below.

[aleph]: http://mrale.ph/blog/2012/09/23/grokking-v8-closures-for-fun.html

I originally structured [CodeMirror][cm] instances as one huge closure
that contained all the internal variables. The constructor would
create local variables for all internal state, and local functions for
everything that needed access to that state, and then return an object
that contained the API methods, which themselves also closed over all
those internals. Something like this:

[cm]: http://codemirror.net

```javascript
function CodeMirror(args) {
  // Internal state
  var doc = something, selection = somethingElse;
  // Internal functions
  function modifyDoc(from, to, newText) {
    /* directly access doc, selection, etc */
  }
  function drawDoc() { /* ... */ }
  
  return {
    getLine: function(n) { return getLineFrom(doc, n); },
    refresh: drawDoc
    /* etc */
  };
}
```

I had several reasons for doing it like this. Firstly, it minifies
well—local variables are very easy and non-invasive to rename, so if
most of your fields and functions are regular variables rather than
object fields, simple minification works very well. There are tools
like Google's [Closure compiler][cc] in 'advanced' mode, which do try
to rename properties, but those are harder to use (they need to be
told which properties they may rename, and which are exported or come
from external component, such as `.style.display` on a DOM node).

[cc]: http://closure-compiler.appspot.com/home

Secondly, it makes for uncluttered code—I can write `foo` instead of
`this.foo` or `this.view.doc.foo`. That really does make a big
difference in the overall succinctness of the code.

Thirdly, and lastly, I *believed* that this would be faster. I
reasoned thusly: a lexical variable in a closure is in static,
known-at-compile-time place. The closure data is allocated as a
structure with a known layout, and the closing function will have a
pointer to that structure in a known place. Thus, a reference to a
closed-over variable involves:

 * Fetching a pointer from the current function
 * Fetching a field at a known offset from that pointer's destination
 
That sounds like two, three instructions at most, plus maybe two more
to get at the current function's data. In case it's a nested closure,
where the current function closes over an environment that in turn
closed over the variable we're getting at, that'd add another hop, but
still, nothing more than a simple following of pointers is involved.

Compare that to accessing an object field. This has been the target of
much optimization work, since it used to be one of JavaScript's main
bottlenecks, but it still requires a baseline amount of work. Assuming
the JavaScript engine implements [polymorphic inline caching][pic], which
all relevant ones do at this point, you'll still have to:

[pic]: http://blog.cdleary.com/2010/09/picing-on-javascript-for-fun-and-profit/

 * Get the pointer to the cache from the instruction stream
 * Fetch the shape or hidden class from the object pointer
 * Fetch the cached shape from the cache
 * Compare the two and do a conditional jump
 * (Assuming a hit) get the field offset from the cache
 * Use this field to dereference the object pointer and get the property value

In my mind, this might come close to the speed of accessing a
closed-over variable, but would definitely not surpass it.

**However**, benchmarks, both [micro][jsperf] and a more elaborate one
that I'll discuss in a moment, do show that on modern engines, object
access is in fact *faster* than closure access.

[jsperf]: http://jsperf.com/access-object-properties-via-closure-vs-this/2

I don't have an explanation for this. I'd be happy if someone can
enlighten me on the subject. My current assumption is that the people
working on these engines were just so busy optimizing object access
and [Sunspider][spider] performance that, unlike the compiler
implementers in most other functional-language communities, closures
just haven't been that well-optimized.

[spider]: http://www.webkit.org/perf/sunspider/sunspider.html

I spent the past few days on an experiment. I rewrote CodeMirror's
core to use a set of objects rather than a single big closure for its
central state. I have a version that passes the test suite now
(though, since this change involved touching pretty much every single
one of the almost 2000 lines that lived in that monster closure,
there's probably some breakage that I haven't caught).

The reasons for this mostly had to do with modularity and code
clarity. Closures are, in a way, too convenient. I can just define a
new variable to hold some state, access it from everywhere, and it'll
work. This is *good*, in most respects, when the system modelled by the
closure is small (to medium) in size. But CodeMirror had long ago
crossed the threshold where the proliferation of stateful local
variables became hard to see through. Grouping them into a set of
objects with well defined roles and lifetimes definitely made the data
model easier to understand and reason about. It also, by lifting all
internal functions out of the closure, forces me to specify the inputs
that the functions act on in their argument lists.

The overhauled implementation did become noisier, obviously. Field
access had to be prefixed by object names all over the place, and it
is often necessary to create locals like `var doc = cm.view.doc;` to
prevent typing out the chain of property accesses twenty times in a
function.

These are the file size numbers, in bytes, using [UglifyJS][ujs] for
minification:

[ujs]: https://github.com/mishoo/UglifyJS

                Full   Minified  Min+gzip
    Closure   150453      65381     22733
    Objects   154752      74655     24448

So the raw file became **2.7%** bigger, the minified file **12.4%**
(!), and the gzipped file **7.0%**. Zipping absorbs some of the extra
size of the minified version, because the repeated property names are
exactly the kind of thing that compression is supposed to handle well,
but there still remains a significant bloat of the file size.

My conclusion: closures really do help with minification, but not to a
huge enough extent to justify sticking to it for the CodeMirror
project.

Finally, performance. I only did some ad-hoc benchmarks on Chrome 21
and Firefox 15, comparing the old closure-based CodeMirror codebase to
the equivalent, object-using one. But those showed, on both browsers,
a consistent speedup in the **2% to 3% range**. Thus, my intuition
about closure access being fast was once again debunked.
