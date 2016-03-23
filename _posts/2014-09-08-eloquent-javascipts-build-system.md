---
layout: post
title: "Eloquent JavaScript's Build System"
tags:
- javascript
- books
- tooling
---

A text is not just a string of Unicode. It has structure, and a
certain internal coherence. People might want to read it in different
formats, and if I am going to hand-edit it, I want its source to be in
an editing-friendly format.

For the [first edition](http://eloquentjavascript.net/1st_edition) of
my book (Eloquent JavaScript), I wrote my own markup format style and
a [Haskell program](https://github.com/marijnh/Eloquent-JavaScript-1st-edition/blob/master/renderer/Main.hs) to parse it. That was, of course, a big
waste of time and made it needlessly hard for people to contribute to
the book or translate it.

When writing the [second edition](http://eloquentjavascript.net), I
used [AsciiDoc](http://www.methods.co.nz/asciidoc/) as a source
format, since I had had good experiences with that before. This worked
reasonably well, though I'll discuss some problems I had with it
later.

The nice thing about being both a programmer and an author is that you
can build custom tooling for the text you are working on. While
rewriting Eloquent JavaScript, I built up a big suite of tools and
scripts to build, check, and customize the book. This blog posts
describes those tools. They are probably of no direct use to anyone
else, but they might inspire similar tools, and make for an amusing
technical story. The source and build tools for the second edition can
all be found in the book's
[github repository](https://github.com/marijnh/Eloquent-JavaScript).

## Coding during reading

The version of the book on the
[website](http://eloquentjavascript.net) is interactive. It allows the
reader to edit and run the example code, and to solve the exercises
inline.

To support this, I include [CodeMirror](http://codemirror.net) (which
was originally written for this very purpose, to use in the first
edition of the book) and use it to turn code snippets into editors
when clicked. When the code is executed, this is done in a hidden
`iframe` element, which has its `console.log` wired up to output its
arguments below the editor, rather than writing them to the normal
JavaScript console. When running HTML examples, the `iframe` is not
hidden, but instead also shown below the editor.

An interesting dilemma is the question of what happens when the reader
inputs a program that creates an infinite loop. Back when the first
edition was being written, browsers still aborted scripts that ran for
too long. But that has gone out of style, and modern browsers tend to
just crash the tab instead. This is not a very good user experience.

So I stole Remy Sharp's approach from [jsbin](http://jsbin.com), which is
to mangle the code that the user enters, inserting time checks at the
end of loop bodies so that scripts that jump to a previous point in
the program can be terminated when they run for too long. To do this
properly, I run the code through
[Acorn](http://marijnhaverbeke.nl/acorn) to parse it, and patch up the
relevant points using information from the parse tree. The actual code
inserted increments a global variable, and only calls into the more
expensive time-checking function when that variable modulo 1000 yields
zero. When the time is exceeded and the user confirms the termination
of the script through a `confirm` dialog, an exception is raised.

It is still possible to create an infinite loop with creative use of
`continue` or by catching and ignoring the exception, but for typical,
accidental infinite loops, this approach works well.

In the first edition, the reader was required to run all code snippets
they came across, or they would run into errors about undefined
variables when trying to run code that depended on earlier
definitions. This was very confusing and needlessly complicated. The
build scripts for the second edition allow snippets of code to be
marked as part of the base code for a chapter, and will extract such
code into files that are automatically loaded when running code in the
interactive environment.

## Conditional compilation

My scripts can currently build this interactive HTML version, an ePub
book (zipped XHTML), and two flavors of LaTeX: one in the style of my
[publisher](http://nostarch.com/), and one to build the free PDF file.

Using the same sources for both an interactive website and a static
book is somewhat challenging. In the interactive version, the reader
is encouraged to see the output of a program by running it. This is
not possible on paper or in an ebook, so there the text has to be
slightly different, and screenshots or output dumps have to
occasionally be included.

This was solved by defining some AsciiDoc macros to only include
pieces of text in a given type of target. This makes the sources a bit
more clunky, like `ifdef` in C does, but differences were rare enough
to keep this manageable.

Complicated formula can not be sanely described in pure AsciiDoc, so I
occasionally had to include some raw LaTeX or HTML in the sources. This
was done with another set of macros, and does mean that if I want to
add another target format, I will have to add code specifically for
that format as well.

The publisher insisted on some conventions that I don't personally
find helpful, such as classical-style quotes, where punctuation after
a quoted piece of text is moved into the quotes, and title case in
section headings. I wrote the sources using my preferred style, and
have a post-processing [node](http://nodejs.org) script that
transforms them to the other style when building the LaTeX files for
the paper book.

## Make

All the invocations of `asciidoc`, `xelatex`, `inkscape`, and the
variety of node scripts that make up the build system are orchestrated
by a makefile.

I bear no great love for `make`, since at a certain level of
complexity makefiles tend to become utterly unreadable spaghetti, but
for a small project like this they work wonderfully, allowing me to
specify the dependencies between the files in a succinct and precise
way, and being able to rebuild only what had to be rebuilt when I
change something.

The website and the ebook files distributed from there are kept up to
date by a `post-update` [git](http://git-scm.com/) hook that runs `make html
book.pdf book.epub` whenever I push something new to the repository.

## Testing

When a piece of code sits in a non-runnable text file, and is being
occasionally edited to evolve with the surrounding text, it is
_guaranteed_ to get damaged at some point. You'll introduce a syntax
error, or refer to a variable that you renamed in the meantime.
Several embarrassing bugs snuck into the code in the paper version of
the first edition this way.

To prevent that from happening this time around, there is a script
that extracts code snippets from the book, assembles them into a whole
program, and tries to run them. Throughout the book, I use the
convention of including the output that `console.log` produces in
comments that start with `// →`. When such comments are present, the
test runner also verifies that the output produced is the expected
output.

Some code, such as the skeleton code into which people are to write
their exercise solutions, or code that intentionally illustrates a
mistake, does not run as-is. The test runner recognizes comments (in
the AsciiDoc sources, not the code snippets themselves) like `// test:
no` to disable testing of the next snippet, or `// test: wrap` to run
it in its own scope (to prevent leakage of variables or strict
declarations).

To be able to test browser code, I am using the
[`jsdom`](https://github.com/tmpvar/jsdom) npm package. It is rather
slow, and not very robust, but it does enough to allow the simple code
in the book to run.

I also wrote a simple link checker that verifies that the targets of
internal links that occur in the text actually exist, and are only
defined once.

## Taming LaTeX

AsciiDoc has no maintained LaTeX backend. It does come with such a
backend, but that is a half-working mess.

I can see why this is. LaTeX is not a nice target language. It
requires all kinds of things to be escaped. But only in some contexts.
In other contexts, escaping them will break things. Or they have to be
escaped differently. It might be that AsciiDoc's configuration is
powerful enough to do this, but neither the person who started the
LaTeX backend, nor me, could figure out how.

Thanks to the fact that I only use a rather narrow subset of AsciiDoc,
I could get passable output after a few days of tweaking my
configuration file. Some problems I was unable to solve in a sane way,
so I set up a post-AsciiDoc filter in the form of a node script that
fixes these. Horrible kludges all around, but it works for my purpose.

This project thoroughly burned me out on LaTeX in general. The output
looks great, way beyond what HTML is capable of, but you are pretty
much condemned to learn its obscure, primitive language and write
really ugly code in it if you want to customize anything for which a
package does not already exist. On top of that, a LaTeX source file is
everything but declarative—you are expected to mix all kinds of ad-hoc
layout code into your content. CSS is not perfect, but it sure is more
pleasant than this.

I had my pre-processing script convert internal links from
`00_foo.html#anchor` format to simply `anchor`, and ensured that all
anchors were unique in the book. This way, internal links work
seamlessly across the various document formats.

## Managing images

I am making heavy use of SVG pictures in this book. For some silly
reason (probably because it is a hundred years old and no serious
update has happened in ages) LaTeX, which compiles to vector graphics,
can not use SVG vector graphics. So I had to convert those to PDF
files, and patch the LaTeX output to refer to the PDF rather than the
SVG files.

Additionally, there are still browsers that don't render SVG, so PNG
fallback pictures were also needed.

I tried to use [ImageMagick](http://www.imagemagick.org/)'s `convert`
command to do the file conversions, but that makes a terrible soup of
SVG files. Fortunately, [Inkscape](http://www.inkscape.org/en/), the
open-source SVG editor, can be invoked from the command line to
directly convert images. I integrated that into my build process
instead.

To fall back to PNG in the HTML files, I used a simple script that
detects SVG `<img>` support, and if it isn't present, simply updates
the `src` property of the image tags to point at the PNG files
instead.

## AsciiDoc, again

AsciiDoc has a lot going for it—it is pleasant to read and write (as
opposed to XML), powerful enough to express serious documents (as
opposed to Markdown), and easy to extend (as opposed to almost
everything else).

But, like all “clever” text formats, it suffers from bad corner cases.
Parsing is largely done with regular expressions (which makes it very
easy to add syntax), but occasionally those go wrong, as regular
expressions tend to. True to the system's name, most of its regular
expressions are written as if everything is ASCII. Using markup
characters next to Unicode punctuation (emdash or quotes) often
confuses the parser. And there were moments where syntax inexplicably
stopped working when spread out over multiple lines.

A bigger problem is the poor documentation of the configuration
format. It is a rather simple format, and looking at the examples that
come with the distribution (the various backends are basically just
configuration files) got me quite far. But when I needed to do
something complicated, usually when trying to generate LaTeX, I kept
running into weird behavior in its templating language, which
collapses white space in strange ways, and for whose syntax I could
find absolutely zero documentation.

The worst issue, though, was that I ran into bugs where some macros
would corrupt some internal data structure, and pieces of text would
end up being replaced by senseless binary soup.

For a next project, I will probably first see if
[AsciiDoctor](http://asciidoctor.org/) fits the bill. This is a
rewrite of AsciiDoc designed to be faster, easier to extend, and less
weird. But there too I could find little docs on the configuration
process, and by the time I was frustrated enough with AsciiDoc to
consider switching, I had already dug myself into a rather deep hole
by depending on AsciiDoc-specific features.
