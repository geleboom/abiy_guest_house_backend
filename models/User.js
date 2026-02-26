const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String,  unique: true,sparse: true , lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, trim: true },
  phone: { type: String,required: true, unique: true, },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving (correct async style)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return; // no next() needed here

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);