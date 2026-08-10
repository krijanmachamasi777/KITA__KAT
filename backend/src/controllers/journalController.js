// src/controllers/journalController.js
//
// THE ONE RULE (this is the entire placement logic for imported "ms" rows):
//
//   A script's row lives in JOURNAL until its OWN boughtDate is more than
//   60 days old. The moment that becomes true — checked on every load — it
//   is moved to INVESTMENT (data carried over) and removed from JOURNAL.
//   It then stays in INVESTMENT permanently (we never move things back).
//
//   • No boughtDate yet (e.g. imported from MS portfolio with no WACC
//     record) → always stays in JOURNAL until the user manually types in
//     a purchase date via the edit form. That's expected and correct.
//   • Manual entries (typed by the user, origin:"manual") are NEVER
//     auto-moved by this logic, in either direction.
//
// WHY THIS FILE LOOKS SIMPLER THAN BEFORE:
//   Previously, both getJournalTrades AND getInvestmentTrades each tried to
//   independently decide "journal or investment" for every script, using a
//   bucket calculation that fell back to guessing a date from whatever was
//   already saved anywhere. Because both endpoints run in parallel on every
//   page load, they could disagree with each other and/or both try to create
//   the same row — which is exactly what caused scripts to appear in both
//   tabs and flip back and forth.
//
//   Now there is only ONE place that creates "ms" rows and ONE place that
//   moves them (both inside getJournalTrades). getInvestmentTrades ONLY
//   reads investmententries — it never creates or moves anything. This
//   makes it impossible for the two endpoints to race or disagree, because
//   only one of them is ever allowed to make a decision.
//
const { getModel } = require("../utils/userCollections");
const logger       = require("../utils/logger");

const HOLDING_THRESHOLD_DAYS = 60;

// ── PURE HELPERS ──────────────────────────────────────────────────────────────

// Uses the unique, immutable username (not the MeroShare display name) so
// per-user MongoDB collections can't collide when two users share a name.
const getUserName = (req) => req.user.username;

const normalizeScript = (value) => String(value || "").trim().toUpperCase();

function diffDays(a, b = new Date()) {
  if (!a) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

// THE rule, in one place, used everywhere a placement decision is made.
// No boughtDate → "journal" (we have nothing to measure age from yet).
function bucketForDate(boughtDate) {
  if (!boughtDate) return "journal";
  return diffDays(boughtDate) > HOLDING_THRESHOLD_DAYS ? "investment" : "journal";
}

function buildPortfolioIndex(items) {
  // NOTE: MeroShare portfolio items use "script" (no trailing 'p'), while WACC
  // records use "scrip". Always normalise through this helper to avoid mismatches.
  return items.reduce((acc, item) => {
    const scrip = normalizeScript(item.script);
    if (!scrip) return acc;
    acc[scrip] = item;
    return acc;
  }, {});
}

// ── TSN HELPERS ───────────────────────────────────────────────────────────────

function getNextTsnCounter(allEntries) {
  return (
    Math.max(
      0,
      ...allEntries.map(({ tsn }) => {
        const n = parseInt((tsn || "").replace(/^TSN/i, ""), 10);
        return isNaN(n) ? 0 : n;
      })
    ) + 1
  );
}

async function assignTsnForManual(JournalEntry, scrip, boughtDate, excludeId = null) {
  const normalScrip = normalizeScript(scrip);

  const candidateQuery = {
    scrip:      normalScrip,
    origin:     "manual",
    tsn:        { $exists: true, $ne: "" },
    boughtDate: { $ne: "" },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };

  const candidates = await JournalEntry
    .find(candidateQuery)
    .select("tsn boughtDate")
    .sort({ boughtDate: 1 })
    .lean();

  if (boughtDate) {
    const newTime = new Date(boughtDate).getTime();
    const match = candidates.find((c) => {
      if (!c.boughtDate) return false;
      return Math.abs(Math.round((newTime - new Date(c.boughtDate).getTime()) / 86_400_000)) <= 12;
    });
    if (match) return match.tsn;
  }

  const all     = await JournalEntry.find({ tsn: { $regex: /^TSN\d+$/i } }).select("tsn").lean();
  const counter = getNextTsnCounter(all);
  return `TSN${String(counter).padStart(3, "0")}`;
}

// ── MAPPERS ───────────────────────────────────────────────────────────────────

function mapJournalEntry(entry) {
  return {
    id:           entry._id.toString(),
    tsn:          entry.tsn || "",
    scrip:        entry.scrip || "",
    qty:          Number(entry.qty || 0),
    buyRate:      Number(entry.buyRate || 0),
    sellRate:     Number(entry.sellRate || 0),
    buyAmt:       Number(entry.buyAmt || 0),
    soldAmt:      Number(entry.soldAmt || 0),
    ltp:          Number(entry.ltp || 0),
    valueAsOfLtp: Number(entry.valueAsOfLtp || 0),
    boughtDate:   entry.boughtDate || "",
    soldDate:     entry.soldDate || "",
    rr:           entry.rr || "—",
    remarks:      entry.remarks || "",
    imported:     !!entry.imported,
    origin:       entry.origin || "manual",
  };
}

function mapInvestmentEntry(entry) {
  return {
    id:           entry._id.toString(),
    scrip:        entry.scrip || "",
    sector:       entry.sector || "",
    qty:          Number(entry.qty || 0),
    buyRate:      Number(entry.buyRate || 0),
    soldRate:     entry.soldRate != null ? Number(entry.soldRate) : null,
    buyAmt:       Number(entry.buyAmt || 0),
    soldAmt:      entry.soldAmt != null ? Number(entry.soldAmt || 0) : null,
    ltp:          Number(entry.ltp || 0),
    valueAsOfLtp: Number(entry.valueAsOfLtp || 0),
    boughtDate:   entry.boughtDate || "",
    soldDate:     entry.soldDate || "",
    remarks:      entry.remarks || "",
    imported:     !!entry.imported,
    origin:       entry.origin || "manual",
  };
}

// Maps a journalentry document to the shape expected by investmententries.
// Used only when MOVING an existing journal row to investment.
function journalDocToInvestmentDoc(entry) {
  return {
    scrip:        entry.scrip,
    sector:       entry.sector || "",
    qty:          entry.qty,
    buyRate:      entry.buyRate,
    soldRate:     entry.sellRate && entry.sellRate > 0 ? entry.sellRate : null,
    buyAmt:       entry.buyAmt,
    soldAmt:      entry.soldAmt && entry.soldAmt > 0 ? entry.soldAmt : null,
    ltp:          entry.ltp,
    valueAsOfLtp: entry.valueAsOfLtp,
    boughtDate:   entry.boughtDate || "",
    soldDate:     entry.soldDate || null,
    remarks:      entry.remarks || "",
    imported:     !!entry.imported,
    origin:       "ms",
    waccId:       entry.waccId || "",
  };
}

// ── AUTO-MOVE: journal → investment ──────────────────────────────────────────
//
// The ONLY place in the whole app that moves an "ms" row from journal to
// investment. Trigger: that row's OWN boughtDate is now > 60 days old.
// Nothing else can trigger a move — no bucket-guessing, no cross-collection
// date borrowing. A row with no boughtDate never matches and never moves,
// which is correct: the user hasn't told us when they bought it yet.
//
async function autoMoveJournalToInvestment(importedJournalEntries, JournalEntry, InvestmentEntry) {
  const movedIds = new Set();

  const candidates = importedJournalEntries.filter(
    (e) => e.boughtDate && diffDays(e.boughtDate) > HOLDING_THRESHOLD_DAYS
  );

  if (!candidates.length) return movedIds;

  logger.info(`  → Auto-moving ${candidates.length} ms journal entry/entries to investment (>60 days held).`);

  for (const entry of candidates) {
    // ATOMIC upsert — guarantees that even if this ran twice concurrently for
    // the same entry, only one investmententries document is ever created.
    const dedupKey = entry.waccId
      ? { waccId: entry.waccId }
      : { scrip: entry.scrip, origin: "ms" };

    try {
      await InvestmentEntry.findOneAndUpdate(
        dedupKey,
        { $setOnInsert: journalDocToInvestmentDoc(entry) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // E11000 = another concurrent call already upserted this same entry.
      // The data is safely in investmententries either way — fine to continue.
      if (err.code !== 11000) throw err;
    }

    // findByIdAndDelete returns null if it was already deleted by a
    // concurrent call. Only count it as "moved" if it actually existed.
    const deleted = await JournalEntry.findByIdAndDelete(entry._id).lean();
    if (deleted) movedIds.add(entry._id.toString());
  }

  return movedIds;
}

// ── GET JOURNAL TRADES ────────────────────────────────────────────────────────
//
// This is the ONLY function that creates new "ms" rows and the ONLY function
// that moves them to investment. getInvestmentTrades (below) just reads.
//
exports.getJournalTrades = async (req, res) => {
  try {
    const username = getUserName(req);
    const Wacc            = await getModel(username, "waccs");
    const PortfolioItem   = await getModel(username, "portfolioitems");
    const JournalEntry    = await getModel(username, "journalentries");
    const InvestmentEntry = await getModel(username, "investmententries");

    const [waccRecords, portfolioItems, allJournalEntries, allInvestmentEntries] = await Promise.all([
      Wacc.find()
        .sort({ transactionDate: 1 })
        .select("scrip transactionQuantity rate transactionDate purchaseSource isin boid")
        .lean(),
      PortfolioItem.find()
        .select("script lastTransactionPrice valueOfLastTransPrice currentBalance")
        .lean(),
      JournalEntry.find().sort({ createdAt: 1 }).lean(),
      InvestmentEntry.find().select("scrip waccId").lean(),
    ]);

    const portfolioMap = buildPortfolioIndex(portfolioItems);

    const importedJournalEntries = allJournalEntries.filter((e) => e.origin === "ms");
    const manualJournalEntries   = allJournalEntries.filter((e) => e.origin !== "ms");

    // Index manual entries by scrip so imported rows can reuse an existing
    // manual TSN when the bought dates are close (within the same 12-day
    // proximity window used elsewhere). This prevents creating duplicate
    // TSNs when the user already added a manual row for the same purchase.
    const manualByScrip = Object.fromEntries(
      manualJournalEntries.filter((e) => e && e.scrip && e.tsn).map((e) => [normalizeScript(e.scrip), e])
    );

    // STEP 1 — Move any existing journal row whose OWN boughtDate has now
    // crossed 60 days. This is the only thing that ever moves a row.
    const movedIds = await autoMoveJournalToInvestment(importedJournalEntries, JournalEntry, InvestmentEntry);

    const remainingImported = importedJournalEntries.filter((e) => !movedIds.has(e._id.toString()));

    // Lookups so we never re-create something that already exists somewhere.
    const journalByWaccId = Object.fromEntries(
      remainingImported.filter((e) => e.waccId).map((e) => [e.waccId, e])
    );
    const journalByScrip = Object.fromEntries(
      remainingImported.map((e) => [normalizeScript(e.scrip), e])
    );
    const investmentWaccIds = new Set(allInvestmentEntries.filter((e) => e.waccId).map((e) => e.waccId));
    const investmentScrips  = new Set(allInvestmentEntries.map((e) => normalizeScript(e.scrip)));

    // IMPORTANT: allInvestmentEntries was fetched BEFORE autoMoveJournalToInvestment
    // ran, so it does NOT yet contain rows that the move just inserted a few
    // lines above. Without adding those in here too, the "already exists in
    // investment?" checks below would say "no" for a script that was moved
    // THIS SAME REQUEST — causing it to be wrongly re-created as a brand new,
    // blank row in journalentries right after being correctly moved out.
    // (This was the exact cause of a script appearing in both tabs after a move.)
    const justMovedEntries = importedJournalEntries.filter((e) => movedIds.has(e._id.toString()));
    for (const e of justMovedEntries) {
      if (e.waccId) investmentWaccIds.add(e.waccId);
      investmentScrips.add(normalizeScript(e.scrip));
    }

    let tsnCounter   = getNextTsnCounter([...manualJournalEntries, ...remainingImported]);
    const tsnHistory = {}; // scrip → [{ tsn, boughtDate }]

    // Seed tsnHistory with existing manual and imported journal entries
    // so that when we process WACC rows we can reuse TSNs already present
    // in the database for the same scrip (common with multiple WACC rows).
    for (const e of [...manualJournalEntries, ...remainingImported]) {
      try {
        const s = normalizeScript(e.scrip);
        if (!s || !e.tsn) continue;
        (tsnHistory[s] = tsnHistory[s] || []).push({ tsn: e.tsn, boughtDate: e.boughtDate || "" });
      } catch (err) {
        // Defensive: ignore malformed entries
      }
    }
    const toInsert   = [];
    const resultRows = []; // ms-origin rows we will return (existing + newly inserted)

    // STEP 2 — For every WACC record: if it already exists anywhere (journal
    // or investment), just display it from where it lives. If it doesn't
    // exist yet, decide its bucket ONCE using bucketForDate and create it
    // directly in the correct collection — this is what makes an
    // already-old (>60 days) WACC record land straight in Investment on
    // its very first import, instead of bouncing through Journal first.
    for (const w of waccRecords) {
      const scrip      = normalizeScript(w.scrip);
      const waccId      = String(w._id);
      const boughtDate  = w.transactionDate
        ? new Date(w.transactionDate).toISOString().slice(0, 10)
        : "";

      // Already saved in journal → show it (still belongs here, hasn't crossed 60 days)
      if (journalByWaccId[waccId]) {
        const live = portfolioMap[scrip] || {};
        resultRows.push({
          ...mapJournalEntry(journalByWaccId[waccId]),
          ltp:          Number(live.lastTransactionPrice || 0),
          valueAsOfLtp: Number(live.valueOfLastTransPrice || 0),
        });
        continue;
      }

      // Already saved in investment → nothing to show here, getInvestmentTrades handles it
      if (investmentWaccIds.has(waccId)) continue;

      // Not saved anywhere yet — decide bucket ONCE, right now
      const bucket = bucketForDate(boughtDate);

      const qty          = Number(w.transactionQuantity) || 0;
      const buyRate       = Number(w.rate) || 0;
      const buyAmt        = qty * buyRate;
      const live          = portfolioMap[scrip] || {};
      const ltp           = Number(live.lastTransactionPrice || 0);
      const valueAsOfLtp  = Number(live.valueOfLastTransPrice || 0) || qty * ltp;
      const remarks       = w.purchaseSource ? `Source: ${w.purchaseSource}` : "";

      if (bucket === "investment") {
        // Already older than 60 days on first import → goes straight to
        // investmententries, never touches journalentries at all.
        try {
          await InvestmentEntry.findOneAndUpdate(
            { waccId },
            {
              $setOnInsert: {
                scrip, sector: "", qty, buyRate, soldRate: null, buyAmt,
                soldAmt: null, ltp, valueAsOfLtp, boughtDate, soldDate: null,
                remarks, imported: true, origin: "ms", waccId,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          // Nothing pushed to resultRows — this belongs in the Investment
          // tab, which getInvestmentTrades reads directly from investmententries.
        } catch (err) {
          if (err.code !== 11000) throw err;
        }
        continue;
      }

      // Bucket is "journal" — queue for insert, assign TSN
      // Prefer reusing a nearby manual TSN if one exists (prevents separate
      // TSNs when the user already recorded the trade manually).
      let assignedTsn = null;
      const manualMatch = manualByScrip[scrip];
      if (manualMatch && boughtDate && manualMatch.boughtDate) {
        const diff = Math.abs(Math.round((new Date(boughtDate) - new Date(manualMatch.boughtDate)) / 86_400_000));
        if (diff <= 12) {
          assignedTsn = manualMatch.tsn;
        }
      }

      // Fall back to reusing a TSN created earlier in this same import run
      // (tsnHistory) or allocate a fresh one.
      if (!assignedTsn) {
        const recent = (tsnHistory[scrip] || []).slice().reverse().find((h) => {
          if (!h.boughtDate || !boughtDate) return false;
          return Math.abs(Math.round(
            (new Date(boughtDate) - new Date(h.boughtDate)) / 86_400_000
          )) <= 12;
        });
        assignedTsn = recent?.tsn || `TSN${String(tsnCounter++).padStart(3, "0")}`;
      }

      (tsnHistory[scrip] = tsnHistory[scrip] || []).push({ tsn: assignedTsn, boughtDate });

      toInsert.push({
        tsn: assignedTsn, scrip, qty, buyRate, sellRate: 0, buyAmt, soldAmt: 0,
        ltp, valueAsOfLtp, boughtDate, soldDate: "", rr: "—",
        remarks, imported: true, origin: "ms", waccId,
      });
    }

    if (toInsert.length) {
      const inserted = await JournalEntry.insertMany(toInsert, { ordered: false });
      for (const doc of inserted) {
        const live = portfolioMap[normalizeScript(doc.scrip)] || {};
        resultRows.push({
          ...mapJournalEntry(doc),
          ltp:          Number(live.lastTransactionPrice || 0),
          valueAsOfLtp: Number(live.valueOfLastTransPrice || 0),
        });
      }
    }

    // STEP 3 — Portfolio-only scripts (no WACC record at all). These ALWAYS
    // start in Journal with an empty boughtDate (per the rule: no date yet
    // means no age to measure, so it can't possibly be >60 days). They will
    // only ever move once the user manually types in a purchase date via
    // the edit form, crosses 60 days, and autoMoveJournalToInvestment (which
    // runs on every load) picks it up like any other journal row.
    const waccScripts = new Set(waccRecords.map((w) => normalizeScript(w.scrip)));

    for (const item of portfolioItems) {
      const scrip = normalizeScript(item.script);
      if (!scrip || waccScripts.has(scrip)) continue;

      const portfolioWaccId = `portfolio_${scrip}`;
      const ltp          = Number(item.lastTransactionPrice || 0);
      const valueAsOfLtp = Number(item.valueOfLastTransPrice || 0);

      // Already exists in journal → show it
      const savedInJournal = journalByWaccId[portfolioWaccId] || journalByScrip[scrip];
      if (savedInJournal) {
        resultRows.push({ ...mapJournalEntry(savedInJournal), ltp, valueAsOfLtp });
        continue;
      }

      // Already exists in investment (user gave it a date >60 days ago and
      // it was already moved on a previous load) → nothing to do here,
      // getInvestmentTrades reads it directly.
      if (investmentWaccIds.has(portfolioWaccId) || investmentScrips.has(scrip)) continue;

      // Brand new portfolio-only holding — create in journal with no date.
      const qty = Number(item.currentBalance || 0);
      const newDoc = {
        tsn: `TSN${String(tsnCounter++).padStart(3, "0")}`,
        scrip, qty, buyRate: 0, sellRate: 0, buyAmt: 0, soldAmt: 0,
        ltp, valueAsOfLtp: valueAsOfLtp || qty * ltp,
        boughtDate: "", soldDate: "", rr: "—",
        remarks:  "No WACC data — imported from portfolio. Add a purchase date to enable 60-day tracking.",
        imported: true, origin: "ms", waccId: portfolioWaccId,
      };

      try {
        const inserted = await JournalEntry.findOneAndUpdate(
          { waccId: portfolioWaccId },
          { $setOnInsert: newDoc },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        resultRows.push({ ...mapJournalEntry(inserted), ltp, valueAsOfLtp });
      } catch (err) {
        if (err.code === 11000) {
          const existing = await JournalEntry.findOne({ waccId: portfolioWaccId }).lean();
          if (existing) {
            resultRows.push({ ...mapJournalEntry(existing), ltp, valueAsOfLtp });
            continue;
          }
        }
        resultRows.push({ id: `ms_portfolio_${scrip}`, ...newDoc });
      }
    }

    const trades = [
      ...manualJournalEntries.map(mapJournalEntry),
      ...resultRows,
    ];

    res.json({ success: true, total: trades.length, data: trades });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── GET INVESTMENT TRADES ─────────────────────────────────────────────────────
//
// READ-ONLY with respect to placement: this function NEVER creates a new
// "ms" row and NEVER moves anything. All placement decisions happen in
// getJournalTrades. This is what makes it impossible for the two tabs to
// disagree — there is only one decision-maker.
//
// It still needs to merge in live LTP from portfolioitems so prices stay
// fresh, and it still serves manual investment entries normally.
//
exports.getInvestmentTrades = async (req, res) => {
  try {
    const username = getUserName(req);
    const PortfolioItem   = await getModel(username, "portfolioitems");
    const InvestmentEntry = await getModel(username, "investmententries");

    const [portfolioItems, allInvestmentEntries] = await Promise.all([
      PortfolioItem.find()
        .select("script currentBalance lastTransactionPrice valueOfLastTransPrice")
        .lean(),
      InvestmentEntry.find().sort({ createdAt: 1 }).lean(),
    ]);

    const portfolioMap = buildPortfolioIndex(portfolioItems);

    const investmentTrades = allInvestmentEntries.map((entry) => {
      const live = portfolioMap[normalizeScript(entry.scrip)];
      // Manual entries and "ms" rows for scripts no longer in the live
      // portfolio just keep whatever ltp/valueAsOfLtp was last saved.
      if (!live) return mapInvestmentEntry(entry);

      return {
        ...mapInvestmentEntry(entry),
        ltp:          Number(live.lastTransactionPrice || 0),
        valueAsOfLtp: Number(live.valueOfLastTransPrice || 0),
      };
    });

    res.json({ success: true, total: investmentTrades.length, data: investmentTrades });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── BODY PARSER ───────────────────────────────────────────────────────────────

function parseBody(body) {
  const p = { ...body };
  const num  = (v, fallback = 0)   => v == null ? fallback : Number(v) || fallback;
  const nullable = (v) => v === "" ? null : Number(v);

  if (p.qty          != null) p.qty          = num(p.qty);
  if (p.buyRate      != null) p.buyRate      = num(p.buyRate);
  if (p.sellRate     != null) p.sellRate     = p.sellRate  === "" ? 0    : num(p.sellRate);
  if (p.soldRate     != null) p.soldRate     = nullable(p.soldRate);
  if (p.buyAmt       != null) p.buyAmt       = num(p.buyAmt);
  if (p.soldAmt      != null) p.soldAmt      = p.soldAmt   === "" ? null : num(p.soldAmt);
  if (p.ltp          != null) p.ltp          = num(p.ltp);
  if (p.valueAsOfLtp != null) p.valueAsOfLtp = num(p.valueAsOfLtp);
  return p;
}

// ── JOURNAL CRUD ──────────────────────────────────────────────────────────────

exports.createJournalTrade = async (req, res) => {
  try {
    const JournalEntry = await getModel(getUserName(req), "journalentries");
    const payload      = parseBody(req.body);
    const tsn          = await assignTsnForManual(JournalEntry, payload.scrip || "", payload.boughtDate || "");

    const entry = await JournalEntry.create({
      ...payload, tsn, waccId: "", imported: false, origin: "manual",
    });
    res.json({ success: true, data: mapJournalEntry(entry) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateJournalTrade = async (req, res) => {
  try {
    const JournalEntry = await getModel(getUserName(req), "journalentries");
    const payload      = parseBody(req.body);
    const { id }       = req.params;

    const existing = await JournalEntry.findById(id).lean();
    if (!existing) return res.status(404).json({ success: false, message: "Journal entry not found." });

    const incomingScrip      = normalizeScript(payload.scrip || existing.scrip || "");
    const incomingBoughtDate = (payload.boughtDate !== undefined ? payload.boughtDate : existing.boughtDate) || "";
    const isManual           = (existing.origin || "manual") === "manual";
    const scripChanged       = incomingScrip      !== normalizeScript(existing.scrip || "");
    const boughtDateChanged  = incomingBoughtDate !== (existing.boughtDate || "");

    let tsnUpdate = {};
    if (isManual && (scripChanged || boughtDateChanged)) {
      tsnUpdate = { tsn: await assignTsnForManual(JournalEntry, incomingScrip, incomingBoughtDate, id) };
    }

    // Never overwrite origin or imported — losing "ms" identity causes duplication bugs
    const entry = await JournalEntry.findByIdAndUpdate(
      id,
      { ...payload, ...tsnUpdate, imported: existing.imported, origin: existing.origin || "manual" },
      { new: true, runValidators: true }
    ).lean();

    if (!entry) return res.status(404).json({ success: false, message: "Journal entry not found." });
    res.json({ success: true, data: mapJournalEntry(entry) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteJournalTrade = async (req, res) => {
  try {
    const JournalEntry = await getModel(getUserName(req), "journalentries");
    const entry = await JournalEntry.findByIdAndDelete(req.params.id).lean();
    if (!entry) return res.status(404).json({ success: false, message: "Journal entry not found." });
    res.json({ success: true, data: null });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── INVESTMENT CRUD ───────────────────────────────────────────────────────────

exports.createInvestmentTrade = async (req, res) => {
  try {
    const InvestmentEntry = await getModel(getUserName(req), "investmententries");
    const payload         = parseBody(req.body);
    const entry = await InvestmentEntry.create({
      ...payload, waccId: "", imported: false, origin: "manual",
    });
    res.json({ success: true, data: mapInvestmentEntry(entry) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateInvestmentTrade = async (req, res) => {
  try {
    const InvestmentEntry = await getModel(getUserName(req), "investmententries");
    const payload         = parseBody(req.body);
    const entry = await InvestmentEntry.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).lean();
    if (!entry) return res.status(404).json({ success: false, message: "Investment entry not found." });
    res.json({ success: true, data: mapInvestmentEntry(entry) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteInvestmentTrade = async (req, res) => {
  try {
    const InvestmentEntry = await getModel(getUserName(req), "investmententries");
    const entry = await InvestmentEntry.findByIdAndDelete(req.params.id).lean();
    if (!entry) return res.status(404).json({ success: false, message: "Investment entry not found." });
    res.json({ success: true, data: null });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};