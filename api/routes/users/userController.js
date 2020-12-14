const User = require('./userModel');

exports.createUser = async ({ email, password, firstName, lastName }) => {
  try {
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
    });
    const user = await newUser.save();
    return user;
  } catch (ex) {
    throw ex;
  }
};

exports.findUserByEmail = async (email) => {
  try {
    const user = await User.findOne({ email });
    return user;
  } catch (ex) {
    throw ex;
  }
}

exports.findUserByID = async (id) => {
  try {
    const user = await User.findById(id);
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      // checking to see if user has a token from spotify so we can remove the connect to spotify button when the user is logged in.
      spotifyEnabled: user.spotifyAccessToken ? true : false,
    };
  } catch (ex) {
    throw ex;
  }
};

// Save spotify data to a user
exports.saveSpotifyAccessTokensById = async (id, spotifyData) => {
    // Below destructured variables are taken from whats printed out in our console on node server that we console logged in userRoutes.js
  const { accessToken, refreshToken, expiresIn } = spotifyData;
  const user = await User.findById(id);
  user.spotifyAccessToken = accessToken;
  user.spotifyRefreshToken = refreshToken;
  // save date at which token will expire ie Dec 5 4:30pm
  user.spotifyAccessTokenExpires = new Date(Date.now() + expiresIn * 1000);
  // Updating the user in the database with the new fields from spotify:
  return user.save();
}

// Refresh token logic would go here:
exports.getSpotifyAccessToken = async (id) => {
  const user = await User.findById(id);
  return user.spotifyAccessToken;
}