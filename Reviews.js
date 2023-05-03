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

// creating the review schema with all necessary fields
const ReviewSchema = new Schema({
    movieID : {type: String, required: true},
    name: {type: String, required: true, index: {unique: true}},
    quote: {type: String},
    rating: {type: Number, required: true, min: 1, max: 5}

});


//return the model to server
module.exports = mongoose.model('Review', ReviewSchema);