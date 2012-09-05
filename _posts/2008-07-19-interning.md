---
layout: post
title: Interning symbols
tags:
- common lisp
---

Mike Ajemian wrote [something][mike] about dynamically interning
symbols using the `~:@` format construct to upcase parts of the
symbol's name. This works fine on standard CLs, but if you want to
write something that also works with Allegro's 'modern' mode (where
symbols are case-sensitive), you don't want to upcase the symbol. What
you do there is use the reader against itself — `(format nil "~a-~a" :insert name-symbol)`,
the `symbol-name` of `:insert` will be whatever
the reader made of it, and thus you'll get a symbol that follows the
same conventions as the surrounding system.

[mike]: http://blackgrit.blogspot.com/2008/07/interning-function-name-in-defmacro.html

(You also don't want to use uppercase strings in your package
definitions — I'm looking at you `split-sequence` — use `#:symbol`
syntax if you don't want to waste memory on pointless keyword
symbols.)

In a similar vein, sometimes you'll want to create throwaway symbols
with a certain name at run-time. (For example, [S-SQL][s-sql] requires
symbols for stuff like database index names, which you might want to
generate.) `intern` leaks memory in this case, since anything interned
stays around until it is uninterned. `gensym` tends to add junk to the
symbol's name. Some messing around with apropos (more languages need
an apropos feature) led me to the predictably named
[`make-symbol`][makesym], which, like `#:` syntax, creates an
uninterned symbol with a specific name.

[s-sql]: http://common-lisp.net/project/postmodern/s-sql.html
[makesym]: http://www.lisp.org/HyperSpec/Body/fun_make-symbol.html
