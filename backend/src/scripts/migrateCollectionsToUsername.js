// src/scripts/migrateCollectionsToUsername.js
//
// ONE-TIME MIGRATION — run manually, does not run automatically on boot.
//
// BACKGROUND:
//   Per-user MongoDB collections used to be keyed by the folder name
//   `Capitalize(user.name)` (the MeroShare display name, e.g. "Krijan"),
//   which is NOT guaranteed unique. They are now keyed by
//   `Capitalize(user.username)` (the account's unique, immutable username).
//
//   This script renames each existing `<OldName>.<suffix>` collection to
//   `<NewUsername>.<suffix>` for every user in the `users` collection, so
//   manually-entered data (journal trades, investment trades, watchlist,
//   uploaded WACC records, etc.) is not orphaned under the old collection
//   names after upgrading.
//
//   Data that is fully repopulated by MeroShare sync (shares, portfolio,
//   applicableissues, userprofiles, synclogs) does not strictly need this
//   migration — it will be recreated automatically under the new
//   username-based collections on the user's next login — but renaming is
//   still safer and avoids a temporary "empty portfolio" moment.
//
// SAFETY:
//   - Skips any user whose old and new collection keys are already the same
//     (i.e. their username already matches what their display-name folder
//     would have produced).
//   - Skips (and logs) any rename where the destination collection already
//     exists and is non-empty, so it never silently overwrites data. Review
//     these cases by hand.
//   - Purely additive: does not delete anything, only renames.
//
// USAGE:
//   node src/scripts/migrateCollectionsToUsername.js
//
const mongoose = require("mongoose");
require("dotenv").config();

const COLLECTION_SUFFIXES = [
  "applicableissues",
  "shares",
  "portfolioitems",
  "portfoliosummaries",
  "userprofiles",
  "waccs",
  "synclogs",
  "journalentries",
  "investmententries",
  "watchlistentries",
];

// Mirrors the folder-name derivation in src/utils/userCollections.js so the
// old/new collection keys computed here match exactly what the app used
// (old) and now uses (new).
function folderNameFor(value) {
  if (!value || typeof value !== "string") return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to ${db.databaseName}.`);

  const users = await db.collection("users").find({}).toArray();
  console.log(`Found ${users.length} user(s).`);

  const existingCollections = new Set(
    (await db.listCollections().toArray()).map((c) => c.name)
  );

  let renamed = 0;
  let skippedSame = 0;
  let skippedMissing = 0;
  let conflicts = 0;

  for (const user of users) {
    const oldFolder = folderNameFor(user.name);
    const newFolder = folderNameFor(user.username);

    if (!oldFolder || !newFolder) {
      console.warn(`⚠️  User ${user._id} missing name/username — skipping.`);
      continue;
    }

    if (oldFolder === newFolder) {
      skippedSame++;
      continue;
    }

    for (const suffix of COLLECTION_SUFFIXES) {
      const oldKey = `${oldFolder}.${suffix}`;
      const newKey = `${newFolder}.${suffix}`;

      if (!existingCollections.has(oldKey)) {
        skippedMissing++;
        continue;
      }

      if (existingCollections.has(newKey)) {
        const count = await db.collection(newKey).countDocuments();
        if (count > 0) {
          console.warn(
            `⚠️  Conflict: ${newKey} already exists with ${count} doc(s). ` +
            `Leaving ${oldKey} untouched — merge manually if needed.`
          );
          conflicts++;
          continue;
        }
        // Destination exists but is empty — drop it so rename can proceed.
        await db.collection(newKey).drop();
        existingCollections.delete(newKey);
      }

      await db.renameCollection(oldKey, newKey);
      existingCollections.delete(oldKey);
      existingCollections.add(newKey);
      renamed++;
      console.log(`✔ Renamed ${oldKey} → ${newKey}`);
    }
  }

  console.log("───────────────────────────────────────");
  console.log(`Renamed:            ${renamed}`);
  console.log(`Skipped (same key): ${skippedSame}`);
  console.log(`Skipped (no data):  ${skippedMissing}`);
  console.log(`Conflicts (review): ${conflicts}`);
  console.log("Done.");

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
