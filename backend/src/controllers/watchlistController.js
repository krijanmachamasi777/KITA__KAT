const { getModel } = require("../utils/userCollections");
const logger       = require("../utils/logger");

// Uses the unique, immutable username (not the MeroShare display name) so
// per-user MongoDB collections can't collide when two users share a name.
const getUserName = (req) => req.user?.username || req.user?.name || "";

function mapWatchlistEntry(doc) {
  return {
    id:         doc._id.toString(),
    scrip:      doc.scrip       || "",
    sector:     doc.sector      || "",
    breakout:   Number(doc.breakout   || 0),
    support:    Number(doc.support    || 0),
    resistance: Number(doc.resistance || 0),
    notes:      doc.notes       || "",
  };
}

exports.getWatchlistItems = async (req, res) => {
  try {
    const WatchlistEntry = await getModel(getUserName(req), "watchlistentries");
    const docs = await WatchlistEntry.find().sort({ createdAt: 1 }).lean();
    res.json({ success: true, total: docs.length, data: docs.map(mapWatchlistEntry) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.createWatchlistItem = async (req, res) => {
  try {
    const WatchlistEntry = await getModel(getUserName(req), "watchlistentries");
    const { scrip, sector, breakout, support, resistance, notes } = req.body;
    if (!scrip?.trim()) return res.status(400).json({ success: false, message: "Scrip name is required." });
    const doc = await WatchlistEntry.create({
      scrip: scrip.trim().toUpperCase(),
      sector: sector || "",
      breakout: Number(breakout) || 0,
      support: Number(support) || 0,
      resistance: Number(resistance) || 0,
      notes: notes || "",
    });
    res.status(201).json({ success: true, data: mapWatchlistEntry(doc) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateWatchlistItem = async (req, res) => {
  try {
    const WatchlistEntry = await getModel(getUserName(req), "watchlistentries");
    const { scrip, sector, breakout, support, resistance, notes } = req.body;
    const updated = await WatchlistEntry.findByIdAndUpdate(
      req.params.id,
      { scrip: scrip?.trim().toUpperCase(), sector: sector || "", breakout: Number(breakout) || 0, support: Number(support) || 0, resistance: Number(resistance) || 0, notes: notes || "" },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Watchlist item not found." });
    res.json({ success: true, data: mapWatchlistEntry(updated) });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteWatchlistItem = async (req, res) => {
  try {
    const WatchlistEntry = await getModel(getUserName(req), "watchlistentries");
    const deleted = await WatchlistEntry.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: "Watchlist item not found." });
    res.json({ success: true, message: "Watchlist item deleted." });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
};