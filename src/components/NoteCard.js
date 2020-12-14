import React from 'react';
// import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  cardGrid: {
    paddingTop: theme.spacing(8),
    paddingBottom: theme.spacing(8),
  },
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  cardMedia: {
    paddingTop: '56.25%', // 16:9
  },
  cardContent: {
    flexGrow: 1,
  },
}));

export default function NoteCard(props) {
  const classes = useStyles();

  return (
    <Card className={classes.card}>
      <CardContent className={classes.cardContent}>
        <Typography gutterBottom variant="h5" component="h2">
          {props.text}
        </Typography>
        {props.listeningTo && 
          <Typography variant="body1" component="p">
            Listening To: {props.listeningTo}
          </Typography>}
        <Typography variant="body1" component="p">
          {`By ${props.user.firstName} ${props.user.lastName}`}
        </Typography>
      </CardContent>
    </Card>
  )
}