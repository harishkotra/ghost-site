export type SeedPage = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  lifeBlocks: number;
  body: string;
};

const DAY = 43_200;

const p = (s: string) => s.trim().replace(/\n{3,}/g, "\n\n");

export const pages: SeedPage[] = [
  {
    slug: "the-premise",
    section: "PREMISE",
    title: "A website is a promise to keep paying",
    dek: "Every URL you have ever bookmarked is a bill somebody stopped paying.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
A website does not die when the idea runs out. It dies when the invoice does. Somebody stops renewing the domain, or the server, or the certificate, and then the whole thing is a stranger's error page.

You have felt this. The tutorial you needed. The blog post that explained it. The recipe your mother used. Bookmark, tab, group, close, forget. Years later you find the link in a document and it goes nowhere, and no one was ever asked.

This site makes that bill visible. Every page here is a record on Arkiv's DB-Chain with a hard expiry attached to it: seven days from the moment it was written. Not archived when it runs out. Not hidden behind a redirect. Deleted from the database, because the database is the page.

One rule keeps a page here alive: someone pays to extend it. It does not matter who. It does not matter whether you own anything. The extension is permissionless, which means the person who cares about this page does not have to be the person who wrote it.

So the site is really an experiment in a single question. Which things do strangers keep alive when keeping them alive costs one click and nobody is watching?
`),
  },
  {
    slug: "how-this-dies",
    section: "MECHANICS",
    title: "Seven days, then the database forgets you",
    dek: "No soft delete. No archive tier. No trash can to dig through.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
An Arkiv entity is created with an expiration time. When the chain reaches that block, the entity stops existing. There is no tombstone in the data layer, no "deleted_at" column, no admin who can restore it for you. The storage was paid for a number of blocks and the last block has passed.

That is usually treated as housekeeping. Here it is the whole product. The clock at the top of each page is not decoration; it is read straight off the entity's expiration block and converted at two seconds per block.

Two flags are set when a page is written, and neither can ever be changed afterwards:

readonly — nobody, including whoever created the page, can edit the content. What you read is what was signed.

permissionlessExtension — anyone can push the expiry forward, without permission, without ownership, without control.

The second flag is the interesting one. On a normal chain, the account that owns a record decides what happens to it. Here, ownership controls nothing that matters. Survival is decided by whoever shows up.

A page can be extended by anyone who pays the storage. That is the entire social contract of this site, compressed into a single button.
`),
  },
  {
    slug: "dead-links",
    section: "RECORD",
    title: "The web is a library where the books keep leaving",
    dek: "Link rot is not a bug. It is what happens when permanence has a monthly fee.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
Ask anyone who has maintained a documentation site for five years what happened to the links. Some moved. Some were rewritten. A large number simply stopped existing, because the project stopped, or the host changed its pricing, or the person who ran it got a job.

The usual fix is an archive. A third party copies the page and keeps it, which works right up until the archive is also a website with a bill. Permanence on the web is never a property of the medium. It is a property of somebody caring for long enough.

Arkiv's pitch is different in a way that is easy to miss. The data is not on a server that can go offline; it lives in a database chain with its own expiry, and reads are free. What costs money is not access, it is existence. You pay for the blocks the record occupies, and when the payment stops, so does the record.

Which means a page's lifetime is an honest number, visible to everyone, rather than a vague promise on a hosting invoice you will never read.
`),
  },
  {
    slug: "the-editors-note",
    section: "NOTICE",
    title: "Nobody can edit this page. That is the point.",
    dek: "A record you can quietly change is a record nobody can trust.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
This page was written once. It has no admin panel, no draft state, no revision history that lets the author quietly rewrite what it says later.

That is a hard constraint, not an editorial stance. The entity was created with the readonly flag, so the chain itself rejects edits. If we wanted to correct a typo in this paragraph, our only option would be to let this page die and publish a new one next to it.

There is a real cost to that. It makes us careful. It also means that when you read something here, you are reading exactly what was signed at a specific block, by a specific key, and nothing else has touched it since.

Most websites ask for trust. This one offers a receipt.
`),
  },
  {
    slug: "keep-alive",
    section: "MECHANICS",
    title: "Clicking a button is a transaction, and you are not paying for it",
    dek: "The button signs, sends, and waits. You get to keep thinking of it as a button.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
Extending a record means sending a transaction that pays for more storage blocks. Normally that means a wallet, a gas estimate, a confirmation dialog and a person deciding it is not worth the trouble. That is where most good intentions about preservation go to die.

So the site runs a sponsor relayer. When you press keep this alive, a server-side key signs the extension and pays for the blocks. You do not connect a wallet, you do not hold a token, you do not learn what a nonce is. The record's expiry moves forward by twenty-four hours and the page tells you it happened.

Nothing about ownership changes. The relayer cannot edit the page, cannot delete it, and does not become its owner. It can only do the one thing the page was born allowing: buy it more time.

The ledger on each page is the receipt. Every extension, with its transaction hash, is written down. It is the closest thing this site has to a guestbook.
`),
  },
  {
    slug: "first-entity",
    section: "DISPATCH",
    title: "The oldest thing on this site",
    dek: "Written before the design was finished, and already counting down.",
    author: "THE EDITORS",
    lifeBlocks: 7 * DAY,
    body: p(`
This is one of the first records written to the ghost-site schema, published while the interface was still being built around it. It has been counting down since the moment it was signed.

Its expiry block is printed in the sidebar. Convert it at two seconds per block and you have the exact second it stops existing, give or take the drift of the chain.

There is something clarifying about publishing into a deadline. Paragraphs get shorter. Hedges get cut. You stop writing for the version of the page that will exist after a future redesign, because there is no redesign. There is only this text, this block, and this clock.

If you are reading this and the clock is under a day, someone has been generous. If it is under an hour, come back later and watch what a deletion looks like when it is scheduled in public.
`),
  },
  {
    slug: "notice-of-death",
    section: "NOTICE",
    title: "This page has been given thirty minutes",
    dek: "A demonstration, at the expense of the record itself.",
    author: "THE EDITORS",
    lifeBlocks: 900,
    body: p(`
Everything here dies on a schedule, but this page dies on a short one. It was created with thirty minutes of storage instead of seven days, so that the site has something to bury while you are still watching.

In half an hour it will stop existing. The index will stop listing it. If you ask the chain for its key, the chain will tell you it was never there. The graveyard page will keep a local note of what it was and how long it lasted, because the graveyard is an index the site keeps about its own losses, not data the chain still holds.

You can extend it. That is the entire game: nothing here is precious until somebody decides it is.

When it dies, this URL will show a tombstone instead of an error. That is the most honest 404 on the internet.
`),
  },
];
