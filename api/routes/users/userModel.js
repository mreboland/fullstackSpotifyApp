const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrpyt = require('bcryptjs');

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  spotifyAccessTokenExpires: Date,
});

userSchema.pre('save', async function(next) {
  const user = this;
  console.log(typeof user);

  try {
    if (user.isModified('password') || user.isNew) {
      const encrpytedPassword = await bcrpyt.hash(user.password, 10);
      user.password = encrpytedPassword;
    }

    next();
  } catch(ex) {
    next(ex);
  }
});

userSchema.methods.comparePasswords = function(password) {
  const user = this;
  return bcrpyt.compare(password, user.password);
}

module.exports = mongoose.model('User', userSchema);