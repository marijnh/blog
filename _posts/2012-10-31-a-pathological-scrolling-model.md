---
layout: post
title: "A tale of a pathological scrolling model"
tags:
- javascript
- codemirror5
- cm-internals
---

When you've lied about something, it tends to take more and more lies
to cover up the discrepancies created by the first lie. A very similar
thing happened when [CodeMirror][cm] needed to fake its scrollbars.

[cm]: http://codemirror.net

## CodeMirror's viewport

First, some background. Why would we want to fake a scrollbar to begin
with?

In order to remain responsive when huge documents are loaded in,
CodeMirror does not render the whole document, but only the part of it
that is currently scrolled into view. This means that the amount of
DOM nodes it creates is limited by the size of the viewport, and the
browser relayouts triggered by changes to the text are relatively
cheap.

So if you have a document that is higher than the vertical height of
your editor, the actual DOM inside the editor will be a big, largely
empty `div` that defines the height (and thus the scrollable area) of
the editor content, with inside of that, absolutely positioned to
cover the part that's currently scrolled into view, a smaller element
that contains the lines of text that you are looking at (and a slight
margin of a few lines around that).

When you scroll, you do *not* want to see a bunch of empty space
coming into view, so the editor has to make sure that, once you're
scrolling past the viewport margin, it updates the viewport and
renders the content that came into view.

Unfortunately, browsers fire `scroll` events *after* doing the actual
visual scrolling. This means that if you quickly drag the scrollbar,
you'll see empty space coming into view before the `scroll` event
handler even has a chance to update the viewport. And that is the
reason for our first lie.

## To fake a scrollbar

If the user's scrolling happens on an element that is not our actual
content container, the scrolling won't be able to move empty space
into view, but will still fire `scroll` events (on the other element)
that we can use to update our viewport and *then* scroll our content
container.

So, we create a second scrollable element, absolutely position it
where the scrollbar is (hiding the real scrollbar), and put an element
inside of it with its `height` style set to the same height as the
actual content. Scroll event handlers keep the scrolling position of
the two elements in sync, and fast scrolling with the scrollbar will
go through the dummy element and thus not cause empty space to become
visible.

There's some extra machinery needed, for example to make sure the
scrollbar is hidden when the main content is not scrollable, but on
the whole this wasn't hard to get right.

Enter OS X Lion.

Now a widely used platform has scrollbars that hide themselves when
inactive, and are transparent. You can imagine how overlaying a
transparent scrollbar over another one does not create a very
believable effect. The 'hidden' scrollbar is still visible, and as you
scroll it slightly lags behind the non-hidden one, looking flaky.

Which brings us to our next coverup. CodeMirror currently gives its
outer element `overflow: hidden`, and its scrolling element (which
lives inside of that) a margin of `-30px` and padding of `30px` on the
right side and bottom. This will, in effect, clip off its outer right
and bottom edge, without affecting its inner size. Thus, the
scrollbars are now truly hidden.

If you are thinking I could have hidden the scrollbars by setting
`overflow: hidden` on the 'scrolling' element and faking all
scrolling, you're right, and we did go down that road at some point,
but see the section on wheel scrolling below—we want the mouse wheel
to scroll this element, and it doesn't do that for `overflow: hidden`
nodes.

This trick forces us to also fake the horizontal scrollbar (it
wouldn't look right if its rightmost corner was clipped off), but that
follows the same principles as faking the vertical one, and is easy to
do.

Making scrollbars of different heights correspond to each other is
pretty easy.

    fakeScrollbar.firstChild.style.height = 
      (scroller.scrollHeight - scroller.clientHeight + fakeScrollbar.clientHeight) + "px";

The `firstChild` of the fake scrollbar is the element used to force
its height. `scroller.scrollHeight - scroller.clientHeight` is the
maximum `scrollTop` of the scrolling container. We want the fake
scrollbar to have the same maximum `scrollTop` (so that one pixel
scrolled there corresponds to one pixel scrolled in the content), so
we set its scrollable height to this maximum `scrollTop` plus its own
outer height.

At one point, I was doing the computation of whether horizontal and
vertical scrollbars were needed, and how high/wide they should be,
myself. But that turned out to be much more error prone than simply
inspecting the scrollable container and using its dimensions
`scrollHeight`/`scrollWidth`, which outsources the computation to the
browser. Here it turned out that leaving the scrollable element as
`overflow: auto` has another advantage—since it will have scrollbars
when scrollable, even though those scrollbars are hidden, the formula
above does not need to take the height of the horizontal scrollbar
into account—if one is needed, the browser will already be showing it
on the scrollable element, and adjust its `clientHeight` as needed.

## Wheel scrolling

I initially believed that wheel scrolling would not be a problem,
since it proceeds in small steps, and thus will never jump over the
margin of the visible viewport.

Seems I'm not keeping up with technology.

The old clickety-click style of mouse wheel is only one source of
wheel events. Though no actual wheel is involved, scrolling by
touchpad (or touchscreen) fires the same kind of events, and has the
same kind of direct, scrollbar-less scrolling effect.

And such interfaces tend to support 'throw scrolling', where if you
scroll quickly and then take your finger(s) off the device, it'll keep
scrolling for a bit, potentially very fast. Potentially revealing
empty space again.

So we'll have to do something about wheel events as well.

The first, obvious approach was to simply handle the wheel events,
which can be `preventDefault`-ed to cancel their scrolling effect, do
the scrolling ourselves, and make sure we update the viewport in the
process.

*Don't do that.*

Firstly, `mousewheel` (and Firefox's `DOMMouseScroll`) events come
with a `wheelDelta` or `detail` property that indicates the amount
scrolled, but there is no clear relationship between this quantity and
the amount of pixels that the browser would scroll for this event.

The delta-to-pixel ratios are wildly different across the various
browsers. And not just that. They also vary between versions of
browsers, and between specific versions of a single browser run of
different operating systems. Possibly (though I didn't reliably verify
that) even between browsers run on different hardware or device
drivers.

Thus, to know how many pixels you should scroll for a given wheel
event, you'll need a long list of fragile checks against
`navigator.userAgent` strings. And, since there is no standard or
default value, you'll still be defenseless against new versions of
browsers, old versions that you didn't test, or obscure browsers that
you've never heard of.

And even if you somehow got that right, your scrolling will still not
feel native. Firefox, for example, will smooth-scroll your document as
you scroll with the wheel, but will not fire a wheel event for every
change in the scrolling position. Some browsers appear to use subtle
speedup and smoothing effects in the process of a throw scroll that
are not reflected in the deltas they attach to the events. Thus, wheel
scrolling that we do ourselves is necessarily less smooth than the
native version.

... I know, there are a bunch of projects out there which *do* their
own wheel scrolling, and several libraries that claim to 'normalize'
wheel events. But these all seem to set the bar for what 'normalizing'
means pretty low, since it was trivial to get obviously inconsistent
results from them when testing several browsers and platforms.

(It would certainly be *nice* if browsers exposed an API powerful and
standardized enough to simulate wheel scrolling in a solid way. It's
just that they don't.)

So CodeMirror does not override wheel events itself. What then does it
do?

## Self-adjusting, non-invasive scroll prediction

It does several things. First, it contains a number of crude,
hard-coded, browser-detected constants to use as a first approximation
of wheel-delta-to-pixels rates.

Then, it listens to wheel events, but never calls `preventDefault` on
them or does scrolling in response to them. Instead, it responds by
setting a timeout to observe the amount of pixels that the wheel event
did scroll the content, and uses that to tweak its delta-to-pixel rate
at run-time.

In addition, it uses its current estimate of this rate to extend the
viewport to cover the area it expects the wheel event to scroll into
view. If it's wrong, some flickering (visible empty space immediately
replaced by content again) might be noticeable, but it does *not*
screw up the scrolling experience by hijacking the wheel events.
