const express = require('express');
const fetch = require("node-fetch");
const { 
  createUser, 
  findUserByEmail, 
  findUserByID, 
  saveSpotifyAccessTokensById, 
  getSpotifyAccessToken, 
} = require("./userController")
// const { createUser, findUserByEmail, findUserByID, saveSpotifyAccessTokensById } = require('./userController');
const { createToken } = require('../../tokens/tokenService');
const { verifyToken } = require('../../middleware/verifyToken');

const router = express.Router();

router.route('/')
  .post(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || email === "") {
      res.status(400).json({ message: 'email must be provided' });
      return;
    }

    if (!password || password === "") {
      res.status(400).json({ message: 'password must be provided' });
      return;
    }

    if (!firstName || firstName === "") {
      res.status(400).json({ message: 'firstName must be provided' });
      return
    }

    if (!lastName || lastName === "") {
      res.status(400).json({ message: 'lastName must be provided' });
      return
    }


    try {
      const foundUser = await findUserByEmail(email);
      if (foundUser) {
        res.status(400).json({ message: `email '${email}' already exists'` });
        return;
      }

      const user = await createUser({ email, password, firstName, lastName });
      res.json({ data: { id: user._id } });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });

router.route('/login')
  .post(async (req, res) => {
    const { email, password } = req.body;
    if (!email || email === "") {
      res.status(400).json({ message: 'email must be provided' });
      return;
    }

    if (!password || password === "") {
      res.status(400).json({ message: 'password must be provided' });
      return;
    }
    
    try {
      // does the user exist?
      const user = await findUserByEmail(email);
      if (!user) {
        res.status(400).json({ message: 'password and email do not match'});
        return;
      }

      // do the password match?
      const isMatch = await user.comparePasswords(password);
      if (!isMatch) {
        res.status(400).json({ message: 'password and email do not match'});
        return;
      }

      const token = createToken({ id: user._id });
      res.cookie('token', token);
      res.status(200).json({});
    } catch (ex) {
      console.log(ex);
      res.status(500).json({ message: 'internal server error' });
    }
  });


router
  .use(verifyToken)
  .route('/me')
  .get(async (req, res) => {
    try {
      const user = await findUserByID(req.user.id);
      res.json({ data: user });
    } catch(err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
});

router
  .use(verifyToken)
  .route('/connect-spotify')
  .get(async (req, res) => {
    try {
      const redirectTo = new URL("https://accounts.spotify.com/authorize");
      redirectTo.search = new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        // if you are using code along from this AM:
        // client_id: 'copy and paste you client id here'
        response_type: "code",
        //req.baseUrl = '/api/users'
        redirect_uri: `http://localhost:8080${req.baseUrl}/spotify-auth-callback`,
        scope: "user-read-recently-played"
      })
      res.json({ redirectTo });
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: 'internal server error' });
    }
  })

// Spotify will call this route for us:
router
  .use(verifyToken)
  .route("/spotify-auth-callback")
  .get(async (req, res) => {
    if (!req.query.code) {
      res.status(500).json({ message: "User did not grant accress" });
      return;
    }
    try {
      console.log("callback was called", req.query.code);
      // THE SECRET EXCHANGE: code for access token
      const redirectUri = `http://localhost:8080${req.baseUrl}/spotify-auth-callback`;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: redirectUri,
      });

      // Below code is spotify OAuth specific code syntax
      const authHeader = `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`;

      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: body,
      });
      if (!response.ok) {
        console.log(await response.text());
        throw new Error("could not get access token");
      }
      const json = await response.json();
      console.log(json);
      const accessToken = json.access_token;
      const refreshToken = json.refresh_token;
      const expiresIn = json.expires_in;
      await saveSpotifyAccessTokensById(req.user.id, {accessToken, refreshToken, expiresIn});
      res.redirect("http://localhost:3000");
      
    } catch(e) {
      console.log(e);
    }
})

// Reach out to Spotify API and get user's most recently listened to songs and send those back to the front end
router.use(verifyToken).route("/listening-to").get(async (req, res) => {
  try {
    const accessToken = await getSpotifyAccessToken(req.user.id);
    // Make API call to Spotify:
    const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.log(await response.text());
      throw new Error("Could not query recently played");
    }
    const json = await response.json();
    console.log(json);
    if (json.items && json.items.length) {
      const songName = json.items[0].track.name;
      const artists = json.items[0].track.artists.map(artist => artist.name).join(', ');
      res.json({ data: `${songName} by ${artists}`});
      // Preventing that fund error: cannot set headers....
      return;
    }
    // 200 status by default
    res.json({data: ""});
  } catch(err) {
    console.log(err);
    res.status(500).json({message: "Internal Server Error"});
  }
})


module.exports = router;