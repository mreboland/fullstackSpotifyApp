const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const userRouter = require('./api/routes/users/userRoutes');
const notesRouter = require('./api/routes/notes/notesRoutes');

if (process.env.NODE_ENV !== 'production') {
  const dotenv = require('dotenv');

  // parse `.env` and push entries into `process.env`
  const result = dotenv.config();

  if (result.error) {
    // don't proceed if there was an error loading env vars
    throw result.error;
  }
}

const app = express();
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/users', userRouter);
app.use('/api/notes', notesRouter);

mongoose
  .connect('mongodb://localhost:27017/note-app-oauth',
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    },
  )
  .then(() => {
    app.listen('8080', () => {
      console.log('server is running on port 8080');
    });
  })
  .catch((err) => console.log(err));