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

## Delivery

A spec lists every item its feature delivers on one `Roadmap items:` line, and each ticket the items it delivers on its own: `#N` on the config's tracker, `owner/repo#N` on any other.

- Publishing the spec: run the script's `in-flight <feature folder>`.
- `/commit`: for each ticket its commit's work resolved, as the session knows them, add `Fixes #N` to the message body for each item on the ticket's line, read from the file with no tracker call, in the `owner/repo#N` form where the commit's repo is not the item's tracker.
- Closing the feature: run `close <feature folder>` before deleting the folder, so an abandoned feature's open items return to the pool.

## A mirrored feature

Where the loop config says to sync a feature after each write verb, its storage section names the tracker: the script's `sync <feature folder> --tracker <owner/repo>` is that sync, the tracker needed on its first run only.

- `/commit`: run `sync <feature folder>` once, without `--tracker`, for the feature the session took up and no other; where it prints a `Closes` keyword, add it to the message body as written.
- Closing the feature: `close` also closes the feature's issues still open, and needs `--done` or `--not-planned` where its tickets are not all resolved; delete the folder once it succeeded.

## Plain `gh`

Check a text for secrets and email addresses before writing it, since only the script checks for you.
Every command takes `--repo <the config's tracker>`.

- Read an item and its hits: `gh issue view <N> --comments`.
- Re-triage: `gh issue edit <N> --add-label "priority: high" --remove-label "priority: low"`.
- Close: `gh issue close <N> --reason completed`, or `--reason "not planned"`.
