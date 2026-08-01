// src/schemas/journalEntrySchema.js
//
// FIX: waccId previously had `index: true`, which is a plain non-unique
// index. It did NOT stop two documents from sharing the same waccId, which
// is exactly what allowed duplicate "portfolio_SCRIP" rows to be created
// under concurrent requests. Replaced with a real unique index, scoped with
// a partialFilterExpression so it only applies to non-empty waccId values —
// otherwise every manual trade (waccId: "") would collide on the same
// unique value and only the first manual entry could ever be saved.
//
const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema({
  tsn:            { type: String, index: true },
  scrip:          { type: String, required: true, index: true },
  qty:            { type: Number, default: 0 },
  buyRate:        { type: Number, default: 0 },
  sellRate:       { type: Number, default: 0 },
  buyAmt:         { type: Number, default: 0 },
  soldAmt:        { type: Number, default: 0 },
  ltp:            { type: Number, default: 0 },
  valueAsOfLtp:   { type: Number, default: 0 },
  boughtDate:     { type: String, default: "" },
  soldDate:       { type: String, default: "" },
  rr:             { type: String, default: "—" },
  remarks:        { type: String, default: "" },
  imported:       { type: Boolean, default: false },
  origin:         { type: String, default: "manual" },
  // waccId links an imported entry back to its WACC source record.
  // Used to detect duplicates so we never create the same entry twice.
  // Empty string for all manual trades.
  waccId:         { type: String, default: "" },
}, { timestamps: true });

journalEntrySchema.index({ scrip: 1, boughtDate: 1 });

// REAL uniqueness constraint — this is what actually prevents duplicate
// "portfolio_SCRIP" / composite-WACC-id rows, even under concurrent requests.
// partialFilterExpression excludes waccId: "" so manual entries (which all
// share the empty-string default) never collide with each other.
journalEntrySchema.index(
  { waccId: 1 },
  {
    unique: true,
    // MongoDB partial index filters only support a restricted operator set
    // ($exists, $gt, $gte, $lt, $lte, $type, $and). $ne (and the $not it
    // compiles to internally) is NOT supported and makes index creation fail
    // outright — which is exactly the MongoServerError you'll see in logs if
    // this is wrong: "Expression not supported in partial index: $not".
    // $gt: "" achieves the same "non-empty string" filter, because MongoDB's
    // string ordering treats "" as the minimum possible value, so $gt: ""
    // matches every non-empty string while excluding "" itself.
    partialFilterExpression: { waccId: { $type: "string", $gt: "" } },
  }
);

module.exports = { journalEntrySchema };