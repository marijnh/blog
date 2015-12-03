---
layout: post
title: More Money For Better Open-Source Software
tags:
- open source
- community
---

As a programmer I create artifacts that, unlike classical commodities
such as loaves of bread or toothbrushes, can be copied at zero cost.

Fitting copyable things into the capitalist market economy is
something of an unsolved problem. The standard model of commerce is to
sell our products by the unit. But here, everyone who gets their hands
on a single unit can create an infinite number of units, ruining our
market.

Thus, we've invented copyright, using the law to try and make the
copyable less copyable, and allowing us to go back to the classical
model of selling by the unit. Copyright is rather effective at
protecting the interests of the producer of the copyable goods—it
doesn't fully prevent copying, but it inhibits it enough to allow many
authors, musicians, and software houses to turn a profit.

Open source software (and similarly open-licensed works in other
media) tilts the balance the other way—it leaves the consumer's
ability to copy the works largely unconstrained. This is a way to
optimize the _usage_ of the work, the value humanity as a whole gets
from it. At the cost, of course, of the ability of the producer to
capture value.

## Growing Up

I am very happy that the open source concept took off. I personally
benefit hugely from being able to use many pieces of great software,
without the bother or the financial burden of having to purchase them.
I am even more happy that people who aren't as privileged as I am
also have access to all this software.

I have spent over 8 years working mostly on open source software.
Sometimes I was paid, often I was not. This was possible for me
because I have been financially secure my whole life, and giving away
software that may or may not help my career at some point in the
future was never a seriously risky choice. By the time I started
taking on financial responsibilities, my open source career had been
bootstrapped well enough that it wasn't risky anymore.

You could say that lack of financial and social responsibilities is
the entry ticket to the open source world. And that shows—we're mostly
a young white guy club. The open source endeavor is, in a way,
missing out on lots of programming talent, both that of people who
never are in a position to enter our world to begin with, and that of
people who grow up, get a mortgage, and move on to a safe commercial
job.

(There are certainly other causes for the lack of diversity in open
source, but I think this one is a significant factor.)

## Finding a Middle Ground

What I want, both for long-time maintainers like myself and for people
starting out, is a way to get more money flowing into open source.
There have been [several][openssl] [stories][gpg] in the news about
underfunded, critical projects, but I think the problem affects most
projects that aren't directly associated with a company: There are few
direct incentives to pay for open source, so even projects with
enormous amounts of users often simply don't see enough money to pay
for proper maintenance. The slack is sometimes picked up by the
aforementioned young people without responsibilities, but that is
rarely sustainable.

[openssl]: http://veridicalsystems.com/blog/of-money-responsibility-and-pride/
[gpg]: http://www.propublica.org/article/the-worlds-email-encryption-software-relies-on-one-guy-who-is-going-broke

The effect is that the resulting software isn't as good as it could be
and that some niches that would benefit greatly from having a good
open implementation simply do not get addressed. In terms of costs and
benefits, this is entirely stupid. The money it takes to properly pay
a few maintainers is, for most types of software, very small compared
to the value created by having that software globally available.

In terms of game theory, on the other hand, this is a rather obvious
outcome—one actor's contribution to a project's maintenance is likely
to cost that actor more than the direct benefit they receive from the
slightly improved maintenance level. Everybody likes good roads, but
nobody likes to pay taxes. So everybody sits on their asses and waits
for [someone else][diff] to do something.

[diff]: http://en.wikipedia.org/wiki/Diffusion_of_responsibility

But roads can not be copied, whereas software can, so the maintenance
work needed to supply people with software does not increase as much
per person as the way it does with roads. For projects that have the
potential to cater to a lot of users, the economy of scale is very
much in our favor. I think we can work this out.

I am about to launch a [new project][pm], which is likely to seriously
increase the amount of maintenance work I have to do for non-paying
strangers. I've been thinking a lot about the way to approach this in
the past months. These are the options I've considered...

[pm]: http://prosemirror.net

### Option 1: Closed Source

I could keep all rights to my software and go back to the warm embrace
of classical commodity capitalism.

But that'd reduce the impact of my software to a tiny circle of paying
customers. I'd have to do marketing to get new customers, rather than
the thing simply spreading on its own merit, and lots of people to
whom the software would be helpful won't use it because they can't
afford it or simply don't know about it. Very unsatisfying.

### Option 2: Difficult Open Source

In this model, I would license the code under the [Affero GPL][agpl]
license, which is much like the [GPL][gpl], but without the loophole
that allows you to use such code on a networked server without
distributing your code to the users of that server.

[agpl]: http://en.wikipedia.org/wiki/Affero_General_Public_License
[gpl]: http://en.wikipedia.org/wiki/GNU_General_Public_License

This would mostly mean that commercial use of the code would be a lot
harder, since the companies using my code would have to open-source
much of their own code. The trick would then be to sell licenses to
such companies that allowed them to use the code on other terms.

I've seriously considered this approach, but there are two concerns
that made me abandon it. Firstly, I expect it would inhibit use of the
library almost as much as the closed source model, because GPL
licenses are complicated and scary and their legal implications are
not terribly well understood.

But more problematically, this model requires me (or my company) to
play the role of a central actor. I can only sell licenses if I
actually own the copyright over the whole project. That means that
only people who explicitly sign away their copyright to me would be
able to contribute. And it means that anybody using the code
commercially would be entirely dependent on me—if I vanish or
quadruple my prices, they have a problem. I personally would be
unlikely to use such a project, or to contribute to it.

So that's out as well.

### Option 3: The Cultural Approach

This is a long shot, but it is what I'm going to try. I am legally
licensing the code under an [MIT license][mit], which is very liberal.
Contributors keep the copyright over their contributions on the
condition that they license them under the same license, so that the
project is a free thing that can be continued and forked without my
involvement.

[mit]: http://en.wikipedia.org/wiki/MIT_License

But along with this legal licensing situation, I am going to
emphasize, in the docs, the license file, and the communication
surrounding the project, that free-loading is not socially acceptable.
Along with this, I will provide convenient mechanisms to donate. The
code of financial conduct would be something like this:

 * If you are a non-commercial user, don't worry about it.

 * If I fix a bug you reported or add a feature you wanted and you
   have the financial means, a one-time tip is much appreciated. Even
   if this is unlikely to add up to serious money, it takes the
   one-sidedness out of the process of responding to user requests.

 * If you are extracting value from your use of my software, set up
   a proportional monthly donation.

The _monthly_ part is the important thing here. Having to periodically
beg a user base to please contribute to a donation drive again is a
drag, and not very effective. Convincing users to donate as long as
they get value from the software gives a maintainer a more or less
predictable, low-maintenance source of compensations for their work.

Along with this, I will run a [crowd-funding drive][pmig] to launch
the project. This is a way to try and get paid for the huge amount of
work that went into the initial implementation (as opposed to future
maintenance). It worked well with my [Tern][tern] project.

[pmig]: https://www.indiegogo.com/projects/prosemirror/
[tern]: http://ternjs.net

## Generalizing

In the past year or so, a lot has been written about the problem I am
trying to address here. With luck, the IT community will start to
become more aware of the issue. Ideally, I'd like to move towards a
culture where setting up contributions to open source maintainers
whose work your company depends on becomes the norm. Individual
projects setting such expectations can help move us in that direction.

I also hope that services making it easier to transfer money from open
source users to open source maintainers, like [Bountysource][bs] and
[Patreon][pat], become more widely used. There is definitely room for
more experimentation in this space. For example, software and
conventions to help channel contributions made to a _project_ to
individual _contributors_ who are doing the work, in a fair way.

[bs]: https://www.bountysource.com/
[pat]: https://www.patreon.com/

But these things, if they work at all, only work for proven projects
with many users. To lower the financial bar for people interested in
starting open source work, we need something different. One
possibility would be well-funded projects channeling some of their
money towards mentorship and compensation of junior contributors.

Another avenue would be to build organizations that act as incubators
for open source projects, helping people with a basic income and a
helpful environment as they work on open source. New projects are
hit-and-miss, of course, and motivating companies to fund these things
is likely to be difficult. But the money needed to provide basic
financial security for a starting programmer is trivial compared to
the value created by having good software freely available. You could
see such organizations as doing public infrastructure work, and if
sold in the right way they just might be sustainable.

(For another recent piece on the same topic, see Noah Kantrowitz's
[Funding FOSS][ff].)

[ff]: http://coderanger.net/funding-foss/
