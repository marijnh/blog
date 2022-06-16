---
layout: post
title: Faking an editable control in browser JavaScript
tags:
- javascript
- codemirror5
- cm-internals
---

This is a post in the [*cm-internals*][cmi] series, describing the
internals of the [CodeMirror][cm] editor.

[cmi]: ./#cm-internals
[cm]: http://codemirror.net/

The problem it tackles is this: you are writing a JavaScript control
that needs to act as a text input field—it must be focusable, support
copy and paste, receive typed input—but really isn't. I.e. you want to
draw it yourself, and have full control over its content.

In this post, I won't talk about drawing a cursor, maintaining your
own selection, and similar. Those are also required to present a
convincing text input, of course. But they are relatively
straightforward to implement.

## The hidden textarea

The crux of my solution, the initial inspiration for which I got from
the [ACE][ace] editor, revolves around a hidden [textarea][te] node.
This is the thing that the browser *believes* is focused when the
editor looks like it is focused. It'll behave like a regular focusable
object, you can assign a `tabindex` to it, and will receive `focus`
and `blur` events when it gains or loses focus, allowing us to update
the style of our editor (show/hide cursor, color/grey selection) to
reflect its focused state.

[ace]: http://ace.ajax.org
[te]: https://developer.mozilla.org/en-US/docs/HTML/HTML_Elements/textarea

This textarea must, obviously, not be visible. The suspension of
disbelief required for an editable control to feel real is
completely ruined when there's a textarea sitting next to it, with its
own blinking cursor.

However, if you give the textarea `display: none` or `visibility:
hidden`, the browser decides that it is not really part of the
document and will refuse to focus it. CodeMirror gets around this by
wrapping the textarea (made small) in an `overflow: hidden; height: 0`
element (`div`). That makes it both invisible and focusable.

(You'll also want an `outline: none` style, to prevent some browsers
from helpfully showing a glow around it when focused, which is for
some reason not clipped by the `overflow: hidden`.)

An other unfortunate (or fortunate, depending on your perspective)
effect of a focused editing control is that the browser will scroll it
into view every time it notices activity in it. This means that, if
the hidden textarea simply sat at the top of the editor, and you had
that top scrolled out of view because you were editing something near
the bottom of the editor, your window would scroll up every time you
typed a character.

CodeMirror absolutely positions the `div` element it uses to hide the
textarea, and moves it around to always line up with the cursor. That
way, it actually helps scroll the real cursor into view.

## Maintaining selection

When the user has selected some text, and performs a copy or cut
action, the correct text should be placed on the clipboard.

This means that the selected text must be present in the textarea, and
selected. There are two approaches one can take here. The first, taken
by [ACE][ace], is to listen for `copy` and `cut` events (which are
fired *before* the actual copy or cut takes place), and only when such
an event is detected, insert the currently selected text into the
textarea and select it.

CodeMirror's approach is less clever, but more robust. It simply
always places the currently selected text into the textarea
(selected). The downside is that setting and getting a textarea's
`value` property when it contains a lot of text is **slow**. If you
put a huge document into CodeMirror and press ctrl-A / cmd-A (select
all), there'll be a noticeable pause. (On some old browsers, depending
on the size of the document, it can actually look more like a browser
freeze than a noticeable pause.)

The advantage of this approach is that it works on Opera, which
doesn't fire `copy` and `cut` events, and that, on Linux, on some
browsers, it'll play nice with the X Windows selection clipboard (i.e.
middle-mouse-button paste). CodeMirror takes some care to minimize the
amount of `textarea.value` traffic it produces, for example by not
updating the value during a selection drag, but only when the drag is
finished.

*Update*: It turned out to be easy to wire up CodeMirror to perform
the same trick as ACE—only putting in the whole selection when a cut
or copy happens—but only do it when the selection is actually big, and
we're on a browser that fires `copy` and `cut` events. For small
selections, the X Windows menu will still work, yet the pathological
case of select-all in a huge doc is only costly when the resulting
selection is copied.

## Noticing input

So the hidden textarea contains the current selection, and has its
content selected. That means that when the user types something, or
pastes text, the content of the textarea will be the inserted text
(overwriting the previous selection, if any), which can then be
inserted into the real document at the cursor position.

But who will tell us when input happens? For a start, we can listen to
events like `keypress`, `paste`, [`input`][input], and even mouse
events. Those'll tell us that something might be about to go down. So
we set a timeout, and check the content of the textarea a few
milliseconds later.

[input]: https://developer.mozilla.org/en-US/docs/DOM/DOM_event_reference/input

But that isn't perfect. Opera doesn't fire `paste`—and when you paste
from the menu, there also aren't any mouse events being fired.
Furthermore, [IME input][ime], on some browsers, can cause the content
of the textarea to be updated without any event being fired.

[ime]: http://en.wikipedia.org/wiki/Input_method_editor

So we must poll too. And polling could get expensive, if we do it a
lot and have to read the (potentially large) value of the textarea
every time. Fortunately, we are helped by the fact that if the
textarea has a big value (the selection), that value will be selected,
and entering input would overwrite it. Thus, if the textarea has a
selection (which is cheap to check), its value does not have to be
read. This makes polling cheap, and allows CodeMirror to poll
intensively when it is focused without eating up too many CPU cycles.
(It stops polling when unfocused.)

## About IME

I mentioned [IME][ime], Input Method Editor. I am not an expert on it,
since I don't speak any language that requires it to be used. But, in
brief, it allows people who write in scripts that have too many
characters to fit on a keyboard to use sequences of key strokes to
create characters. It usually operates by showing the *current* result
of the composition in the editable control, and then *replacing* it
with the updated result as more keys are pressed.

If CodeMirror were to clear the textarea every time it reads input,
that would throw off partially finished IME input. So what it does is,
when no selection exists, to leave the current input in the textarea,
and store its value somewhere. Then next time when it polls, it
compares the new value of the textarea to the previous value, discards
the common prefix string, and uses what remains of the new value as
the text to insert. If something also remains of the old value (after
discarding the common prefix), that means that part of the previous
value was *replaced* by new text, and the new input should replace
those old characters in the document.

## Drag-and-drop

Modern browsers provide a [weird but useful drag-and-drop API][dnd].
It is easy for an editing control to hook into this to support
dropping text into the editor and dragging text out of this. There are
a few subtleties. Here is CodeMirror's `dragstart` handler:

[dnd]: https://developer.mozilla.org/en-US/docs/DragDrop/Drag_and_Drop

```javascript
on(node, "dragstart", function(e) {
  // Set the dragged data to the currently selected text
  e.dataTransfer.setData("Text", editor.getSelection());

  // Use dummy image instead of default browsers image.
  if (e.dataTransfer.setDragImage)
    e.dataTransfer.setDragImage(document.createElement('img'), 0, 0);
}
```

The `setDragImage` call, which in effect suppresses the default drag
image, is needed to prevent some browsers from showing the whole
editor being dragged around, because the outer element was set as
`draggable=true`.

In CodeMirror's `mousedown` handler, I also `preventDefault()` clicks
that are not inside of the selection, so that dragging to create a
selection does not trigger text dragging. On Webkit, it is necessary,
in addition to that, to only set the `draggable` attribute to true
when handling a `mousedown` event that actually looks like a drag, and
setting it back to false afterwards.

The `drop` event handler for an editor can do the [song and dance][fr]
with a `FileReader` to also handle files being dropped into the
editor.

[fr]: http://www.html5rocks.com/en/tutorials/file/dndfiles/#toc-selecting-files-dnd

## Context menu

As the icing on the cake, an editing control should behave properly
when right-clicked. The context menu should contain working 'copy',
'cut', and 'paste' items.

Unfortunately, there is no API for hooking into context menus. You can
capture the click and display your own menu, but that is very lame,
and, what's worse, you won't have access to the clipboard so you can't
even properly implement copy/paste functionality.

As usual in browser land, there's a horrible kludge to be found to
make up for the lack of APIs. In this case, we can respond to a mouse
click or `contextmenu` event by briefly unhiding the textarea (giving
it a low opacity and no borders in order to not draw attention to it),
and placing it under the mouse cursor.

Since the textarea already contains the current selection, and, if it
has a selection, its top left corner, which we place under the mouse
cursor, will be where that selection is located, the browser now
believes that we clicked on the textarea's selection, and will provide
the menu items we want. Even if the the node is hidden again after a
few milliseconds, the click will have been associated with it, and a
subsequent paste will still be applied to our textarea.

One issue is that Firefox will fire the `contextmenu` event *after*
opening the contextmenu, at which point it is too late to trick it
into believing the textarea was clicked. So on that browser, we
trigger the kludge from the `mousedown` handler instead (given that
the right button was pressed).

A fourth item from the context menu that we'd like to support is
'select all'. To do this, we add a bogus space at the start of the
content, which is not selected, and then poll for a while to see
whether this space became selected. If it did (with the rest of the
content still intact), we select everything in the editor. If
something else changed about the textarea, or some amount of time went
by, we give up.

## Detour

For non-input keyboard events, such as cursor movement keys,
CodeMirror simply handles the raw event itself and performs the
appropriate operations on its internal selection representation.

The initial CodeMirror version 2 used a different approach, which was
cute but in the end didn't work out. It put not only the selection,
but also a few lines around that into the textarea, and left local
cursor movement up to the browser. It would not just get input from
the textarea, but also selection information.

This had the advantage of using the 'native' key bindings of the
browser. It would work for custom key bindings, and outsource some of
the complexity of selection handling to the browser.

It was abandoned because it required a *lot* of hacks to get working.
For example, you can't set the selection's anchor when setting a
selection on a textarea. The anchor is the side that does not move
when you press shift-left (or any other shift-motion). Browsers assume
it to always be the left side of the selection when the selection is
set through setting `selectionStart` and `selectionEnd`. To have the
selection behave properly when it was in fact inverted (the anchor was
the rightmost side) involved some painful and brittle kludges.

Additionally, it seems that very few people actually reconfigure the
keyboard bindings in their browsers (browsers don't make it very easy
to do so), and, interestingly, people were more interested in
providing custom bindings for CodeMirror than in reconfiguring their
browsers.

In the end, the extra complexity of handling our own keyboard events
turned out to be less than the complexity that came with the approach
outlined above. So CodeMirror moved to the model where the textarea
holds only the selection, and never has to deal with cursor-motion
key presses.
