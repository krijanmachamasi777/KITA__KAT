// src/utils/userCollections.js
const mongoose = require("mongoose");
const logger   = require("./logger");

const { applicableIssueSchema } = require("../schemas/applicableIssueSchema");
const { shareSchema }           = require("../schemas/shareSchema");
const { portfolioItemSchema, portfolioSummarySchema } = require("../schemas/portfolioSchema");
const { userProfileSchema }     = require("../schemas/userProfileSchema");
const { waccSchema }            = require("../schemas/waccSchema");
const { syncLogSchema }         = require("../schemas/syncLogSchema");
const { journalEntrySchema }    = require("../schemas/journalEntrySchema");
const { investmentEntrySchema } = require("../schemas/investmentEntrySchema");
const { watchlistEntrySchema }  = require("../schemas/watchlistEntrySchema");

const COLLECTION_SCHEMAS = {
  applicableissues:   applicableIssueSchema,
  shares:             shareSchema,
  portfolioitems:     portfolioItemSchema,
  portfoliosummaries: portfolioSummarySchema,
  userprofiles:       userProfileSchema,
  waccs:              waccSchema,
  synclogs:           syncLogSchema,
  journalentries:     journalEntrySchema,
  investmententries:  investmentEntrySchema,
  watchlistentries:   watchlistEntrySchema,
};

// Validates a username before it is interpolated into a physical MongoDB
// collection name. Callers must pass the account's unique `username` field
// (never the non-unique display name), so collections can't collide between
// two users who happen to share a name. Spaces, dots and hyphens are still
// allowed for legacy/flexible username formats — but the characters MongoDB
// treats specially in namespaces ($ and the null byte), the "/" path
// separator, and the reserved "system." prefix are rejected to prevent
// collection-name injection.
function assertValidName(name, action) {
  const ok =
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 64 &&
    /^[A-Za-z0-9 ._-]+$/.test(name) &&
    !/^system\./i.test(name.trim());
  if (!ok) {
    throw new Error(`Invalid username for collection ${action}.`);
  }
}

const modelCache = {};

// Tracks in-flight/completed index builds per model so concurrent callers
// awaiting the same model share one promise instead of each kicking off
// (or racing past) their own index build.
//
// ROOT CAUSE THIS FIXES: mongoose.model() schedules Model.init() (which
// builds indexes, including our unique waccId constraint) in the
// background — it is NOT awaited automatically anywhere in Mongoose, and
// nothing in the old getModel() awaited it either. On a brand-new user's
// first page load, getJournalTrades and getInvestmentTrades fire two
// concurrent upserts against investmententries before the unique index on
// waccId has finished building. With no index yet in place, MongoDB has
// nothing to reject the second insert with, so both writes succeed and you
// get two "portfolio_SCRIP" documents — exactly the SOHL duplicate seen in
// production. Awaiting init() here, and awaiting getModel() everywhere it's
// called, closes that startup race permanently.
const indexReady = {};

/**
 * Returns a Mongoose model for a user-scoped collection, GUARANTEED to have
 * its indexes (including unique constraints) already built before resolving.
 *
 * Collection name format: "Krijan.shares" → appears as folder in Compass
 */
async function getModel(username, collectionName) {
  assertValidName(username, "resolution");

  // Capitalize first letter to match folder display: "krijan" → "Krijan"
  const folderName = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  const collectionKey = `${folderName}.${collectionName}`; // e.g. "Krijan.shares"
  const cacheKey = collectionKey;

  let model = modelCache[cacheKey];

  if (!model) {
    const schema = COLLECTION_SCHEMAS[collectionName];
    if (!schema) throw new Error(`Unknown collection: ${collectionName}`);

    // 3rd argument to mongoose.model() is the actual MongoDB collection name
    model = mongoose.model(cacheKey, schema, collectionKey);
    modelCache[cacheKey] = model;
  }

  if (!indexReady[cacheKey]) {
    // model.init() builds all declared indexes (including unique ones) and
    // resolves only once they exist on the server. Caching the promise (not
    // just the result) means concurrent callers for the SAME model during
    // the very first request all await the SAME build instead of racing.
    indexReady[cacheKey] = model.init().catch((err) => {
      // If index build fails (e.g. a unique index can't be created because
      // duplicate values already exist in the collection), surface it loudly
      // instead of silently leaving the collection unprotected. Reset the
      // cached promise so the next call retries rather than permanently
      // believing indexes are ready when they are not.
      logger.error(`❌ Index build failed for ${cacheKey}:`, err);
      delete indexReady[cacheKey];
      throw err;
    });
  }

  await indexReady[cacheKey];
  return model;
}

/**
 * Creates all collections for a user in MongoDB.
 * MongoDB only physically creates a collection when data is inserted,
 * so we explicitly create them here so they appear immediately in Compass.
 *
 * NOTE: this uses the raw driver to pre-create empty collections, which
 * deliberately bypasses Mongoose/schema indexing — that's fine, because
 * every subsequent getModel() call for these collections will still build
 * and await indexes itself before any read/write happens.
 */
async function ensureUserCollections(username) {
  assertValidName(username, "creation");
  const folderName = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  const db = mongoose.connection.db;

  for (const collectionName of Object.keys(COLLECTION_SCHEMAS)) {
    const collectionKey = `${folderName}.${collectionName}`; 
    const exists = await db.listCollections({ name: collectionKey }).toArray();
    if (exists.length === 0) {
      await db.createCollection(collectionKey);
    }
  }

  // Eagerly build indexes for every collection right after signup, instead
  // of waiting for the first real request to trigger it lazily. This is
  // what closes the fresh-account race: by the time the user's first
  // dashboard load fires concurrent journal/investment requests, the
  // unique waccId index already exists.
  await Promise.all(
    Object.keys(COLLECTION_SCHEMAS).map((collectionName) =>
      getModel(username, collectionName)
    )
  );
}

module.exports = { getModel, ensureUserCollections };