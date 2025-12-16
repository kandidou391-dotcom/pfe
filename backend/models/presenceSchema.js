const mongoose = require("mongoose");

const presenceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    statut: {
      type: String,
      required: true,
      enum: ["présent", "absent", "retard"],
      default: "présent",
    },

    // Relations
    seance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seance",
      required: true,
    }, // Séance concernée

    etudiant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Étudiant concerné

    enseignant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

/* ===========================================================
   📊 DATABASE INDEXES FOR PERFORMANCE
=========================================================== */
presenceSchema.index({ etudiant: 1 }); // For student attendance queries
presenceSchema.index({ statut: 1 }); // For attendance rate calculations
presenceSchema.index({ etudiant: 1, statut: 1 }); // For student attendance stats
presenceSchema.index({ seance: 1 }); // For session-based queries
presenceSchema.index({ createdAt: -1 }); // For recent attendance queries

module.exports = mongoose.model("Presence", presenceSchema);
