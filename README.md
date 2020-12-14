# Listening Notes OAuth Code-along

In this code-along we'll integrate with a 3rd-party API using a common OAuth2 authorization workflow. We'll be revisiting the Notes app built in the authentication code-along. We're going to add a field to our notes that will store whatever we have been listening to on Spotify.

## Spotify Account Required

For this code-along you're going to need a Spotify Account. If you don't already have one, you can [sign-up for one here](https://www.spotify.com/ca-en/signup/).

**Important**: If you've just signed-up please make sure you also listen to at least one song so there will be data that can be queried later.

## Getting started
1. Download these [starter files](https://github.com/HackerYou/con-ed-full-stack/archive/ex-oauth-code-along_01-starter.zip) for this exercise.
1. Extract these files into a working directory.
1. Run `npm install`

To run this project, do the following:
1. Run `mongod` to start an instance of mongo db on your computer. 
- dbname: note-app-oauth
- collections: notes, users
2. Run `yarn start` or `npm start` to run the front end
3. In another terminal window, run `node server.js`

## Exercise/code-along instructions

### Registering your application with Spotify

The first thing you'll need to do is register an application with Spotify in order to get a Client ID and Secret.

You'll need to log-in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/login) and register an application.

Spotify's documentation for creating an application can be [found here](https://developer.spotify.com/documentation/general/guides/app-settings/#register-your-app). Use "Listening Notes" and "An app for recording notes and what you're listening to" as the name and description for your app.

Once you've created your app, edit the app settings to add a Redirect URI for our development URL: `http://localhost:8080/api/users/spotify-auth-callback`.

Next you'll need to copy the Client ID and the Client Secret from the app's dashboard page.

These values need to be added to a `.env` file in your project's root folder,

```ini
# .env
SPOTIFY_CLIENT_ID=....
SPOTIFY_CLIENT_SECRET=...
```

> **No Need To Ignore**
>
> We've already added `.env` to this project's [`.gitignore`](./gitignore) file to keep it from being added to any future git versioning repository.

### Authorization URL

We need to add an endpoint to our back-end that will provide the authorization URL to our front-end to send our user to authorize access to Spotify. Since all of the end-points we'll be adding today are for authenticating a particular user, we'll add them to our `userRoutes.js` file.

First we need a function that will generate a callback-url based on the `userRoute`'s path. Because this changes based on how `userRoute` is loaded into express, we'll need to use a `req` object to access the route's `.baseUrl` value. Let's add the following function to `userRoutes.js`,

```js
/* api/routes/users/userRoutes.js */
function getSpotifyCallbackUrlFromReq(req) {
  // Simplify the workflow by sending the user back to the API directly
  // In a more advanced implementation you might send the user back to the
  // front-end react app and then make an AJAX request to this endpoint
  return `http://localhost:8080${req.baseUrl}/spotify-auth-callback`;
}
```

Next, we need a function that will build our authorization request URL. To keep all of our spotify-specific code together, let's create a `spotifyService.js` file inside a `spotify` directory, and let's create and export the following function:

```js
/* api/spotify/spotifyService.js */

exports.spotifyAuthorizationUrl = (redirectUri, requestedScope = undefined) => {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: requestedScope,
  });
  return url;
}
```

This function, combined with the function above for generating a callback redirect URI will give us the URL we need to send to the front-end when it initiates the authorization flow. Now we can create a new endpoint to provide this URL to the front-end when it makes a request to `/api/users/connect-spotify`.

First we need to import our new function from `spotifyService.js`,

```js
/* api/routes/users/userRoutes.js */

const { spotifyAuthorizationUrl } = require("../../spotify/spotifyService");
```

And now we can add the new route,

```js
/* api/routes/users/userRoutes.js */

router
  .use(verifyToken)
  .route('/connect-spotify')
  .get(async (req, res) => {
    try {
      // Generate an authorization URL and provide it in the response
      // The front-end will use it to redirect the user grant authorization
      res.json({
        redirectTo: spotifyAuthorizationUrl(
          getSpotifyCallbackUrlFromReq(req),
          'user-read-recently-played'
        )
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });
```

Let's add a button beneath the text field in the the `NoteForm` component that will allow a user to initiate the authorization flow. First we need a click handler that makes the API request and then redirects the user to the URL in the response,

```jsx
/* src/components/NoteForm.jsx */

async function connectSpotify() {
  try {
    const response = await fetch(`/api/users/connect-spotify`);
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message);
    }

    window.location = json.redirectTo;
  } catch (err) {
    console.log(err);
  }
}
```

And now we can add the button beneath the text field,

```jsx
/* src/components/NoteForm.jsx */

<div>
  <Button variant="outlined" onClick={connectSpotify}>
    Connect Spotify to Add Listening To
  </Button>
</div>
```

Let's open up the app and log-in (or create an account if you haven't already), and create a new note to test out the connect button.

Clicking the button should redirect us to the Spotify authorization page.

### Authorization callback

Next we need to build support for the callback url in the back-end. First let's add the `/spotify-auth-callback` route to our `UserRoutes`,

```js
/* api/routes/users/userRoutes.js */

router
  .use(verifyToken)
  .route('/spotify-auth-callback')
  .get(async (req, res) => {});
```

If the user has granted access, the incoming request will have an authorization code query parameter that we can use to exchange for access and refresh tokens. If not, we should output a simple error.

```jsx
/* api/routes/users/userRoutes.js */

router
  .use(verifyToken)
  .route('/spotify-auth-callback')
  .get(async (req, res) => {
    if (!req.query.code) {
      /* 
        Shows a simple text error.
        In a more advanced implementation the front-end
        would call this end-point via AJAX and this error
        could be returned and handled in the front-end.
      */
      res.status(500).text(`User didn't grant access to Spotify`);
      return;
    }
  });
```

If we do actually receive a `code` we'll need a way to exchange it for the user's tokens. Let's implement this functionality back in the `spotifyService.js` file. 

First, in order to make an request from our server, we need to first add the `node-fetch` package to our project and `require` it, because Node doesn't have support for the `fetch` function built-in.

```bash
npm install node-fetch
```

```js
const fetch = require("node-fetch");
```

We'll need to provide our client credentials via an `Authorization` header on the request. The Authorization header value should be formatted like this,

```
Basic <base64 encoded client_id:client_secret>
```

Since we'll use this header for other API call as well, let's make a quick function that will return our credentials in this way. We can use Node's `Buffer` object to base64-encode the string using it's `toString(encoding)` syntax.

```js
const clientAuthorizationHeader = () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  return `Basic ${(
    Buffer
      .from(`${clientId}:${clientSecret}`)
      .toString("base64")
  )}`;
}
```

Now we can create and export an authorization code exchanging function. We're going to need the code received by the authorization callback and the original request URI we sent to the authorization page.

```js
/* api/spotify/spotifyService.js */

exports.fetchUserTokensFromAuthCode = async (code, redirectUri) => {}
```

This function will make an API request to spotify's `https://accounts.spotify.com/api/token` endpoint. The endpoint requires that you send the authorization code, the original redirect URI you provided, and a specific `grant_type` value in the body of the request you make to Spotify's token endpoint. It also requires that you submit the request using `application/x-www-form-urlencoded` encoding. We can provide the data in this format by using a [`URLSearchParams` object](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) for our request body.


```js
/* api/spotify/spotifyService.js */

exports.fetchUserTokensFromAuthCode = async (code, redirectUri) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
  });

  console.log('Acquiring access token from auth code...');
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: clientAuthorizationHeader(),
    },
    body: `${body}`,
  });
```

Let's use the response status code as a check to see if the exchange was successful, and if not throw an exception (which would be caught by the `try...catch` in the route in `userRoute.js`). 

```js
/* api/spotify/spotifyService.js */

exports.fetchUserTokensFromAuthCode = async (code, redirectUri) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
  });

  console.log('Acquiring access token from auth code...');
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: clientAuthorizationHeader(),
    },
    body: `${body}`,
  });

  if (response.status !== 200) {
    console.log(await response.text());
    throw new Error("Unable to acquire access token");
  }
```

And finally if the request is successful we can return the access token, refresh token, and the expiry value from the response json,

```js
/* api/spotify/spotifyService.js */

exports.fetchUserTokensFromAuthCode = async (code, redirectUri) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
  });

  console.log('Acquiring access token from auth code...');
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: clientAuthorizationHeader(),
    },
    body: `${body}`,
  });

  if (response.status !== 200) {
    console.log(await response.text());
    throw new Error("Unable to acquire access token");
  }

  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in
  };
}
```

Now we use this function back in our authorization callback endpoint in `userRoutes.js`. Let's add it to the `spotifyService` `require` call,

```js
/* api/routes/users/userRoutes.js */
const { spotifyAuthorizationUrl, fetchUserTokensFromAuthCode} = require("../../spotify/spotifyService");
```

Now we can call this function in our `/spotify-auth-callback` route,

```js
router
  .use(verifyToken)
  .route('/spotify-auth-callback')
  .get(async (req, res) => {
    if (!req.query.code) {
      /* 
        Shows a simple text error.
        In a more advanced implementation the front-end
        would call this end-point via AJAX and this error
        could be returned and handled in the front-end.
      */
      res.status(500).text(`User didn't grant access to Spotify`);
      return;
    }
    try {
      // Exchange the authorization code for user tokens
      const { accessToken, refreshToken, expiresIn } = await fetchUserTokensFromAuthCode(
        req.query.code,
        getSpotifyCallbackUrlFromReq(req)
      );
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });
```

These tokens need to be persisted so that we can use them to talk to the Spotify API any time the user comes back to our app. Let's add fields to hold this data to our `userSchema` so that we can access them via the `UserModel` objects,

```js
/* api/routes/users/userModel.js */
const userSchema = new Schema({
  /* ... */
  spotifyAccessToken: {
    type: String,
  },
  spotifyRefreshToken: {
    type: String,
  },
  spotifyAccessTokenExpiresAfter: {
    type: Date,
  }
  /* ... */
});
```

And lets add a function to `userController.js` to facilitate storing these values. We have to use the `expiresIn` duration, which Spotify gives us in seconds, to calculate a date value after which the access token will be expired so that we can tell if the access token needs to be refreshed later.

When we implement the refresh process, we'll use these same functions to store the updated token, but that call only sends a new refresh token sometimes, so we'll only change the refresh token field if it actually has a value.

```js
/* api/routes/users/userController.js */

function saveSpotifyAccessTokens(user, accessToken, refreshToken, expiresIn) {
  user.spotifyAccessToken = accessToken;
  user.spotifyAccessTokenExpiresAfter = new Date(Date.now() + expiresIn * 1000);

  if(refreshToken) {
    user.spotifyRefreshToken = refreshToken;
  }
  return user.save();
}

exports.saveSpotifyAccessTokensByID = async (id, accessToken, refreshToken, expiresIn) => {
  const user = await User.findById(id);
  return saveSpotifyAccessTokens(user, accessToken, refreshToken, expiresIn);
}
```

Now, back in the `userRoutes.js` callback route we can store the tokens and finally redirect the user back to the front-end.

```js
/* api/routes/users/userRoutes.js */
router
  .use(verifyToken)
  .route('/spotify-auth-callback')
  .get(async (req, res) => {
    if (!req.query.code) {
      /* 
        Shows a simple text error.
        In a more advanced implementation the front-end
        would call this end-point via AJAX and this error
        could be returned and handled in the front-end.
      */
      res.status(500).text(`User didn't grant access to Spotify`);
      return;
    }
    try {
      // Exchange the authorization code for user tokens
      const { accessToken, refreshToken, expiresIn } = await fetchUserTokensFromAuthCode(
        req.query.code,
        getSpotifyCallbackUrlFromReq(req)
      );

      await saveSpotifyAccessTokensByID(
        req.user.id,
        accessToken,
        refreshToken,
        expiresIn
      );

      // Send the user back to the react app
      res.redirect('http://localhost:3000');
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });
```

We'll need a way to communicate to the frontend that the user has authorized spotify, but for security reasons, let's keep the token fields only in the backend. Instead, let's add a boolean field to the `json` returned by our `findUserByID` function in `userController.js`, 

```js
exports.findUserByID = async (id) => {
  try {
    const user = await User.findById(id);
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      spotifyEnabled: (user.spotifyAccessToken ? true : false)
    };
  } catch (ex) {
    throw ex;
  }
};
```

### Adding the "listening to" backend endpoint

Now that we've implemented the authorization flow, we finally have everything we need to be able to make a call to Spotify on behalf of our users.

Let's add a new endpoint to our server that we'll be able to call from our front-end to get the last track our user listened to,

```js
/* api/routes/users/userRoutes.js */

router
  .use(verifyToken)
  .route('/listening-to')
  .get(async (req, res) => {
    try {
      res.json({
        listeningTo: ''; 
      })
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });
```

First thing first, we need to get the current user's access token. Let's add a new method to `userController.js` to return the current access token.

```js
/* api/routes/users/userController.js */
async function getSpotifyAccessToken(user) {
  if (
    user.spotifyAccessToken
    && user.spotifyAccessTokenExpiresAfter > new Date()
  ) {
    return user.spotifyAccessToken;
  }
}

exports.getSpotifyAccessTokenByID = async (id) => {
  return await getSpotifyAccessToken(
    await User.findById(id)
  );
 
}
```

But, because OAuth access tokens are short-lived, we should add support to refresh the token if it's expired. We're going to need a new function in `spotifyService` to use the user's refresh token to get a new access token.

This function is almost the exact same as function we wrote for exchanging the authorization code for an access token, except this time the `grant_type` we send is `refresh_token`, and we're sending the user's refreshToken instead of the authorization code.

```js
/* api/spotify/spotifyService.js */

exports.fetchUserTokensFromRefreshToken = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  console.log('Refreshing access token...');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: clientAuthorizationHeader()
    },
    body: `${body}`,
  });

  if (response.status !== 200) {
    console.log(await response.text());
    throw new Error('Unable to acquire access token');
  }
  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in
  };
}
```

In `userController.js` let's rename `getSpotifyAccessToken()` to `getOrRefreshSpotifyAccessToken()` and use this new function to refresh the access token, save the data, and return the updated access token if the user's access token has expired,

```js
/* api/routes/users/userController.js */

async function getOrRefreshSpotifyAccessToken(user) {
  if (
    user.spotifyAccessToken
    && user.spotifyAccessTokenExpiresAfter > new Date()
  ) {
    return user.spotifyAccessToken;
  }

  const {
    accessToken,
    refreshToken,
    expiresIn } = await fetchUserTokensFromRefreshToken(user.spotifyRefreshToken);

  await saveSpotifyAccessTokens(user, accessToken, refreshToken, expiresIn);

  return user.spotifyAccessToken;
}

exports.getSpotifyAccessTokenByID = async (id) => {
  return await getOrRefreshSpotifyAccessToken(
    await User.findById(id)
  );
}
```

We need to add a function to `spotifyService.js` to make the call to Spotify's recently played endpoint, `https://api.spotify.com/v1/me/player/recently-played`. We're going to use the `limit` API query parameter to only return a single result.

```js
/* api/spotify/spotifyService.js */

exports.fetchListeningTo = async (accessToken) => {
  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
  });

  if (response.status !== 200) {
    console.log(await response.text());
    throw new Error('Unable to acquire recently played');
  }

};
```

The most recently played tracks return results in [this format](https://developer.spotify.com/documentation/web-api/reference/player/get-recently-played/#response-format). We can get the track name from `items[0].track.name`. Every track has an array of artist objects with a `name` property, so we can use `map()` to create an array of artist names and `join()` to combine them together into a simple string.

```js
/* api/spotify/spotifyService.js */

xports.fetchListeningTo = async (accessToken) => {
  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
  });

  if (response.status !== 200) {
    console.log(await response.text());
    throw new Error('Unable to acquire recently played');
  }

  const json = await response.json();
  let listeningTo = '';
  if (json.items && json.items.length) {
    const songName = json.items[0].track.name;
    const artists = json.items[0].track.artists.map((artist) => artist.name).join(', ');
    listeningTo = `${songName} by ${artists}`;
  }
  return listeningTo;
}
```

We can import this new function into `userRoutes.js` and finish our backend `/listening-to` route,

```js
/* api/routes/users/userRoutes.js */
const { spotifyAuthorizationUrl, fetchUserTokensFromAuthCode, fetchListeningTo } = require("../../spotify/spotifyService");
```

```js
/* api/routes/users/userRoutes.js */
router
  .use(verifyToken)
  .route('/listening-to')
  .get(async (req, res) => {
    try {
      const accessToken = await getSpotifyAccessTokenByID(req.user.id);
      res.json({
        listeningTo: await fetchListeningTo(accessToken)
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }
  });
```

### Adding "listening to" to the front-end

We can finally start adding the new "listening to" field to our NoteForm. First, let's create a new state value to hold the value of the "Listening To" text input.

```jsx
/* src/components/NoteForm.js */
  const [listeningTo, setListeningTo] = useState(false);
```

We can use the `spotifyEnabled` field on our front-end `user` object, and the `listeningTo` state value to conditionally render either a new "Listening To" field or the "Connect Spotify" button,

```jsx
/* src/components/NoteForm.js */
  <div>
    {user.spotifyEnabled
      ? (listeningTo === false ? '...' : <TextField
        id="outlined-full-width"
        variant="outlined"
        fullWidth
        label="Listening To"
        value={listeningTo}
        margin="normal"
        onChange={(e) => { setListeningTo(e.target.value); }}
      />)
      : (
        <Button variant="outlined" onClick={connectSpotify}>
          Connect Spotify to Add Listening To
        </Button>
      )}
  </div>
```

And finally, let's add a `useEffect` call to fetch the new `/api/users/listening-to`, and update the state value with it,

```jsx
useEffect(() => {
  async function fetchListeningTo() {
    try {
      const response = await fetch('/api/users/listening-to');
      const json = await response.json();

      if (json.listeningTo) {
        setListeningTo(json.listeningTo);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // only call the API if the user has connected spotify
  // AND we're not editing an old note
  if (user.spotifyEnabled && !match.params.id) {
    fetchListeningTo();
  }
}, [user, match.params.id]);
```

The next thing we need to do is support storing this new "Listening To" field on our Notes model and associated API endpoints.

First, let's add a new field to the `notesSchema` in `notesModel.js`,

```js
/* api/routes/notes/nodesModel.js */
const notesSchema = new Schema({
  /* ... */
  listeningTo: {
    type: String,
  },
  /* ... */
}
```

And add support for the field in the `POST` callback for the `/api/notes/` endpoint in `notesRoutes.js`,

```js
/* api/routes/notes/notesRoutes.js */
router.route('/')
  .get(async (req, res) => { /*...*/ })
  .post(async (req, res) => {
    try {
      const { body } = req;
      if (!body.text || body.text === '') {
        res.status(400).json({ message: 'text must be provided' });
      }

      const newNote = {
        user: req.user.id,
        text: body.text,
        listeningTo: body.listeningTo,
      }
      const id = await createNote(newNote)
      res.json({ data: { id }});
    } catch(err) {
      console.log(err);
      res.status(500).json({ message: 'internal server error' });
    }

  });
```

Finally, all that's left to do is add the field to the front-end `NoteCard` component to display the stored values,

```jsx
/* src/components/NoteCard.js */
export default function NoteCard(props) {
  const classes = useStyles();

  return (
    <Card className={classes.card}>
      <CardContent className={classes.cardContent}>
        <Typography gutterBottom variant="h5" component="h2">
          {props.text}
        </Typography>
        {props.listeningTo && (
          <Typography variant="body1" component="p">
            Listening To: {props.listeningTo}
          </Typography>
        )}
        <Typography variant="body1" component="p">
          {`By ${props.user.firstName} ${props.user.lastName}`}
        </Typography>
      </CardContent>
    </Card>
  )
}
```

Hurray! We've successfully implemented an OAuth authorization flow in our app, added an API call to our backend that calls a 3rd-party OAuth-protected endpoint using the user's access tokens, and integrated it into our front-end application. Whew!

## Next step

When you've completed the exercise, or if you get stuck while working through this on your own, check out [the answer here](https://github.com/HackerYou/con-ed-full-stack/tree/ex-oauth-code-along_02-completed).
