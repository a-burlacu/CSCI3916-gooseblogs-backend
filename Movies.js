var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

try {
    mongoose.connect( process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true}, () =>
        console.log("connected"));
}catch (error) {
    console.log("could not connect");
}
mongoose.set('useCreateIndex', true);

// creating the movie schema with all necessary fields
const MovieSchema = new Schema({
    title: {type: String, required: true, index: {unique: true}},
    year: {type: Number, required: true},
    genre: {type: String, required: true},
    actors: {type: [{
            actorName: String,
            charName: String
        }], required: true},
    imageUrl: {type: String, required: true}
});


//return the model to server
module.exports = mongoose.model('Movie', MovieSchema);