import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';

import NoteCard from './NoteCard';

const useStyles = makeStyles(theme => ({
  heroContent: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(8, 0, 6),
  },
  heroButtons: {
    marginTop: theme.spacing(4),
  },
  cardGrid: {
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(8),
  },
}));

// const cards = [1, 2, 3];

export default function NoteList(props) {
  const classes = useStyles();
  const [ notes, setNotes ] = useState([]);

  async function getNotes() {
    try {
      const response = await fetch('/api/notes');
    
      const json = await response.json();
      setNotes(json.data);
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    getNotes();
  }, []);
  console.log(notes);
  return (
    <div>
      <div className={classes.heroContent}>
        <Container maxWidth="sm">
          <Typography variant="h5" align="center" color="textSecondary" paragraph>
            Make Some Notes
          </Typography>
          <div className={classes.heroButtons}>
            <Grid container spacing={2} justify="center">
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => { props.history.push('/note/create'); }}
                >
                  New Note
                </Button>
              </Grid>
            </Grid>
          </div>
        </Container>
      </div>
      <Container className={classes.cardGrid} maxWidth="md">
        {/* End hero unit */}
        <Grid container spacing={4}>
          {
            notes
            &&
            notes.map(note => {
              return (
                <Grid
                  xs={12}
                  sm={6}
                  md={4}
                  item
                  key={note._id}
                  onClick={() => { props.history.push(`/note/edit/${note._id}`) }}
                >
                  <NoteCard  
                    text={note.text}
                    user={note.user}
                    listeningTo={note.listeningTo}
                  />
                </Grid>
            );
          })}
        </Grid>
      </Container>
    </div>
  );
}