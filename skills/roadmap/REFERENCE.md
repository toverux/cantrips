# Roadmap items on GitHub

## An item

One issue per item: a title stating the item in a few words, a body of plain prose saying what is wanted and why, copied as written.
Labels:

- `roadmap` on every item, which the script adds itself;
- triage, both optional: one `priority: high|medium|low` and one `cost: trivial|cheap|moderate|large`; an item with neither is untriaged;
- `in flight` while a published spec delivers the item;
- the repo's own labels, listed on the config's `- Labels:` line.

## A hit

A hit is a comment on the item, when the item is met again, which the script's `hit` writes:

```
Hit <N> · <YYYY-MM-DD>
<One line of evidence.>
Session: <the session's transcript identifier>
```

## In `/compound`'s round

The round drains this repo's inbox as a bare [`/roadmap`](SKILL.md) does, and from each other repo's checkout `claim`s the candidates this session parked there, as far as it still knows them.
Its proposals follow the knowledge candidates in `/compound`'s list, continuing their numbering, and the closing line goes under the list.
They are judged on the roadmap bar in place of `/compound`'s: a gap that no existing item, ticket or commit already holds.

## Plain `gh`

Check a text for secrets and email addresses before writing it, since only the script checks for you.
Every command takes `--repo <the config's tracker>`.

- Read an item and its hits: `gh issue view <N> --comments`.
- Re-triage: `gh issue edit <N> --add-label "priority: high" --remove-label "priority: low"`.
- Close: `gh issue close <N> --reason completed`, or `--reason "not planned"`.
