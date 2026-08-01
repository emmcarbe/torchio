# Complex publications: archives, collections, editions inside editions

Most tools assume one edition, one text. Real projects are rarely that.
An archive holds editions; a correspondence holds letters that are each a
document and together a work; a diplomatic codex holds thousands of
charters. This document records how Torchio treats those shapes, what it
gets right today, and what it does not yet do. It is written from real
cases, and every claim here has been pressed.

## Levels

A publication has at least two levels, and they must both survive.

- **The whole**: the archive, the collection, the corpus. It has its own
  identity, its own responsibility, and registries that belong to it rather
  than to any one item (the people index of an archive spans its documents).
- **The item**: one edition, one letter, one charter. It has its own header,
  its own editor, and sometimes its own apparatus.

The rule that follows: **index the first level, descend into the second,
and connect the two.** Neither may be dissolved into the other. An archive
reduced to a list of links loses what its editors did to the whole; a
document flattened into its archive loses its own editorial identity.

## Where the files live

The parts of one publication often sit in sibling folders:

```
data/
  editions/     the texts
  indices/      listPerson, listPlace: the registries of the whole
  meta/         project-level declarations
```

Those folders are one edition, not several. When the folder given to the
press holds no TEI at its own level, the press goes down and gathers what
is below (bounded, skipping dotfiles), so the texts and the registries that
belong together arrive together. Names stay relative to the input, so two
files with the same basename do not collide.

Measured on the Akademieprotokolle (253 sessions of the Vienna Academy):
pressing `data/editions` alone reported no people at all, because the person
index sits in `data/indices`; pressing `data/` gathers both and the same
edition yields 2830 persons and 272 places (C106).

## The data model of an archive: a box that points at other boxes

An archive cannot always be serialized whole. Past a certain size the
runtime refuses to build the string at all, and the failure arrives as an
error about a string length rather than as a size. So the export is a box:

```
data/model.json          the whole: identity, generator, shared registries,
                         and one pointer per document
data/model/<doc>.json    one document, complete
data/tokens.csv          the index of the token stream, per document
data/tokens/<doc>.csv    one document's tokens
```

Both levels stay legible. This is the shape that makes a large archive
possible to take in at all (C107, found on ALIM's 403 literary works).

## Kinds of publication, and what the press derives

The press does not ask the editor to declare a genre: it reads what the
markup substantiates and shapes the site accordingly. What it derives today:

| shape | what substantiates it | what the press does |
|---|---|---|
| single edition | one TEI document | reading text, apparatus if `app`, indices if entities |
| collection or archive | many TEI documents | a register with columns derived from the headers, one page per document |
| correspondence | cards carrying sender, recipient, date | the register wears from-to-date |
| collated tradition | a `listWit` of witnesses over one text | per-witness lexicon, no merged view (C84) |
| proceedings, records | sessions with dates | *not yet*: `meeting` is unread, so a register of dated sessions shows only shelf numbers (C105) |
| archive of editions | items that are themselves editions, each with its own editor | *not yet a type of its own*: the items are treated as documents of one collection, and the whole takes its title from one of them (C108) |

## What is not yet done, stated plainly

- **An archive whose items are themselves scholarly editions** is a
  structural type the press does not recognise. ALIM keeps documentary
  sources and literary works in sibling folders; pressing them together
  makes one edition out of many and takes the title of the whole from
  whichever document came first. The same shape recurs in the Eurasian
  Latin Archive and in archives of many editions generally. Until it is
  recognised, press each kind separately and give the whole its title in
  the manifest.
- **The declared kind of edition** was a manifest field that no line of
  code read, and it has been removed rather than left as a setting that
  does nothing (C90). Its replacement is designed and not yet built: a
  profile on two axes, one for the orientation of the edition between
  document and text, one for the shape of the collection, derived from the
  markup and confirmed by the editor in the vocabulary of their own
  tradition. Two real archives have already shown that a single list of
  kinds cannot hold the field: a corpus of editions occupies two positions
  at once, and a series of institutional records is a form none of the
  four names.
- **Registries declared per item versus per archive** are not
  distinguished: an entity confirmed once for the whole and an entity
  attested in one document arrive alike.

## Working with a complex publication today

1. Point the press at the folder that contains the publication, not at one
   of its parts. If the TEI is in subfolders, the press will gather it.
2. Give the whole a title in `torchio.json`: an archive rarely declares one
   in any single file, and the press will not invent it.
3. Press different kinds of source separately when a repository holds more
   than one (documentary and literary, for instance), until the archive
   type exists.
4. Read the register: the columns the press chose tell you what shape it
   thought the publication had.
