const mongoose = require('mongoose');
const { Schema } = mongoose;
const person = { name: { type: String, required: true }, email: { type: String, required: true, lowercase: true } };

const User = mongoose.models.User || mongoose.model('User', new Schema({
  name: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['participant', 'admin'], default: 'participant' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  emailVerified: { type: Boolean, default: false },
  otpHash: String, otpExpires: Date, otpAttempts: { type: Number, default: 0 }, otpSentAt: Date
}, { timestamps: true }));

const Team = mongoose.models.Team || mongoose.model('Team', new Schema({
  name: { type: String, required: true },
  size: { type: Number, enum: [2, 3, 4], required: true },
  college: { type: String, required: true },
  idNumber: { type: String, required: true },
  idFile: String,
  domain: { type: String, required: true },
  problemStatement: { type: String, default: 'Provided on spot' },
  leader: person,
  members: [person],
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  user: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true }));

const Domain = mongoose.models.Domain || mongoose.model('Domain', new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' }
}));

const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', new Schema({
  message: { type: String, required: true }
}, { timestamps: true }));

module.exports = { User, Team, Domain, Announcement };
