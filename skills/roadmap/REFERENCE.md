# Roadmap items on GitHub

## An item

One issue per item: a title stating the item in a few words, a body of plain prose saying what is wanted and why, copied as written.
Labels:

- `roadmap` on every item, which the script adds itself;
- triage, both optional: one `priority: high|medium|low` and one `cost: trivial|cheap|moderate|large`; an item with neither is untriaged;
- `in flight` while a published spec delivers the item;
- the repo's own labels, listed on the config's `- Labels:` line.

## A hit

A hit is a comment on the item, when the item is met again:

```
Hit <N> · <YYYY-MM-DD>
<One line of evidence.>
Session: <the session's transcript identifier>
```

`<N>` is the count of the item's last hit comment plus one, or 1.
A match closed as completed takes no hit: file the idea as a new item naming it.

## Plain `gh`

Check a text for secrets and email addresses before writing it, since only the script checks for you.
Every command takes `--repo <the config's tracker>`.

- Read an item and its hits: `gh issue view <N> --comments`.
- Post a hit: `gh issue comment <N> --body-file -`, the comment on stdin.
- Re-triage: `gh issue edit <N> --add-label "priority: high" --remove-label "priority: low"`.
- Close: `gh issue close <N> --reason completed`, or `--reason "not planned"`.
