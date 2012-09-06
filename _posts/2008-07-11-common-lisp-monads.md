---
layout: post
title: Why monads have not taken the Common Lisp world by storm
tags:
- common lisp
---

Today I was trying write a parser for a reasonably complicated
language. Since I do not tend to learn from other people's work or
even from my own past mistakes, and tend to greatly underestimate
the complexity of tasks (or overestimate my own skills) this went
something like this:

* Try to quickly write the whole thing as a single recursive
  descent parser. Note the exploding amount of ugliness. Give
  up.
* Separate out the tokenizer (novel idea, huh?) to keep parser
  complexity down. Parser is still a mess. Ugh!
* Play around with some CL parser frameworks. This helps a
  bit, but none of the systems I tried produce errors with enough
  information.
* Remember the breeze it was to write a parser with the
  Haskell Parsec library. Mess around with monads for a while,
  learn a few things, but not how to write elegant parsers in
  Common Lisp.

So, as it stands, I have wasted a few hours, and am still
without an acceptable parser. But I **do** have a
subject for an article, which is at least something.

You are bound to have heard of monads. They are the wonderful
abstraction that allows Haskell to be a pure functional language
without being completely unusable. They have also successfully
been applied to do some other things (things not directly related
to the challenges of purity) in nicer or more general ways
— continuation-passing, exception handling, list
comprehension, and of course, parsing.

Given how wonderful monads are, why aren't other language
suffering from major monad envy? I have seen a few modest efforts
to apply them in Python, Ruby, F#, and C#, and I'm sure there are
things happening that I'm not aware of, but nothing world-shaking,
it seems. One reason is of course that monads are horribly
confusing, and their use is not immediately obvious. The fact that
closures, for example, are only now becoming mainstream suggests
that awesome features whose use is not immediately obvious are
slow to be adapted. But another reason seems to be that
Haskell-style mean lean monad use only really works in languages
that:

1. Support ML-style function-fu (trivial currying, single
   namespace).
1. Have type classes.
1. Allow polymorphism on return types.

I'll go into these in a moment. But the point is that in the
set of languages that I am familiar with, there's only one that
satisfies these conditions... Haskell.

So what would monads look like in CL. Well, if we want to
define polymorphic monadic operations, bind should probably be a
generic function. I'll use Haskell's operators for the names:

    (defgeneric >>= (m f))
    (defgeneric >> (m1 m2)
      (:method (m1 m2)
    (>>= m1 (lambda (x) (declare (ignore x)) m2))))

Awesome! But what about return? I merrily started typing
`(defgeneric mreturn (val))`... oh hold on. There's
nothing to dispatch on: In Haskell, the kind of return we need is
determined by the type deduction system — use
`return` where an IO monad is expected, and you get the
IO return, etc. In CL, this does not work. (Though several ugly
workarounds come to mind.) Oh well, I'll just give the different
returns different names. Anyway, here's a neat implementation of
Haskell's `do`:

    (defmacro seq (&rest ops)
      (labels ((transform (ops)
             (cond ((and (consp (car ops)) (eq (caar ops) '<-))
                    `(>>= ,(caddar ops) (lambda (,(cadar ops))
                                          ,(transform (cdr ops)))))
                   ((null ops) (error "Empty seq."))
                   ((null (cdr ops)) (car ops))
                   (t `(>> ,(car ops) ,(transform (cdr ops)))))))
    (transform ops)))
    
    (macroexpand-1 '(seq (<- x monadic-read)
                     (monadic-write "You said: ")
                     (monadic-write x)))
    
    ;; => (>>= monadic-read (lambda (x)
    ;;                        (>> (monadic-write "You said: ")
    ;;                            (monadic-write x))))

This restored my enthousiasm a little — I could emulate
`do`-notation, and it wasn't even complicated!

An easy, rather trivial example would be the maybe monad, which
skips further computation as soon as any computation returns
`nil`:

    (defstruct maybe val)
    (defun maybe (val)
      (make-maybe :val val))
    (defmethod >>= ((m maybe) f)
      (if (maybe-val m)
      (funcall f (maybe-val m))
      m))
    (defun liftmaybe (f)
      (lambda (m) (maybe (funcall f m))))
    
    ;; Parse a string as a number, divide it cleanly by 10, and add 1 to
    ;; the resulting number. Return nil if any of this fails.
    (defun string/10+1 (str)
      (maybe-val
       (seq (<- num (maybe (parse-integer str :junk-allowed t)))
        (<- tenth (multiple-value-bind (quot rem) (floor num 10)
                    (maybe (and (zerop rem) quot))))
        (funcall (liftmaybe '1+) tenth))))

That's a little too blatantly useless to be interesting though.
But note how ugly CL's multiple namespaces make
`liftmaybe` and its uses.

A more interesting (though, in the presence of mutability and
special variables, also rather pointless) example is the state
monad. This one passes around a state value 'in the background'.
State monad values respresent computations from a state to a
(state, value) pair. This one used to confuse me hugely because I
though a state monad value contained a state. It does
*not*. I wrap these functions in a struct to be able to
dispatch the bind function on them.

    (defstruct state-m compute)
    (defun state-m (compute)
      (make-state-m :compute compute))
    
    (defun run-state (state state-m)
      (funcall (state-m-compute state-m) state))
    (defun return-state (val)
      (state-m (lambda (state) (values state val))))
    
    (defmethod >>= ((a state-m) f)
      (state-m (lambda (state)
         (multiple-value-bind (state2 val) (funcall (state-m-compute a) state)
           (funcall (state-m-compute (funcall f val)) state2)))))
    
    (defparameter get-state
      (state-m (lambda (state) (values state state))))
    (defun set-state (state)
      (state-m (lambda (old-state) (declare (ignore old-state)) (values state nil))))

These, then, can be used to implement a function that maps over
a tree and counts the elements at the same time:

    (defun map-count (tree f)
      (labels ((iter (val)
             (cond ((consp val)
                    (seq (<- car (iter (car val)))
                         (<- cdr (iter (cdr val)))
                         (return-state (cons car cdr))))
                   ((null val)
                    (return-state nil))
                   (t
                    (seq (<- count get-state)
                         (set-state (1+ count))
                         (return-state (funcall f val)))))))
    (run-state 0 (iter tree))))
    
    (map-count '(1 2 (4 5 (6)) ((87 9))) (lambda (n) (+ n 4)))
    ;; => 7
    ;;    (5 6 (8 9 (10)) ((91 13)))
    ;; Woo-hoo!

Which does roughly the equivalent of...

    (defun map-count-2 (tree f)
      (let ((count 0))
    (labels ((iter (val)
               (if (consp val)
                   (mapcar #'iter val)
                   (progn (incf count)
                          (funcall f val)))))
      (values (iter tree) count))))

It appears that in the presence of mutable state, a lot of the
advantages of monads become moot. Furthermore, in the presence of
Common Lisp's syntax and semantics, they tend to become rather
cumbersome and ugly. I suspect this last point could be largely
overcome by some more clever macros and conventions — maybe
I'm thinking too much in Haskell terms. But my insight into monads
is not really deep enough to be able to think in other terms, so
I'll leave that as an exercise to the reader.

I still need to write that parser. I guess I'll embrace the
Lisp way and try to simulate the convenience of monadic parsing
with a big tangle of macros and special variables.
