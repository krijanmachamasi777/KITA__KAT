// src/services/syncService.js
//
// BEHAVIOR:
//   runFullSync()     — Full sync every login. Fetches all MeroShare data
//                       and upserts into MongoDB. Never skips based on date.
//   runPortfolioSync() — Lightweight refresh using stored MeroShare token.
//                        Called on browser refresh. Only updates portfolio.
//                        If token expired → throws "sessionExpired" error.
//
// IMPORTANT: Hashed passwords are NEVER used for MeroShare re-authentication.
//            Only the stored meroshareToken (captured at login) is reused.
//

const { getModel }  = require("../utils/userCollections");
const logger        = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");

// ── Helper: upsert many with individual error capture ─────────────────
async function bulkUpsert(Model, filterKeys, docs) {
  let count = 0;
  for (const doc of docs) {
    const filter = {};
    filterKeys.forEach((k) => (filter[k] = doc[k]));
    try {
      await Model.findOneAndUpdate(filter, doc, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
      count++;
    } catch (err) {
      logger.warn(`⚠️  Upsert skipped for ${JSON.stringify(filter)}: ${err.message}`);
    }
  }
  return count;
}

// ── Build / restore a MeroShareClient ────────────────────────────────
//
// Priority:
//   1. credentials.client — already-authenticated client (from login flow)
//   2. credentials.meroshareToken — restore session from stored token
//   3. Fresh login (should only happen in rare fallback cases)
//
// CRITICAL: hashed passwords must never be sent to MeroShare.
// Only plain passwords (during initial login) or stored tokens are used.
//
async function _buildClient(credentials) {
  const MeroShareClient = require("./meroshareClient");

  // Already-authenticated client — use it directly
  if (credentials?.client) {
    return credentials.client;
  }

  const client = new MeroShareClient({
    clientId: credentials.clientId,
    username: credentials.username,
    password: credentials.password,  // only used when token is absent
  });

  if (credentials.meroshareToken) {
    // Restore session from stored token — no password needed.
    // credentials.meroshareToken is ciphertext at rest (see utils/encryption.js
    // and authController.login(), which always stores via encrypt()) — it
    // must be decrypted before it can be used as a live bearer token.
    const plainToken = decrypt(credentials.meroshareToken);
    if (!plainToken) {
      logger.warn("⚠️  Stored MeroShare token could not be decrypted (missing/expired/corrupt).");
      const sessionErr = new Error("MeroShare session expired. Please login again.");
      sessionErr.sessionExpired = true;
      throw sessionErr;
    }
    client.token = plainToken;
    try {
      await client.getOwnDetails();
      logger.info("🔑 MeroShare session restored from stored token.");
    } catch (err) {
      // Token expired or invalid
      logger.warn("⚠️  Stored MeroShare token is expired or invalid.");
      const sessionErr = new Error("MeroShare session expired. Please login again.");
      sessionErr.sessionExpired = true;
      throw sessionErr;
    }
  } else {
    // Fresh login
    await client.login();
    await client.getOwnDetails();
  }

  return client;
}

// ── Step runners ──────────────────────────────────────────────────────

async function syncProfile(client, username) {
  const UserProfile = await getModel(username, "userprofiles");
  const d   = await client.getOwnDetails();
  const now = new Date();

  await UserProfile.findOneAndUpdate(
    { username: d.username || String(client.clientCode) },
    {
      username:        d.username || String(client.clientCode),
      name:            d.name,
      boid:            d.demat,
      clientCode:      String(d.clientCode),
      email:           d.email,
      mobileNumber:    d.mobileNumber,
      dematExpiryDate: d.dematExpiryDate,
      dpName:          d.dpName,
      gender:          d.gender,
      address:         d.address,
      lastSyncedAt:    now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`  ✔ Profile synced for ${d.name} (BOID: ${d.demat})`);
  return 1;
}

async function syncShares(client, username) {
  const Share      = await getModel(username, "shares");
  const { shares } = await client.getMyShares();
  const now        = new Date();

  const docs = shares.map((s) => ({
    boid:           client.boid,
    script:         s.script,
    scriptDesc:     s.scriptDesc,
    isin:           s.isin,
    currentBalance: s.currentBalance,
    freeBalance:    s.freeBalance,
    freezeBalance:  s.freezeBalance,
    pledgeBalance:  s.pledgeBalance,
    lastSyncedAt:   now,
  }));

  const count = await bulkUpsert(Share, ["boid", "script"], docs);
  logger.info(`  ✔ Shares synced: ${count} records.`);
  return count;
}

async function syncPortfolio(client, username) {
  const PortfolioItem    = await getModel(username, "portfolioitems");
  const PortfolioSummary = await getModel(username, "portfoliosummaries");
  const { summary, items } = await client.getPortfolio();
  const now = new Date();

  await PortfolioSummary.findOneAndUpdate(
    { boid: client.boid },
    { boid: client.boid, ...summary, lastSyncedAt: now },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const docs = items.map((item) => ({
    boid:                  client.boid,
    script:                item.script || item.scrip,
    scriptDesc:            item.scriptDesc,
    currentBalance:        item.currentBalance,
    lastTransactionPrice:  item.lastTransactionPrice,
    previousClosingPrice:  item.previousClosingPrice,
    valueOfLastTransPrice: item.valueOfLastTransPrice,
    lastSyncedAt:          now,
  }));

  const count = await bulkUpsert(PortfolioItem, ["boid", "script"], docs);
  logger.info(`  ✔ Portfolio synced: ${count} items + summary.`);
  return count + 1;
}

async function syncApplicableIssues(client, username) {
  const ApplicableIssue = await getModel(username, "applicableissues");
  const { issues }      = await client.getApplicableIssues();
  const now             = new Date();

  const docs = issues.map((iss) => ({
    companyShareId: iss.companyShareId,
    scrip:          iss.scrip || iss.script,
    companyName:    iss.companyName || iss.name,
    shareTypeName:  iss.shareTypeName || iss.issueType,
    shareGroupName: iss.shareGroupName,
    issueOpenDate:  iss.issueOpenDate,
    issueCloseDate: iss.issueCloseDate,
    subGroup:       iss.subGroup,
    statusName:     iss.statusName,
    lastSyncedAt:   now,
  }));

  const count = await bulkUpsert(ApplicableIssue, ["companyShareId"], docs);
  logger.info(`  ✔ Applicable issues synced: ${count} records.`);
  return count;
}

async function syncWacc(client, username, scripts = []) {
  const Wacc    = await getModel(username, "waccs");
  const records = await client.getWaccForAll(scripts);
  const now     = new Date();

  const docs = records.map((r) => ({
    boid:                client.boid,
    scrip:               r.scrip,
    isin:                r.isin,
    transactionQuantity: r.transactionQuantity,
    rate:                r.rate,
    purchaseSource:      r.purchaseSource,
    transactionDate:     r.transactionDate ? new Date(r.transactionDate) : null,
    lastSyncedAt:        now,
  }));

  const count = await bulkUpsert(
    Wacc,
    ["boid", "scrip", "transactionDate", "purchaseSource"],
    docs
  );
  logger.info(`  ✔ WACC synced: ${count} records.`);
  return count;
}

// ── Sale detection sync ───────────────────────────────────────────────
//
// Called inside runFullSync on every login.
//
// FLOW:
//   1. Call getActiveEdis(boid) → list of settlements with soldToday
//   2. For each settlement → call getEdisDetail(settlementId) → sold items
//   3. For each sold item → extract scrip, sellRate, qty, soldDate, wacc(buyRate)
//   4. Search journalentries + investmententries for a matching record:
//      match criteria: scrip === scriptCode AND |buyRate - wacc| <= 0.5
//   5. If a matching ACTIVE (unsold) record found:
//      FULL SALE   (soldQty >= heldQty): fill sellRate + soldDate + soldAmt on existing
//      PARTIAL SALE (soldQty < heldQty):
//        a. Reduce qty on the existing (active) record
//        b. Look for an existing SOLD row for same scrip+buyRate:
//           - Found → accumulate qty + average the sell rate
//           - Not found → create a new SOLD row
//
// TOLERANCE: ±0.50 Rs on buyRate vs EDIS wacc
//
const SALE_MATCH_TOLERANCE = 0.5;

async function syncSales(client, username) {
  const JournalEntry    = await getModel(username, "journalentries");
  const InvestmentEntry = await getModel(username, "investmententries");

  const boid = client.boid;
  if (!boid) {
    logger.warn("syncSales: no BOID available, skipping.");
    return 0;
  }

  // Step 1 — Get active settlements
  const settlements = await client.getActiveEdis(boid);
  if (!settlements.length) {
    logger.info("  ✔ Sales sync: no active EDIS settlements today.");
    return 0;
  }

  logger.info(`  → Sales sync: found ${settlements.length} settlement(s).`);

  let totalUpdated = 0;

  for (const settlement of settlements) {
    const { settlementId } = settlement;
    if (!settlementId) continue;

    // Step 2 — Get detail for each settlement
    const details = await client.getEdisDetail(settlementId);
    if (!details.length) continue;

    for (const detail of details) {
      const obligation    = detail.obligation || {};
      const scrip         = (obligation.scriptCode || "").trim().toUpperCase();
      const soldQty       = Number(detail.transferQuantity || detail.quantity || 0);
      const sellRate      = Number(detail.rate || 0);
      const edisWacc      = Number(obligation.wacc || 0);   // buy rate for matching
      const rawSoldDate   = obligation.settleDate || obligation.tradeDate || "";
      const soldDate      = rawSoldDate
        ? new Date(rawSoldDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      if (!scrip || !soldQty || !sellRate) {
        logger.warn(`  ⚠️  Skipping incomplete EDIS detail: ${JSON.stringify(detail)}`);
        continue;
      }

      logger.info(`  → Processing sale: ${soldQty} × ${scrip} @ ${sellRate} (WACC=${edisWacc})`);

      // Step 3 — Search both collections for a matching ACTIVE record
      // (active = soldDate is empty/null AND sellRate is 0)
      const matchFilter = (entry) => {
        const scripMatch   = (entry.scrip || "").trim().toUpperCase() === scrip;
        const buyRateMatch = Math.abs(Number(entry.buyRate || 0) - edisWacc) <= SALE_MATCH_TOLERANCE;
        const isActive     = !entry.soldDate && !Number(entry.sellRate) && !Number(entry.soldRate);
        return scripMatch && buyRateMatch && isActive;
      };

      // Load candidates from both collections
      const [journalCandidates, investCandidates] = await Promise.all([
        JournalEntry.find({ scrip }).lean(),
        InvestmentEntry.find({ scrip }).lean(),
      ]);

      const activeJournal = journalCandidates.filter(matchFilter);
      const activeInvest  = investCandidates.filter(matchFilter);

      // Prefer whichever collection has a matching active record
      // (script should be in one or the other, not both)
      const Model         = activeInvest.length ? InvestmentEntry : JournalEntry;
      const activeRecords = activeInvest.length ? activeInvest    : activeJournal;

      if (!activeRecords.length) {
        logger.warn(`  ⚠️  No matching active record found for ${scrip} (buyRate≈${edisWacc}). Skipping.`);
        continue;
      }

      // Use the first matching active record
      const activeRecord = activeRecords[0];
      const heldQty      = Number(activeRecord.qty || 0);

      // ── FULL SALE ──────────────────────────────────────────────────
      if (soldQty >= heldQty) {
        const soldAmt = heldQty * sellRate;
        await Model.findByIdAndUpdate(activeRecord._id, {
          sellRate:  sellRate,   // journal uses sellRate
          soldRate:  sellRate,   // investment uses soldRate
          soldDate,
          soldAmt:   soldAmt,
        });
        logger.info(`  ✔ Full sale recorded: ${scrip} (${heldQty} units @ ${sellRate})`);
        totalUpdated++;
        continue;
      }

      // ── PARTIAL SALE ───────────────────────────────────────────────
      // Step A: reduce qty on the active (still-holding) record
      const remainingQty = heldQty - soldQty;
      const newBuyAmt    = remainingQty * Number(activeRecord.buyRate || 0);

      await Model.findByIdAndUpdate(activeRecord._id, {
        qty:    remainingQty,
        buyAmt: newBuyAmt,
      });

      // Step B: find existing SOLD row for same scrip + buyRate
      const soldRowFilter = (entry) => {
        const scripMatch   = (entry.scrip || "").trim().toUpperCase() === scrip;
        const buyRateMatch = Math.abs(Number(entry.buyRate || 0) - edisWacc) <= SALE_MATCH_TOLERANCE;
        const isSold       = !!entry.soldDate || Number(entry.sellRate) > 0 || Number(entry.soldRate) > 0;
        return scripMatch && buyRateMatch && isSold;
      };

      const existingSoldJournal = journalCandidates.filter(soldRowFilter);
      const existingSoldInvest  = investCandidates.filter(soldRowFilter);
      const existingSold        = activeInvest.length
        ? existingSoldInvest[0]
        : existingSoldJournal[0];

      if (existingSold) {
        // ── Accumulate onto existing SOLD row ──────────────────────
        // New avg sell rate = ((prevQty × prevSellRate) + (newQty × newSellRate)) / (prevQty + newQty)
        const prevQty      = Number(existingSold.qty || 0);
        const prevSellRate = Number(existingSold.sellRate || existingSold.soldRate || 0);
        const totalQty     = prevQty + soldQty;
        const avgSellRate  = totalQty
          ? ((prevQty * prevSellRate) + (soldQty * sellRate)) / totalQty
          : sellRate;
        const newSoldAmt   = totalQty * avgSellRate;
        const newBuyAmtSold = totalQty * Number(existingSold.buyRate || edisWacc);

        await Model.findByIdAndUpdate(existingSold._id, {
          qty:      totalQty,
          sellRate: avgSellRate,   // journal
          soldRate: avgSellRate,   // investment
          soldAmt:  newSoldAmt,
          buyAmt:   newBuyAmtSold,
          soldDate,                // update to latest sale date
        });
        logger.info(`  ✔ Partial sale accumulated: ${scrip} sold row now ${totalQty} units @ avg ${avgSellRate.toFixed(2)}`);
      } else {
        // ── Create a brand-new SOLD row ────────────────────────────
        const soldAmt  = soldQty * sellRate;
        const buyAmt   = soldQty * Number(activeRecord.buyRate || edisWacc);

        const newSoldDoc = {
          scrip,
          qty:          soldQty,
          buyRate:      Number(activeRecord.buyRate || edisWacc),
          sellRate,             // journal field
          soldRate:     sellRate, // investment field
          buyAmt,
          soldAmt,
          ltp:          0,
          valueAsOfLtp: 0,
          boughtDate:   activeRecord.boughtDate || "",
          soldDate,
          remarks:      activeRecord.remarks || "",
          imported:     activeRecord.imported || false,
          origin:       activeRecord.origin   || "ms",
          waccId:       activeRecord.waccId   || "",
          tsn:          activeRecord.tsn    || "",
          rr:           activeRecord.rr     || "—",
          sector:       activeRecord.sector || "",
        };

        await Model.create(newSoldDoc);
        logger.info(`  ✔ Partial sale: new SOLD row created for ${scrip} (${soldQty} units @ ${sellRate})`);
      }

      totalUpdated++;
    }
  }

  logger.info(`  ✔ Sales sync complete: ${totalUpdated} record(s) updated.`);
  return totalUpdated;
}

// ── Full sync orchestrator ────────────────────────────────────────────
//
// Runs on EVERY login — no date checks, no skipping.
//
// credentials: {
//   client?:        MeroShareClient   (already authenticated from login)
//   clientId?:      number
//   username?:      string
//   name?:          string            (display name / folder key)
//   password?:      string            (plain — only used for initial login)
//   meroshareToken?: string           (stored token — avoids fresh login)
//   userId?:        ObjectId          (to update User.meroshareToken after sync)
// }
//
async function runFullSync(credentials = null) {
  const startedAt = new Date();
  const steps     = [];

  logger.info("═══════════════════════════════════════════");
  logger.info("        Starting Full MeroShare Sync       ");
  logger.info("═══════════════════════════════════════════");

  let client;
  let username;

  if (credentials?.client) {
    client   = credentials.client;
    // Collection key must be the unique username, not the display name.
    username = credentials.username || credentials.name;
  } else {
    if (!credentials) {
      // Fallback: no credentials — load last user from DB (cron use case)
      const User     = require("../models/User");
      const lastUser = await User.findOne().sort({ lastLoginAt: -1 }).lean();
      if (!lastUser) {
        logger.error("No user in DB. Login via the app first to enable scheduled sync.");
        return;
      }
      credentials = {
        clientId:       lastUser.clientId,
        username:       lastUser.username,
        name:           lastUser.name,
        meroshareToken: lastUser.meroshareToken || null,
        password:       process.env.MEROSHARE_PASSWORD,
        userId:         lastUser._id,
      };
    }

    // Collection key must be the unique username, not the display name.
    username = credentials.username || credentials.name;
    logger.info(`Syncing for user: ${username}`);

    try {
      client = await _buildClient(credentials);
    } catch (buildErr) {
      logger.error("Fatal: login/init failed. Aborting sync.", buildErr);
      const SyncLog = await getModel(username, "synclogs");
      await SyncLog.create({
        status:     "failed",
        steps:      [{ name: "login", status: "error", error: buildErr.message }],
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });
      return;
    }
  }

  const run = async (name, fn) => {
    try {
      const count = await fn();
      steps.push({ name, status: "ok", recordsUpserted: count });
    } catch (err) {
      logger.error(`  ✖ Step [${name}] failed: ${err.message}`);
      steps.push({ name, status: "error", error: err.message });
    }
  };

  await run("profile",          () => syncProfile(client, username));
  await run("shares",           () => syncShares(client, username));
  await run("portfolio",        () => syncPortfolio(client, username));
  await run("applicableIssues", () => syncApplicableIssues(client, username));

  let scripts = [];
  try {
    const { shares } = await client.getMyShares();
    scripts = shares.map((s) => s.script).filter(Boolean);
  } catch (_) {}

  await run("wacc",  () => syncWacc(client, username, scripts));
  await run("sales", () => syncSales(client, username));

  const finishedAt = new Date();
  const durationMs = finishedAt - startedAt;
  const hasErrors  = steps.some((s) => s.status === "error");
  const allFailed  = steps.every((s) => s.status === "error");

  // Persist the refreshed MeroShare token for subsequent portfolio refreshes.
  // Must be encrypted before writing — User.meroshareToken is ciphertext at
  // rest (see authController.login(), which always stores via encrypt()).
  // Previously this wrote client.token raw, silently overwriting the
  // correctly-encrypted value saved moments earlier at login with plaintext,
  // which made every subsequent decrypt() on this token fail.
  if (credentials?.userId) {
    try {
      const User = require("../models/User");
      await User.findByIdAndUpdate(credentials.userId, {
        meroshareToken: encrypt(client.token) || null,
      });
      logger.info("  ✔ MeroShare token saved to User.");
    } catch (e) {
      logger.warn("⚠️  Could not update meroshareToken on User:", e.message);
    }
  }

  // Write sync log
  const SyncLog = await getModel(username, "synclogs");
  await SyncLog.create({
    boid:       client.boid,
    status:     allFailed ? "failed" : hasErrors ? "partial" : "success",
    steps,
    startedAt,
    finishedAt,
    durationMs,
  });

  logger.info(`═══════════════════════════════════════════`);
  logger.info(`  Sync complete in ${durationMs}ms. Status: ${allFailed ? "FAILED" : hasErrors ? "PARTIAL" : "SUCCESS"}`);
  logger.info(`═══════════════════════════════════════════`);

  return { steps, durationMs };
}

// ── Portfolio-only refresh sync ───────────────────────────────────────
//
// Called on browser refresh (not login). Updates ONLY portfolioitems and
// portfoliosummaries (LTP / current values). Uses stored meroshareToken.
// NEVER uses hashed passwords.
//
// If token expired → throws error with sessionExpired = true.
//   → Backend returns 401 { sessionExpired: true }
//   → Frontend clears session + redirects to login.
//
async function runPortfolioSync(credentials) {
  const { userId } = credentials;
  // Collection key must be the unique username, not the display name.
  // `credentials.name` is kept as a fallback for any older caller that
  // still sends the display name under that key.
  const username = credentials.username || credentials.name;

  if (!userId)   throw new Error("runPortfolioSync: userId is required.");
  if (!username) throw new Error("runPortfolioSync: username is required.");

  logger.info(`🔄 Portfolio refresh sync for: ${username}`);

  const User    = require("../models/User");
  const userDoc = await User.findById(userId).select("meroshareToken clientId").lean();

  if (!userDoc?.meroshareToken) {
    const e = new Error("MeroShare session expired. Please login again.");
    e.sessionExpired = true;
    throw e;
  }

  let client;
  try {
    client = await _buildClient({
      clientId:       userDoc.clientId,
      meroshareToken: userDoc.meroshareToken,
    });
  } catch (err) {
    const e = new Error("MeroShare session expired. Please login again.");
    e.sessionExpired = true;
    throw e;
  }

  const startedAt = new Date();
  let count;
  try {
    count = await syncPortfolio(client, username);
  } catch (err) {
    logger.error(`  ✖ Portfolio refresh failed: ${err.message}`);
    throw err;
  }

  // Persist refreshed token in case MeroShare rotated it.
  // Must be encrypted before writing — see note in _buildClient/runFullSync.
  await User.findByIdAndUpdate(userId, {
    meroshareToken: encrypt(client.token) || userDoc.meroshareToken,
  });

  const durationMs = Date.now() - startedAt;
  logger.info(`  ✔ Portfolio refresh complete in ${durationMs}ms (${count} records).`);

  return { count, durationMs };
}

module.exports = { runFullSync, runPortfolioSync };