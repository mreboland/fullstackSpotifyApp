const Notes = require('./notesModel');

exports.getNotesByUser = async (userID) => {
  try {
    const notes = await Notes
      .find({ user: userID })
      .populate({ path: 'user', select: 'firstName lastName' });
    return notes;
  } catch (err) {
    throw err;
  }
};

exports.createNote = async (data) => {
  try {
    const newNote = new Notes(data);
    const note = await newNote.save();
    return note.id;
  } catch (err) {
    throw err;
  }
};

exports.getNoteById = async (id) => {
  try {
    const note = await Notes
      .findById(id)
      .populate({ path: 'user', select: 'firstName lastName' });
    return note;
  } catch(err) {
    throw err;
  }
};

exports.updateNoteById = async (note) => {
  try {
    const n = await Notes.findOne({
      user: note.user,
      _id: note.id,
    });
    n.text = note.text;
    n.listeningTo = note.listeningTo;
    const savedNote = await n.save();
    return savedNote;
  } catch (err) {
    throw err;
  }
}