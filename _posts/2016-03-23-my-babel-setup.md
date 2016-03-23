---
layout: post
title: My JavaScript Build Setup
tags:
- javascript
- tooling
---

I am looking forward to the time where my
[node.js](https://nodejs.org/) and browser can natively run ECMAScript
6 code. Build steps are a pain, and one of the reasons I like
JavaScript in the first place is the (traditional) absence of “waiting
for the compiler” from my work-flow.

You can question whether ECMAScript 6 is worth incurring the
inconvenience of a build step. I think it is. The various syntactic
niceties provided by that dialect, mostly arrow functions and class
syntax, make my code feel cleaner.

And even without ECMAScript 6, to run modularly-written things in a
browser we'd still traditionally require a bundling step.

Let's do away with that first.

## Unbundled code in the browser

Bundling tends to be the thing at the very end of the pipeline. You
have a “root” script, and your bundler follows all its dependencies,
dumps them into a single big file, with some magic glue that makes the
right module pop up in the right place. You then refer to this bundle
from a `<script>` tag.

One thing about bundling is that it is monolithic. It requires the
whole bundle file to be rewritten every time one of your modules
changes. This can be slow.

For development, do we need a bundler? If we're using AMD-style
modules, we don't. But I don't like the cruft created by AMD-style
modules and very little NPM modules are written in that style. If we
have a directory of CommonJS-style modules, possibly using some
NPM-installed dependencies, what would it take to run those directly
in the browser?

 * A client implementation of CommonJS modules (`require`, `exports`,
   etc)

 * A way to “resolve” dependencies (going from `"foo"` to
   `"../node_modules/foo/src/index.js"`, etc).

 * Fast access to the modules and some really good caching, since each
   page load is going to load dozens to hundreds of files.

Enter [moduleserve](https://github.com/marijnh/moduleserve), a small
web server shim that does the node-style module resolution, serves up
a client-side CommonJS implementation, and does a good job caching
modules (and helping the browser cache them).

You say `moduleserve mydir`, and it'll serve up the content of the
`mydir` directory on `localhost:8080`. You can have an HTML file in
that that includes...

    <script src="/moduleserve/load.js" data-module="./root"></script>

... and it will load up moduleserve's CommonJS implementation, and run
the equivalent of `require("./root")` in it.

The implementation uses _synchronous_ HTTP requests to fetch modules.

[stunned silence]

Browsers will show a warning in the console, but it's okay, as long as
you're testing from the same machine. I can reload ProseMirror's test
suite (150 modules) in 800 milliseconds (when they are cached).

So now, for a project that doesn't need any further compilation steps,
we have a completely compilation-less way to try it out and run its
tests during development. And it's not even slow.

You can set up moduleserve to compile your sources using Babel (and
cache the compiled results), but there's a better way.

## The amazing compiling file system

I find that I don't just need my compiled source files in one context.
I need them to run my tests in the browser, to run them in node, as
input for my bundler when building for production, as dependency code
for other modules that I'm developing in sync, and so on.

And I don't want to set up a different compilation pipeline for each
of these uses. That's a lot of duplicate work, both from me to set it
up, and from the computer that is compiling everything ten times.

So I can set up a canonical `dist/` directory where the compiled files
go, and have [Babel](http://babeljs.io/), or whichever compiler, watch
my source files and constantly recompile when they change. That works
relatively well, but annoyed me for two reasons:

 * I'd often read the files before the recompilation finished, leading
   to me getting very confused because I was drawing conclusions from
   the behavior of outdated files.

 * I'm often working on my laptop on battery power, and, since I am
   constantly saving files as I work on them, the amount of CPU and
   disk traffic caused by the constant needless recompilation bothered
   me.

So I wrote [distfs](https://github.com/marijnh/distfs), another small
helper module. This one “mounts” a source directory, using a
[userspace file system](https://en.wikipedia.org/wiki/Filesystem_in_Userspace)
to expose it as a normal-looking compilation output directory. Every
time you try to read a file from that directory, the actual source is
compiled, and you get the compiled output. This is cached, of course.

The advantage is that this is pull-based. Files are only compiled as
needed, and when you access a file that isn't ready yet, your read
blocks until it is, so that you're always sure you have the up-to-date
content.

Putting those two together, I'm a much happier ECMAScript 6 developer
than I was before.

## Example

Let's make a project. A simple one, consisting of two ECMAScript 6
files, an HTML file, and a single dependency. It'll show a simple form
into which you can type JavaScript code, after which it will tell you
whether that code is valid.

    mkdir project
    cd project
    mkdir src dist www
    # development tools
    npm install babel-core babel-preset-es2015 moduleserve distfs
    # actual dependency, a JavaScript parser
    npm install acorn
    # configure Babel
    echo '{"presets": ["es2015"]}' > .babelrc

The `www/` dir will be the one we mount with moduleserve. We put an
`index.html` file like this in it:

```xml
<!doctype html>
<form>
  <textarea name=code>1 + 1</textarea>
  <button type=submit>Check</button>
</form>
<pre id=output></pre>
<script src="/moduleserve/load.js" data-module="../dist/main"></script>
```

We'll put the scripts in `src/`. This is `src/main.js`:

```javascript
import {checkCode} from "./check-code"

document.querySelector("form").addEventListener("submit", e => {
  e.preventDefault()
  document.querySelector("#output").innerHTML =
    checkCode(e.target.elements.code.value)
})
```

And this is its dependency, `check-code.js`, which in turn uses our
installed `acorn` module:

```javascript
import {parse} from "acorn"

export function checkCode(code) {
  try { parse(code); return "OK" }
  catch (e) { return e.toString() }
}
```

Now, let's fire up out helper processes.

    node_modules/.bin/distfs src dist &
    node_modules/.bin/moduleserve www --port 8090 &

At this point, [`localhost:8090`](http://localhost:8090/) shows our
test page. When you edit one of the scripts and reload, you get the
updated (compiled) code. When something crashes, you get a
source-mapped stack trace pointing at the correct line numbers in the
actual files.
